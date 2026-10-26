import { clamp } from "./math";
import type { TUNING } from "../config";
import type { Vec2 } from "./types";

type PheromoneTuning = typeof TUNING.pheromone;

const MAX_TRAIL = 16;

/**
 * A coarse pheromone grid in screen space. Ants leave deposits in cells; the
 * field diffuses and evaporates on its own clock. A separate paint layer keeps
 * the user's drawn trail visible while the colony works over it.
 */
export class PheromoneField {
  cols = 0;
  rows = 0;
  cellW = 1;
  cellH = 1;

  private trailData = new Float32Array(0);
  private trailTmp = new Float32Array(0);
  private paintData = new Float32Array(0);
  private acc = 0;

  constructor(private readonly tuning: PheromoneTuning) {}

  get trail() {
    return this.trailData;
  }

  get paint() {
    return this.paintData;
  }

  get length() {
    return this.trailData.length;
  }

  resize(cols: number, rows: number, cellW: number, cellH: number) {
    this.cols = cols;
    this.rows = rows;
    this.cellW = cellW;
    this.cellH = cellH;
    const n = cols * rows;
    this.trailData = new Float32Array(n);
    this.trailTmp = new Float32Array(n);
    this.paintData = new Float32Array(n);
    this.acc = 0;
  }

  clear() {
    this.trailData.fill(0);
    this.trailTmp.fill(0);
    this.paintData.fill(0);
    this.acc = 0;
  }

  deposit(x: number, y: number, amount: number, radius = 0) {
    this.depositInto(this.trailData, x, y, amount, radius);
  }

  depositPaint(x: number, y: number, amount: number, radius = 1) {
    this.depositInto(this.paintData, x, y, amount, radius);
  }

  sample(x: number, y: number) {
    const c = Math.floor(x / this.cellW);
    const r = Math.floor(y / this.cellH);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return 0;
    return this.combinedAt(r * this.cols + c);
  }

  /**
   * Direction of increasing pheromone, in screen space. The gradient points
   * along a trail; the caller blends it with the ant's own target direction.
   */
  gradient(x: number, y: number, out: Vec2) {
    const c = Math.floor(x / this.cellW);
    const r = Math.floor(y / this.cellH);
    out.x = 0;
    out.y = 0;
    if (c <= 0 || r <= 0 || c >= this.cols - 1 || r >= this.rows - 1) return out;

    const i = r * this.cols + c;
    const l = this.combinedAt(i - 1);
    const rt = this.combinedAt(i + 1);
    const u = this.combinedAt(i - this.cols);
    const d = this.combinedAt(i + this.cols);
    out.x = rt - l;
    out.y = d - u;
    const len = Math.hypot(out.x, out.y);
    if (len < 1e-6) {
      out.x = 0;
      out.y = 0;
    } else {
      out.x /= len;
      out.y /= len;
    }
    return out;
  }

  /** Stamp a trail along a polyline, used to seed the default foraging routes. */
  seedPath(points: readonly Vec2[], amount: number) {
    for (const p of points) this.deposit(p.x, p.y, amount, 1);
  }

  update(dt: number) {
    const step = 1 / this.tuning.tickHz;
    this.acc += dt;
    let guard = 0;
    while (this.acc >= step && guard < 3) {
      this.tick(step);
      this.acc -= step;
      guard++;
    }
    if (guard === 3) this.acc = 0;
  }

  private tick(dt: number) {
    const { cols, rows, trailData: src, trailTmp: dst } = this;
    if (cols === 0) return;
    const decay = Math.exp(-dt * this.tuning.evaporation);
    const diffusion = this.tuning.diffusion;
    const keep = 1 - diffusion;

    for (let r = 0; r < rows; r++) {
      const row = r * cols;
      for (let c = 0; c < cols; c++) {
        const i = row + c;
        const v = src[i];
        const left = c > 0 ? src[i - 1] : v;
        const right = c < cols - 1 ? src[i + 1] : v;
        const up = r > 0 ? src[i - cols] : v;
        const down = r < rows - 1 ? src[i + cols] : v;
        dst[i] = (v * keep + (left + right + up + down) * diffusion * 0.25) * decay;
      }
    }
    this.trailData = dst;
    this.trailTmp = src;
    this.paintDecay(dt);
  }

  private paintDecay(dt: number) {
    const decay = Math.exp(-dt * this.tuning.paintDecay);
    const paint = this.paintData;
    for (let i = 0; i < paint.length; i++) paint[i] *= decay;
  }

  private combinedAt(i: number) {
    return this.trailData[i] + this.paintData[i] * this.tuning.paintWeight;
  }

  private depositInto(
    data: Float32Array,
    x: number,
    y: number,
    amount: number,
    radius: number,
  ) {
    const c0 = Math.floor(x / this.cellW);
    const r0 = Math.floor(y / this.cellH);
    const reach = Math.ceil(radius);
    const max = radius + 1;
    for (let r = r0 - reach; r <= r0 + reach; r++) {
      if (r < 0 || r >= this.rows) continue;
      for (let c = c0 - reach; c <= c0 + reach; c++) {
        if (c < 0 || c >= this.cols) continue;
        const dx = c - c0;
        const dy = r - r0;
        const d = Math.hypot(dx, dy);
        if (d > radius + 0.5) continue;
        const falloff = 1 - d / max;
        const i = r * this.cols + c;
        data[i] = clamp(data[i] + amount * falloff, 0, MAX_TRAIL);
      }
    }
  }
}

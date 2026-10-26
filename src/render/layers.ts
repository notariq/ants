import { TUNING } from "../config";
import type { Ant } from "../sim/ants";
import { clamp, hash3, lineGlyph, smoothstep } from "../sim/math";
import type { Box } from "../sim/types";
import type { World } from "../sim/world";
import type { CanvasPalette } from "../ui/theme";
import { CellGrid } from "./grid";
import {
  AMBIENT_RAMP,
  ANT_ABDOMEN,
  ANT_ABDOMEN_SWARM,
  ANT_HEAD,
  ANT_THORAX,
  PHEROMONE_RAMP,
} from "./glyphs";

const SHOCK_SPEED = 235;
const SHOCK_LIFE = 0.95;
const DIM_FLOOR = 0.16;

export class ColonyRenderer {
  readonly grid: CellGrid;
  private palette: CanvasPalette;
  private fontPx = 10;

  private ambient = new Uint16Array(0);
  private dim = new Float32Array(0);
  private boxes: Box[] = [];

  private antGlyph = new Uint16Array(0);
  private antRank = new Uint8Array(0);
  private antDim = new Float32Array(0);
  private readonly antBuckets: number[][] = [[], [], [], []];
  private readonly pheromoneBuckets: number[][] = [[], [], [], [], []];
  private readonly paintCells: number[] = [];

  constructor(canvas: HTMLCanvasElement, palette: CanvasPalette) {
    this.grid = new CellGrid(canvas);
    this.palette = palette;
  }

  setPalette(palette: CanvasPalette) {
    this.palette = palette;
  }

  resize(width: number, height: number, dpr: number) {
    this.grid.resize(width, height, dpr);
    const n = this.grid.cellCount;
    this.ambient = new Uint16Array(n);
    this.dim = new Float32Array(n);
    this.dim.fill(1);
    this.antGlyph = new Uint16Array(n);
    this.antRank = new Uint8Array(n);
    this.antDim = new Float32Array(n);
    this.fontPx = Math.max(8, Math.round(this.grid.cellH * TUNING.render.fontScale));
    this.rebuildAmbient();
    this.setAvoidBoxes(this.boxes);
  }

  /**
   * Fade the colony under DOM content so the text stays readable and the ants
   * have a soft, pressure-like boundary instead of a hard rectangle.
   */
  setAvoidBoxes(boxes: Box[]) {
    this.boxes = boxes;
    if (this.dim.length !== this.grid.cellCount) return;
    this.dim.fill(1);
    const { cellW, cellH, cols, rows } = this.grid;
    const pad = Math.max(22, cellW * 2.6);

    for (const box of boxes) {
      if (box.right <= box.left || box.bottom <= box.top) continue;
      const c0 = Math.max(0, Math.floor((box.left - pad) / cellW));
      const c1 = Math.min(cols - 1, Math.floor((box.right + pad) / cellW));
      const r0 = Math.max(0, Math.floor((box.top - pad) / cellH));
      const r1 = Math.min(rows - 1, Math.floor((box.bottom + pad) / cellH));

      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const x = c * cellW + cellW * 0.5;
          const y = r * cellH + cellH * 0.5;
          const dx = Math.max(box.left - x, 0, x - box.right);
          const dy = Math.max(box.top - y, 0, y - box.bottom);
          const d = Math.hypot(dx, dy);
          const factor =
            DIM_FLOOR + (1 - DIM_FLOOR) * smoothstep(0, pad, d);
          const i = r * cols + c;
          if (factor < this.dim[i]) this.dim[i] = factor;
        }
      }
    }
  }

  render(world: World) {
    const { ctx } = this.grid;
    if (this.grid.cols === 0) return;

    this.grid.clear();
    ctx.font = `600 ${this.fontPx}px ${this.grid.fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    this.drawAmbient();
    this.drawPheromone(world);
    this.drawShockwaves(world);
    this.drawAnts(world);
    ctx.globalAlpha = 1;
  }

  private rebuildAmbient() {
    const { cols, rows } = this.grid;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (hash3(c, r, 71) >= TUNING.render.ambientDensity) continue;
        const glyph =
          AMBIENT_RAMP[
            Math.floor(hash3(c, r, 93) * AMBIENT_RAMP.length) %
              AMBIENT_RAMP.length
          ];
        this.ambient[i] = glyph.charCodeAt(0);
      }
    }
  }

  private drawAmbient() {
    const { ctx, cols, cellW, cellH } = this.grid;
    ctx.fillStyle = this.palette.ambient;
    ctx.globalAlpha = this.palette.ambientAlpha;
    for (let i = 0; i < this.ambient.length; i++) {
      const code = this.ambient[i];
      if (!code) continue;
      const dim = this.dim[i];
      if (dim < 0.24) continue;
      const c = i % cols;
      const r = (i / cols) | 0;
      ctx.globalAlpha = this.palette.ambientAlpha * dim;
      ctx.fillText(
        String.fromCharCode(code),
        c * cellW + cellW * 0.5,
        r * cellH + cellH * 0.5 + 1,
      );
    }
    ctx.globalAlpha = 1;
  }

  private drawPheromone(world: World) {
    const { ctx, cols, cellW, cellH } = this.grid;
    const trail = world.field.trail;
    const paint = world.field.paint;
    if (trail.length !== this.dim.length) return;

    for (const bucket of this.pheromoneBuckets) bucket.length = 0;
    this.paintCells.length = 0;
    for (let i = 0; i < trail.length; i++) {
      const painted = paint[i];
      if (painted > 0.02) this.paintCells.push(i);
      const value = trail[i] + painted * TUNING.pheromone.paintWeight;
      if (value < 0.02) continue;
      const shown = Math.min(1, value * 0.78) * this.dim[i];
      if (shown < 0.04) continue;
      const level = Math.min(4, Math.floor(shown * 5));
      this.pheromoneBuckets[level].push(i);
    }

    ctx.fillStyle = this.palette.pheromone;
    for (let level = 0; level < this.pheromoneBuckets.length; level++) {
      const bucket = this.pheromoneBuckets[level];
      if (bucket.length === 0) continue;
      ctx.globalAlpha = this.palette.pheromoneAlpha[level];
      const glyph = PHEROMONE_RAMP[level];
      for (const i of bucket) {
        const c = i % cols;
        const r = (i / cols) | 0;
        ctx.fillText(
          glyph,
          c * cellW + cellW * 0.5,
          r * cellH + cellH * 0.5 + 1,
        );
      }
    }

    if (this.paintCells.length > 0) {
      ctx.fillStyle = this.palette.ant;
      for (const i of this.paintCells) {
        const dim = this.dim[i];
        if (dim < 0.06) continue;
        const c = i % cols;
        const r = (i / cols) | 0;
        ctx.globalAlpha =
          Math.min(0.82, 0.24 + paint[i] * 0.1) * dim;
        ctx.fillText(
          (c * 7 + r * 13) % 7 === 0 ? "@" : "#",
          c * cellW + cellW * 0.5,
          r * cellH + cellH * 0.5 + 1,
        );
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawShockwaves(world: World) {
    const { ctx, cols, cellW, cellH, rows } = this.grid;
    if (world.shocks.length === 0) return;

    ctx.fillStyle = this.palette.shock;
    for (const shock of world.shocks) {
      const age = world.time - shock.born;
      if (age < 0 || age >= SHOCK_LIFE) continue;
      const t = age / SHOCK_LIFE;

      for (let ring = 0; ring < 2; ring++) {
        const radius = 8 + Math.max(0, age - ring * 0.085) * SHOCK_SPEED;
        if (radius < cellW) continue;
        const band = cellW * (ring === 0 ? 0.8 : 0.55);
        const baseAlpha =
          Math.pow(1 - t, 1.65) *
          (ring === 0 ? 1 : 0.42) *
          this.palette.shockAlpha;

        const c0 = Math.max(0, Math.floor((shock.x - radius - band) / cellW));
        const c1 = Math.min(
          cols - 1,
          Math.floor((shock.x + radius + band) / cellW),
        );
        const r0 = Math.max(0, Math.floor((shock.y - radius - band) / cellH));
        const r1 = Math.min(
          rows - 1,
          Math.floor((shock.y + radius + band) / cellH),
        );

        for (let r = r0; r <= r1; r++) {
          for (let c = c0; c <= c1; c++) {
            const x = c * cellW + cellW * 0.5;
            const y = r * cellH + cellH * 0.5;
            const dx = x - shock.x;
            const dy = y - shock.y;
            const d = Math.hypot(dx, dy);
            if (Math.abs(d - radius) > band) continue;
            const i = r * cols + c;
            const dim = this.dim[i];
            if (dim < 0.22) continue;
            ctx.globalAlpha = baseAlpha * dim;
            ctx.fillText(
              ring === 1 ? "." : lineGlyph(-dy, dx),
              x,
              y + 1,
            );
          }
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawAnts(world: World) {
    const { ctx } = this.grid;
    const n = this.grid.cellCount;
    if (n === 0) return;

    this.antGlyph.fill(0);
    this.antRank.fill(0);
    this.antDim.fill(0);
    for (const bucket of this.antBuckets) bucket.length = 0;

    for (const ant of world.ants) this.stampAnt(ant);

    for (let i = 0; i < n; i++) {
      if (!this.antGlyph[i]) continue;
      const bucket = clamp(Math.floor(this.antDim[i] * 4), 0, 3);
      this.antBuckets[bucket].push(i);
    }

    ctx.fillStyle = this.palette.ant;
    for (let bucket = 0; bucket < this.antBuckets.length; bucket++) {
      const cells = this.antBuckets[bucket];
      if (cells.length === 0) continue;
      const strength = (bucket + 1) / 4;

      if (TUNING.render.cellTint) {
        ctx.globalAlpha = this.palette.tintAlpha * strength;
        ctx.fillStyle = this.palette.tint;
        for (const i of cells) {
          const c = i % this.grid.cols;
          const r = (i / this.grid.cols) | 0;
          ctx.fillRect(
            c * this.grid.cellW + 1,
            r * this.grid.cellH + 1,
            this.grid.cellW - 1,
            this.grid.cellH - 1,
          );
        }
        ctx.fillStyle = this.palette.ant;
      }

      ctx.globalAlpha = this.palette.antAlpha * strength;
      for (const i of cells) {
        ctx.fillText(
          String.fromCharCode(this.antGlyph[i]),
          this.grid.centerX(i),
          this.grid.centerY(i) + 1,
        );
      }
    }
    ctx.globalAlpha = 1;
  }

  private stampAnt(ant: Ant) {
    const { cellW, cellH } = this.grid;
    const dirX = Math.cos(ant.heading);
    const dirY = Math.sin(ant.heading);
    const perpX = -dirY;
    const perpY = dirX;
    const step = Math.max(cellW, cellH) * 0.85;
    const legReach = (cellW + cellH) * 0.5;
    const frame = Math.floor(ant.phase) & 1;
    const legAlong = frame === 0 ? 0.12 : -0.68;
    const legX = ant.x + dirX * step * legAlong;
    const legY = ant.y + dirY * step * legAlong;

    this.stampCell(
      legX + perpX * legReach,
      legY + perpY * legReach,
      lineGlyph(dirX + perpX, dirY + perpY).charCodeAt(0),
      1,
      0.3,
    );
    this.stampCell(
      legX - perpX * legReach,
      legY - perpY * legReach,
      lineGlyph(dirX - perpX, dirY - perpY).charCodeAt(0),
      1,
      0.3,
    );

    this.stampCell(
      ant.x - dirX * step,
      ant.y - dirY * step,
      (ant.swarm > 0.5 ? ANT_ABDOMEN_SWARM : ANT_ABDOMEN).charCodeAt(0),
      2,
    );
    this.stampCell(
      ant.x,
      ant.y,
      ANT_THORAX.charCodeAt(0),
      2,
    );
    this.stampCell(
      ant.x + dirX * step,
      ant.y + dirY * step,
      ANT_HEAD.charCodeAt(0),
      3,
    );
  }

  private stampCell(
    x: number,
    y: number,
    code: number,
    rank: number,
    strength = 1,
  ) {
    const i = this.grid.indexAt(x, y);
    if (i < 0) return;
    if (rank < this.antRank[i]) return;
    this.antRank[i] = rank;
    this.antGlyph[i] = code;
    this.antDim[i] = this.dim[i] * strength;
  }
}

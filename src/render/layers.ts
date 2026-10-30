import { TUNING } from "../config";
import type { Ant } from "../sim/ants";
import { legRootWorld } from "../sim/ants";
import {
  PART_ABDOMEN,
  PART_HEAD,
  bodyHalfWidth,
  bodyPart,
  solveLeg,
} from "../sim/ant-math";
import { clamp, hash3, lineGlyph } from "../sim/math";
import type { Box } from "../sim/types";
import {
  mix,
  packRgb,
  shade,
  type CanvasPalette,
  type Rgb,
} from "../ui/theme";
import { CellGrid } from "./grid";

// Dense glyphs concentration is controlled by the body texture below.
const AMBIENT_RAMP = [".", "`", "'", ",", ":"] as const;
const INTERIOR = " ..::''";
const BODY_FILL = 0.2;

/** Draws a small colony of large procedural ASCII ants over a grainy ground. */
export class ColonyRenderer {
  readonly grid: CellGrid;
  private palette: CanvasPalette;
  private fontPx = 10;

  private ambient = new Uint16Array(0);
  private cellGlyph = new Uint16Array(0);
  private cellColor = new Uint32Array(0);
  private cellAlpha = new Float32Array(0);
  private cellTile = new Uint32Array(0);
  private cellTileAlpha = new Float32Array(0);
  private cellDim = new Float32Array(0);
  private cellShadow = new Uint8Array(0);
  private boxes: Box[] = [];

  private styles = new Map<number, string>();
  private readonly root = { x: 0, y: 0 };
  private readonly pose = { kneeX: 0, kneeY: 0, footX: 0, footY: 0 };

  // Bind the renderer to the canvas and its initial palette.
  constructor(canvas: HTMLCanvasElement, palette: CanvasPalette) {
    this.grid = new CellGrid(canvas);
    this.palette = palette;
  }

  // Swap the canvas palette and rebuild cached style strings.
  setPalette(palette: CanvasPalette) {
    this.palette = palette;
    this.styles.clear();
  }

  // Resize the grid and reallocate every per-cell buffer.
  resize(width: number, height: number, dpr: number) {
    this.grid.resize(width, height, dpr);
    const n = this.grid.cellCount;
    this.ambient = new Uint16Array(n);
    this.cellGlyph = new Uint16Array(n);
    this.cellColor = new Uint32Array(n);
    this.cellAlpha = new Float32Array(n);
    this.cellTile = new Uint32Array(n);
    this.cellTileAlpha = new Float32Array(n);
    this.cellDim = new Float32Array(n).fill(1);
    this.cellShadow = new Uint8Array(n);
    this.fontPx = Math.max(8, Math.round(this.grid.cellH * TUNING.render.fontScale));
    this.rebuildAmbient();
    this.setAvoidBoxes(this.boxes);
  }

  /**
   * Fade the colony under DOM content so the text stays readable and the ants
   * have a soft boundary instead of a hard rectangle.
   */
  setAvoidBoxes(boxes: Box[]) {
    this.boxes = boxes;
    if (this.cellDim.length !== this.grid.cellCount) return;
    this.cellDim.fill(1);
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
          const t = clamp(d / pad, 0, 1);
          const factor = 0.15 + 0.85 * t * t * (3 - 2 * t);
          const i = r * cols + c;
          if (factor < this.cellDim[i]) this.cellDim[i] = factor;
        }
      }
    }
  }

  // Clear the frame, rasterize ants, then paint the ground beneath them.
  render(world: { ants: readonly Ant[] }) {
    const { ctx, dpr, cols } = this.grid;
    if (cols === 0) return;

    this.cellGlyph.fill(0);
    this.cellTileAlpha.fill(0);
    this.cellShadow.fill(0);

    for (const ant of world.ants) this.rasterizeAnt(ant);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = `600 ${this.fontPx}px ${this.grid.fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    this.drawAmbient();
    this.drawShadows();
    this.drawCells();
    ctx.globalAlpha = 1;
  }

  // Cache rgb() strings so per-glyph fills do not rebuild them.
  private style(rgb: number) {
    let s = this.styles.get(rgb);
    if (!s) {
      s = `rgb(${rgb >>> 16},${(rgb >>> 8) & 255},${rgb & 255})`;
      this.styles.set(rgb, s);
    }
    return s;
  }

  // Draw one glyph at a cell, respecting the content-dimming mask.
  private glyphAt(i: number, glyph: string, rgb: Rgb, alpha: number) {
    const { ctx, cellW, cellH, cols } = this.grid;
    const dim = this.cellDim[i];
    if (dim <= 0.01) return;
    ctx.globalAlpha = alpha * dim;
    ctx.fillStyle = this.style(packRgb(rgb));
    ctx.fillText(
      glyph,
      (i % cols) * cellW + cellW / 2,
      ((i / cols) | 0) * cellH + cellH / 2,
    );
  }

  // Sprinkle sparse soil glyphs across the grid.
  private rebuildAmbient() {
    const { cols, rows } = this.grid;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (hash3(c, r, 71) >= TUNING.render.ambientDensity) continue;
        const glyph =
          AMBIENT_RAMP[
            Math.floor(hash3(c, r, 93) * AMBIENT_RAMP.length) % AMBIENT_RAMP.length
          ];
        this.ambient[i] = glyph.charCodeAt(0);
      }
    }
  }

  // Draw the static soil grain beneath everything else.
  private drawAmbient() {
    for (let i = 0; i < this.ambient.length; i++) {
      const code = this.ambient[i];
      if (!code) continue;
      this.glyphAt(
        i,
        String.fromCharCode(code),
        this.palette.soil,
        TUNING.render.ambientAlpha,
      );
    }
  }

  // ── ants ──────────────────────────────────────────────────────────────

  // Colour a body segment, with uniform abdominal banding for anatomy.
  private bodyColor(part: number, r: number): Rgb {
    const p = this.palette;
    if (part === PART_HEAD) return mix(p.chitin, p.mouth, 0.32);
    if (part === PART_ABDOMEN) {
      const band = Math.sin((r + 0.3) * Math.PI * 9) > 0.55 ? 0.82 : 1;
      return shade(mix(p.chitin, p.bg, 0.07), band);
    }
    return p.chitin;
  }

  // Write one cell feature. Later writers (body, eyes) override legs.
  private setGlyph(
    x: number,
    y: number,
    glyph: string,
    rgb: Rgb,
    alpha: number,
    tile: Rgb | null = null,
    tileAlpha = 0,
  ) {
    const { cellW, cellH, cols, rows } = this.grid;
    const c = Math.floor(x / cellW);
    const r = Math.floor(y / cellH);
    if (c < 0 || r < 0 || c >= cols || r >= rows) return;
    const i = r * cols + c;
    this.cellGlyph[i] = glyph.charCodeAt(0);
    this.cellColor[i] = packRgb(rgb);
    this.cellAlpha[i] = alpha;
    if (tile) {
      this.cellTile[i] = packRgb(tile);
      this.cellTileAlpha[i] = tileAlpha;
    }
  }

  // Walk a world-space segment and stamp a direction-following glyph.
  private markSegment(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    rgb: Rgb,
    alpha: number,
  ) {
    const { cellW, cellH, cols, rows } = this.grid;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 0.5) return;
    const glyph = lineGlyph(dx, dy);
    const step = Math.max(1, Math.min(cellW, cellH) * 0.42);
    const count = Math.max(1, Math.ceil(len / step));
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const c = Math.floor((x1 + dx * t) / cellW);
      const r = Math.floor((y1 + dy * t) / cellH);
      if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
      const idx = r * cols + c;
      this.cellGlyph[idx] = glyph.charCodeAt(0);
      this.cellColor[idx] = packRgb(rgb);
      this.cellAlpha[idx] = alpha;
    }
  }

  // Draw all six two-segment legs, then knee and foot joints.
  private rasterizeLegs(ant: Ant) {
    const L = ant.length;
    const dim = this.palette.alpha;
    const legColor = this.palette.leg;
    for (const leg of ant.legs) {
      legRootWorld(ant, leg, this.root);
      solveLeg(
        this.root.x,
        this.root.y,
        leg.footX,
        leg.footY,
        leg.side,
        ant.heading,
        L,
        this.pose,
      );
      const alpha =
        (leg.planted ? 0.9 : 0.5 + 0.3 * (1 - leg.lift)) * dim;
      this.markSegment(
        this.root.x,
        this.root.y,
        this.pose.kneeX,
        this.pose.kneeY,
        legColor,
        alpha,
      );
      this.markSegment(
        this.pose.kneeX,
        this.pose.kneeY,
        this.pose.footX,
        this.pose.footY,
        legColor,
        alpha,
      );
      this.setGlyph(
        this.pose.kneeX,
        this.pose.kneeY,
        "+",
        shade(legColor, 0.85),
        alpha,
      );
      this.setGlyph(
        this.pose.footX,
        this.pose.footY,
        leg.planted ? "o" : "'",
        legColor,
        alpha,
      );
    }
  }

  // Two curved feelers rooted at the head, splayed into turns.
  private rasterizeAntennae(ant: Ant, cos: number, sin: number) {
    const L = ant.length;
    const leftX = -sin;
    const leftY = cos;
    const dim = this.palette.alpha;
    const color = mix(this.palette.bg, this.palette.leg, 0.92);
    const sweep = Math.sin(ant.gait * 0.035);
    const turn = clamp(ant.turn * 0.05, -0.25, 0.25);

    for (const side of [1, -1] as const) {
      const baseQ = 0.46 * L;
      const baseP = 0.05 * L * side;
      const rootX = ant.x + cos * baseQ + leftX * baseP;
      const rootY = ant.y + sin * baseQ + leftY * baseP;
      const splay = 0.24 + turn + sweep * 0.06 + side * 0.02;
      const a1 = ant.heading + side * splay;
      const a2 = ant.heading + side * (splay + 0.24);
      const a3 = ant.heading + side * (splay + 0.52);
      const midX = rootX + Math.cos(a1) * L * 0.08;
      const midY = rootY + Math.sin(a1) * L * 0.08;
      const tipX = midX + Math.cos(a2) * L * 0.1;
      const tipY = midY + Math.sin(a2) * L * 0.1;
      this.markSegment(rootX, rootY, midX, midY, color, 0.9 * dim);
      this.markSegment(midX, midY, tipX, tipY, color, 0.8 * dim);
      const curlX = tipX + Math.cos(a3) * L * 0.035;
      const curlY = tipY + Math.sin(a3) * L * 0.035;
      this.markSegment(tipX, tipY, curlX, curlY, color, 0.7 * dim);
    }
  }

  // Rasterize one ant: legs and shadow first, then chitin, then feelers.
  private rasterizeAnt(ant: Ant) {
    const { cellW, cellH, cols, rows } = this.grid;
    const L = ant.length;
    const cos = Math.cos(ant.heading);
    const sin = Math.sin(ant.heading);
    const leftX = -sin;
    const leftY = cos;
    const dim = this.palette.alpha;
    const bodyFill = BODY_FILL * dim;

    this.rasterizeLegs(ant);

    const extent = L * 0.7;
    const c0 = Math.max(0, Math.floor((ant.x - extent) / cellW));
    const c1 = Math.min(cols - 1, Math.floor((ant.x + extent) / cellW));
    const r0 = Math.max(0, Math.floor((ant.y - extent) / cellH));
    const r1 = Math.min(rows - 1, Math.floor((ant.y + extent) / cellH));
    const edgeBand = Math.hypot(cellW, cellH) * 0.6;

    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const x = c * cellW + cellW / 2;
        const y = r * cellH + cellH / 2;
        const dx = x - ant.x;
        const dy = y - ant.y;
        const q = dx * cos + dy * sin;
        const p = dx * leftX + dy * leftY;
        const rr = q / L;
        if (rr < -0.57 || rr > 0.53) continue;
        const w = bodyHalfWidth(rr) * L;
        if (w <= 0) continue;
        const edgeDist = w - Math.abs(p);
        if (edgeDist < -edgeBand) continue;

        const inside = edgeDist >= 0;
        const edge = edgeDist < edgeBand;
        const part = bodyPart(rr);
        const color = this.bodyColor(part, rr);
        const i = r * cols + c;

        if (inside) {
          const sx = Math.floor((x + L * 0.055) / cellW);
          const sy = Math.floor((y + L * 0.04) / cellH);
          if (sx >= 0 && sy >= 0 && sx < cols && sy < rows) {
            this.cellShadow[sy * cols + sx] = 1;
          }
        }

        if (edge) {
          const eps = 0.012;
          const slope =
            (bodyHalfWidth(rr + eps) - bodyHalfWidth(rr - eps)) / (2 * eps);
          const sideSign = p >= 0 ? 1 : -1;
          const tx = cos + leftX * sideSign * slope;
          const ty = sin + leftY * sideSign * slope;
          this.cellGlyph[i] = lineGlyph(tx, ty).charCodeAt(0);
          this.cellColor[i] = packRgb(shade(color, 0.62));
          this.cellAlpha[i] = 0.95 * dim;
          if (inside) {
            this.cellTile[i] = packRgb(color);
            this.cellTileAlpha[i] = bodyFill * 1.1;
          }
          continue;
        }

        const key = hash3(
          Math.round(rr * 90),
          Math.round(p / (L * 0.015)),
          ant.id,
        );
        const glyph =
          INTERIOR[Math.floor(key * INTERIOR.length) % INTERIOR.length];
        this.cellGlyph[i] = glyph.charCodeAt(0);
        this.cellColor[i] = packRgb(shade(color, 0.86));
        this.cellAlpha[i] = 0.45 * dim;
        this.cellTile[i] = packRgb(color);
        this.cellTileAlpha[i] = bodyFill;
      }
    }

    // Eyes sit on the head, after the chitin texture.
    const eyeQ = 0.42 * L;
    const eyeP = 0.035 * L;
    const headColor = mix(this.palette.chitin, this.palette.mouth, 0.32);
    for (const side of [1, -1] as const) {
      const ex = ant.x + cos * eyeQ + leftX * eyeP * side;
      const ey = ant.y + sin * eyeQ + leftY * eyeP * side;
      this.setGlyph(
        ex,
        ey,
        "o",
        mix(headColor, this.palette.mouth, 0.7),
        0.95 * dim,
      );
    }

    this.rasterizeAntennae(ant, cos, sin);
  }

  // ── ground ────────────────────────────────────────────────────────────

  // Offset contact shadows so ants feel like they sit above the soil.
  private drawShadows() {
    const { cellShadow, cellGlyph, palette } = this;
    for (let i = 0; i < cellShadow.length; i++) {
      if (!cellShadow[i] || cellGlyph[i]) continue;
      this.glyphAt(i, ":", palette.shadow, palette.shadowAlpha);
    }
  }

  // Paint each rasterized ant cell: tile wash first, glyph on top.
  private drawCells() {
    const { ctx, cellW, cellH, cols } = this.grid;
    const {
      cellGlyph,
      cellColor,
      cellAlpha,
      cellTile,
      cellTileAlpha,
      cellDim,
    } = this;
    for (let i = 0; i < cellGlyph.length; i++) {
      const code = cellGlyph[i];
      if (!code && cellTileAlpha[i] <= 0) continue;
      const x = (i % cols) * cellW;
      const y = ((i / cols) | 0) * cellH;
      if (cellTileAlpha[i] > 0) {
        ctx.globalAlpha = cellTileAlpha[i] * cellDim[i];
        ctx.fillStyle = this.style(cellTile[i]);
        ctx.fillRect(x + 1, y + 1, cellW - 1, cellH - 1);
      }
      if (!code || code === 32) continue;
      ctx.globalAlpha = cellAlpha[i] * cellDim[i];
      ctx.fillStyle = this.style(cellColor[i]);
      ctx.fillText(
        String.fromCharCode(code),
        x + cellW / 2,
        y + cellH / 2 + 1,
      );
    }
  }
}

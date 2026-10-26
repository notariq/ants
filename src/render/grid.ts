import { TUNING } from "../config";
import { clamp } from "../sim/math";

const FALLBACK_FONT =
  'ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace';

/** The ASCII cell grid and the one visible canvas it is drawn on. */
export class CellGrid {
  readonly ctx: CanvasRenderingContext2D;
  width = 0;
  height = 0;
  dpr = 1;
  cellW = 9;
  cellH = 13;
  cols = 0;
  rows = 0;
  fontFamily = FALLBACK_FONT;

  constructor(readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("2D canvas unavailable");
    this.ctx = ctx;
    const family = getComputedStyle(canvas).fontFamily.trim();
    if (family) this.fontFamily = family;
  }

  resize(width: number, height: number, dpr: number) {
    if (width < 1 || height < 1) return;
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.cellW = clamp(
      Math.round(width / TUNING.render.targetColumns),
      TUNING.render.minCell,
      TUNING.render.maxCell,
    );
    this.cellH = Math.round(this.cellW * TUNING.render.cellAspect);
    this.cols = Math.ceil(width / this.cellW);
    this.rows = Math.ceil(height / this.cellH);

    this.canvas.width = Math.max(1, Math.round(width * dpr));
    this.canvas.height = Math.max(1, Math.round(height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
  }

  get cellCount() {
    return this.cols * this.rows;
  }

  indexAt(x: number, y: number) {
    const c = Math.floor(x / this.cellW);
    const r = Math.floor(y / this.cellH);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return -1;
    return r * this.cols + c;
  }

  centerX(index: number) {
    return (index % this.cols) * this.cellW + this.cellW * 0.5;
  }

  centerY(index: number) {
    return Math.floor(index / this.cols) * this.cellH + this.cellH * 0.5;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }
}

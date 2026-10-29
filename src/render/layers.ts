import { TUNING } from "../config";
import type { Ant } from "../sim/ants";
import { hash3, smoothstep, TAU } from "../sim/math";
import type { Box } from "../sim/types";
import type { World } from "../sim/world";
import type { CanvasPalette } from "../ui/theme";
import { CellGrid } from "./grid";
import { AMBIENT_RAMP } from "./glyphs";
import {
  buildSprites,
  BODY_GLYPHS,
  type SpriteSet,
  type SpriteVariant,
} from "./sprites";

const DIM_FLOOR = 0.16;

interface TrailGhost {
  x: number;
  y: number;
  glyph: string;
  born: number;
}

export class ColonyRenderer {
  readonly grid: CellGrid;
  private palette: CanvasPalette;
  private fontPx = 10;

  private ambient = new Uint16Array(0);
  private dim = new Float32Array(0);
  private boxes: Box[] = [];

  private sprites: SpriteSet | null = null;
  private spriteKey = "";
  private readonly trails = new Map<number, TrailGhost[]>();

  constructor(canvas: HTMLCanvasElement, palette: CanvasPalette) {
    this.grid = new CellGrid(canvas);
    this.palette = palette;
  }

  setPalette(palette: CanvasPalette) {
    this.palette = palette;
    this.rebuildSprites();
  }

  resize(width: number, height: number, dpr: number) {
    this.grid.resize(width, height, dpr);
    const n = this.grid.cellCount;
    this.ambient = new Uint16Array(n);
    this.dim = new Float32Array(n);
    this.dim.fill(1);
    this.fontPx = Math.max(8, Math.round(this.grid.cellH * TUNING.render.fontScale));
    this.rebuildAmbient();
    this.rebuildSprites();
    this.setAvoidBoxes(this.boxes);
  }

  private rebuildSprites() {
    if (this.grid.width < 1 || this.grid.height < 1) {
      this.sprites = null;
      this.spriteKey = "";
      return;
    }
    const { antAbdomen, antBody, antLeg, antAntenna, antGlyph } = this.palette;
    const key = [
      TUNING.ant.cellPx,
      TUNING.ant.tileGap,
      TUNING.ant.headings,
      this.grid.dpr,
      this.grid.fontFamily,
      antAbdomen,
      antBody,
      antLeg,
      antAntenna,
      antGlyph,
    ].join("|");
    if (this.sprites && key === this.spriteKey) return;
    this.spriteKey = key;
    this.sprites = buildSprites({
      cellPx: TUNING.ant.cellPx,
      tileGap: TUNING.ant.tileGap,
      dpr: this.grid.dpr,
      headings: TUNING.ant.headings,
      palette: this.palette,
      fontFamily: this.grid.fontFamily,
    });
    this.trails.clear();
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

  private drawAnts(world: World) {
    const sprites = this.sprites;
    if (!sprites) return;

    const seen = new Set<number>();
    if (TUNING.ant.trailsEnabled) this.drawTrails(world, sprites);

    for (const ant of world.ants) {
      seen.add(ant.id);
      const variant = this.variantFor(ant, sprites);
      const cellPx = sprites.cellPx;
      const snapX = Math.round(ant.x / cellPx) * cellPx;
      const snapY = Math.round(ant.y / cellPx) * cellPx;
      const dim = this.dimAt(snapX, snapY);
      if (dim < 0.08) continue;

      const alpha = this.palette.antAlpha * dim;
      const dx = snapX - sprites.sizePx * 0.5;
      const dy = snapY - sprites.sizePx * 0.5;
      this.grid.ctx.globalAlpha = alpha;
      this.grid.ctx.drawImage(
        variant.canvas,
        dx,
        dy,
        sprites.sizePx,
        sprites.sizePx,
      );
      if (TUNING.ant.glyphFlicker > 0 && cellPx >= 7) {
        this.drawFlicker(ant, variant, dx, dy, alpha, world.time);
      }
    }

    for (const id of this.trails.keys()) {
      if (!seen.has(id)) this.trails.delete(id);
    }
    this.grid.ctx.globalAlpha = 1;
  }

  private variantFor(ant: Ant, sprites: SpriteSet): SpriteVariant {
    const heading =
      ((Math.round((ant.heading / TAU) * sprites.headings) % sprites.headings) +
        sprites.headings) %
      sprites.headings;
    const frame =
      Math.floor(ant.stride / TUNING.ant.strideLength) % sprites.frames;
    const skin = ant.id % sprites.skins;
    return sprites.variants[skin][heading][frame];
  }

  private drawFlicker(
    ant: Ant,
    variant: SpriteVariant,
    dx: number,
    dy: number,
    alpha: number,
    time: number,
  ) {
    if (variant.bodyTiles.length === 0) return;
    const tick = Math.floor(time * 7 + ant.id * 0.31);
    if (hash3(ant.id, tick, 91) >= TUNING.ant.glyphFlicker) return;

    const tile =
      variant.bodyTiles[
        Math.floor(
          hash3(ant.id, tick, 23) * variant.bodyTiles.length,
        ) % variant.bodyTiles.length
      ];
    if (!tile) return;

    const glyphIndex =
      Math.floor(hash3(ant.id, tick, 57) * BODY_GLYPHS.length) %
      BODY_GLYPHS.length;
    const glyph =
      BODY_GLYPHS[glyphIndex] === tile.glyph
        ? BODY_GLYPHS[(glyphIndex + 1) % BODY_GLYPHS.length]
        : BODY_GLYPHS[glyphIndex];

    const cellPx = TUNING.ant.cellPx;
    const gap = Math.max(0, Math.min(TUNING.ant.tileGap, cellPx - 1));
    const fillSize = Math.max(1, cellPx - gap);
    const x = dx + tile.x * cellPx;
    const y = dy + tile.y * cellPx;
    const { ctx } = this.grid;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = tile.fill;
    ctx.fillRect(x, y, fillSize, fillSize);
    ctx.fillStyle = this.palette.antGlyph;
    ctx.font = `700 ${Math.max(4, Math.round(cellPx * 0.66))}px ${this.grid.fontFamily}`;
    ctx.fillText(glyph, x + fillSize * 0.5, y + fillSize * 0.5 + 0.5);
  }

  private drawTrails(world: World, sprites: SpriteSet) {
    const life = TUNING.ant.trailLife;
    if (life <= 0) return;
    const { ctx } = this.grid;
    const cellPx = sprites.cellPx;
    ctx.fillStyle = this.palette.ant;

    for (const ant of world.ants) {
      let trail = this.trails.get(ant.id);
      if (!trail) {
        trail = [];
        this.trails.set(ant.id, trail);
      }

      const cutoff = world.time - life;
      while (trail.length > 0 && trail[0].born < cutoff) trail.shift();

      const snapX = Math.round(ant.x / cellPx) * cellPx;
      const snapY = Math.round(ant.y / cellPx) * cellPx;
      const last = trail[trail.length - 1];
      const variant = this.variantFor(ant, sprites);
      const moved =
        !last || Math.hypot(snapX - last.x, snapY - last.y) > cellPx * 1.4;
      const speed = Math.hypot(ant.vx, ant.vy);
      if (speed > 6 && moved && variant.bodyTiles.length > 0) {
        const tile =
          variant.bodyTiles[
            Math.floor(
              hash3(ant.id, trail.length + 3, 41) * variant.bodyTiles.length,
            ) % variant.bodyTiles.length
          ];
        if (tile) {
          trail.push({ x: snapX, y: snapY, glyph: tile.glyph, born: world.time });
          if (trail.length > 6) trail.shift();
        }
      }

      for (const point of trail) {
        const age = (world.time - point.born) / life;
        if (age < 0 || age >= 1) continue;
        const dim = this.dimAt(point.x, point.y);
        if (dim < 0.08) continue;
        ctx.globalAlpha = 0.18 * (1 - age) * dim;
        ctx.fillText(point.glyph, point.x, point.y + 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  private dimAt(x: number, y: number) {
    const index = this.grid.indexAt(x, y);
    return index >= 0 ? this.dim[index] : 1;
  }
}

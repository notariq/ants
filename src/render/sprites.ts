import { hash3, lineGlyph, TAU } from "../sim/math";
import type { CanvasPalette } from "../ui/theme";

export type AntPart = "A" | "H" | "T" | "B" | "L";

/**
 * Base ant bitmap, authored facing UP (north), 13 wide x 12 tall.
 * `.` empty, `A` antenna, `H` head, `T` thorax, `B` abdomen, `L` leg.
 */
export const BASE_SPRITE: readonly string[] = [
  ".....A.A.....",
  "..L..HHH..L..",
  "...L.HHH.L...",
  "....L.T.L....",
  ".LLLLTTTLLLL.",
  ".....TTT.....",
  "....LTTTL....",
  "...L..B..L...",
  "..L.BBBBB.L..",
  ".L..BBBBB..L.",
  "....BBBBB....",
  ".....BBB.....",
];

/**
 * Optional override grids, indexed by heading (0 = east, increasing clockwise).
 * Each override must be authored already oriented for that heading and be the
 * same square size as the generated variants. Leave empty unless a rotated
 * diagonal breaks up.
 */
export const HEADING_OVERRIDES: Partial<Record<number, readonly string[]>> = {};

/** How many deterministic glyph skins are pre-rendered. Ants pick one by id. */
export const SPRITE_SKINS = 5;

export const BODY_GLYPHS = ["X", "S", "%", "8", "@"] as const;
const ANTENNA_GLYPHS = ["'", ".", ":"] as const;

const TRIPOD_A: readonly (readonly [number, number])[] = [
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 8],
  [4, 9],
  [4, 10],
  [4, 11],
  [6, 4],
  [7, 3],
  [8, 2],
  [9, 1],
];

const TRIPOD_B: readonly (readonly [number, number])[] = [
  [1, 10],
  [2, 9],
  [3, 8],
  [4, 1],
  [4, 2],
  [4, 3],
  [4, 4],
  [6, 8],
  [7, 9],
  [8, 10],
  [9, 11],
];

const PART_CHARS = new Set<string>(["A", "H", "T", "B", "L"]);
const BODY_PARTS = new Set<AntPart>(["H", "T", "B"]);

type PartGrid = (AntPart | null)[][];

export interface SpriteTile {
  x: number;
  y: number;
  part: AntPart;
  glyph: string;
  fill: string;
}

export interface SpriteVariant {
  canvas: HTMLCanvasElement;
  bodyTiles: SpriteTile[];
}

export interface SpriteOptions {
  cellPx: number;
  tileGap: number;
  dpr: number;
  headings: number;
  palette: CanvasPalette;
  fontFamily: string;
  skins?: number;
}

export interface SpriteSet {
  cellPx: number;
  sizeCells: number;
  sizePx: number;
  headings: number;
  frames: number;
  skins: number;
  variants: SpriteVariant[][][];
}

function parseGrid(rows: readonly string[]): PartGrid {
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  return rows.map((row) =>
    Array.from({ length: width }, (_, c) => {
      const char = row[c];
      return char && PART_CHARS.has(char) ? (char as AntPart) : null;
    }),
  );
}

function shiftTripod(base: PartGrid, cells: readonly (readonly [number, number])[]) {
  const grid = base.map((row) => row.slice());
  const movable: [number, number][] = [];
  for (const [r, c] of cells) {
    if (base[r]?.[c] !== "L") continue;
    const next = base[r - 1]?.[c];
    if (next === undefined) continue;
    if (next !== null && next !== "L") continue;
    movable.push([r, c]);
  }
  for (const [r, c] of movable) grid[r][c] = null;
  for (const [r, c] of movable) grid[r - 1][c] = "L";
  return grid;
}

function rotateGrid(grid: PartGrid, heading: number, headings: number): PartGrid {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const size = Math.ceil(Math.hypot(width, height));
  const out: PartGrid = Array.from({ length: size }, () =>
    Array<AntPart | null>(size).fill(null),
  );

  const angle = (heading / headings) * TAU + Math.PI / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const sourceX = width / 2;
  const sourceY = height / 2;
  const dest = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const rx = x + 0.5 - dest;
      const ry = y + 0.5 - dest;
      const sourceColumn = Math.floor(rx * cos + ry * sin + sourceX);
      const sourceRow = Math.floor(-rx * sin + ry * cos + sourceY);
      if (
        sourceRow < 0 ||
        sourceColumn < 0 ||
        sourceRow >= height ||
        sourceColumn >= width
      ) {
        continue;
      }
      out[y][x] = grid[sourceRow][sourceColumn];
    }
  }
  return out;
}

function legGlyph(grid: PartGrid, x: number, y: number) {
  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;
  let count = 0;

  for (let r = -1; r <= 1; r++) {
    for (let c = -1; c <= 1; c++) {
      if (r === 0 && c === 0) continue;
      if (grid[y + r]?.[x + c] !== "L") continue;
      minX = Math.min(minX, c);
      maxX = Math.max(maxX, c);
      minY = Math.min(minY, r);
      maxY = Math.max(maxY, r);
      count++;
    }
  }

  if (count === 0) {
    for (let r = -1; r <= 1; r++) {
      for (let c = -1; c <= 1; c++) {
        if (r === 0 && c === 0) continue;
        const part = grid[y + r]?.[x + c];
        if (!part || !BODY_PARTS.has(part)) continue;
        minX = Math.min(minX, c);
        maxX = Math.max(maxX, c);
        minY = Math.min(minY, r);
        maxY = Math.max(maxY, r);
        count++;
      }
    }
  }

  if (count === 0) return "-";
  return lineGlyph(maxX - minX, maxY - minY);
}

function hashGlyph<T extends readonly string[]>(
  glyphs: T,
  seed: number,
  x: number,
  y: number,
  heading: number,
  frame: number,
) {
  const value = hash3(seed, x * 37 + y * 11, heading * 53 + frame * 7);
  return glyphs[Math.floor(value * glyphs.length) % glyphs.length];
}

function parseColor(color: string) {
  const value = color.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (hex) {
    let digits = hex[1];
    if (digits.length === 3) {
      digits = digits
        .split("")
        .map((char) => char + char)
        .join("");
    }
    const number = Number.parseInt(digits, 16);
    return {
      r: (number >> 16) & 255,
      g: (number >> 8) & 255,
      b: number & 255,
    };
  }

  const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(value);
  if (!rgb) return null;
  return {
    r: Number.parseFloat(rgb[1]),
    g: Number.parseFloat(rgb[2]),
    b: Number.parseFloat(rgb[3]),
  };
}

function shade(color: string, amount: number) {
  const rgb = parseColor(color);
  if (!rgb) return color;
  const factor = 1 + amount;
  const channel = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value * factor)));
  return `rgb(${channel(rgb.r)} ${channel(rgb.g)} ${channel(rgb.b)})`;
}

function colorForPart(part: AntPart, palette: CanvasPalette) {
  switch (part) {
    case "B":
      return palette.antAbdomen;
    case "L":
      return palette.antLeg;
    case "A":
      return palette.antAntenna;
    case "H":
    case "T":
    default:
      return palette.antBody;
  }
}

function renderVariant(
  grid: PartGrid,
  heading: number,
  frame: number,
  skin: number,
  options: SpriteOptions,
): SpriteVariant {
  const { cellPx, palette, fontFamily } = options;
  const sizeCells = grid.length;
  const detailed = cellPx >= 7;
  const gap = detailed ? Math.max(0, Math.min(options.tileGap, cellPx - 1)) : 0;
  const fillSize = Math.max(1, cellPx - gap);
  const sizePx = sizeCells * cellPx;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sizePx * options.dpr));
  canvas.height = Math.max(1, Math.round(sizePx * options.dpr));

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  ctx.setTransform(options.dpr, 0, 0, options.dpr, 0, 0);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${Math.max(4, Math.round(cellPx * 0.66))}px ${fontFamily}`;

  const bodyTiles: SpriteTile[] = [];

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const part = grid[r][c];
      if (!part) continue;

      const glyph =
        part === "L"
          ? legGlyph(grid, c, r)
          : part === "A"
            ? hashGlyph(ANTENNA_GLYPHS, skin + 17, c, r, heading, frame)
            : hashGlyph(BODY_GLYPHS, skin + 1, c, r, heading, frame);
      const variation =
        (hash3(skin + 11, c * 29 + r * 17, heading * 7 + frame * 13) - 0.5) *
        0.16;
      const fill = shade(colorForPart(part, palette), variation);
      const x = c * cellPx;
      const y = r * cellPx;

      ctx.fillStyle = fill;
      ctx.fillRect(x, y, fillSize, fillSize);
      if (detailed && glyph) {
        ctx.fillStyle = palette.antGlyph;
        ctx.fillText(glyph, x + fillSize * 0.5, y + fillSize * 0.5 + 0.5);
      }

      const tile: SpriteTile = { x: c, y: r, part, glyph, fill };
      if (BODY_PARTS.has(part)) bodyTiles.push(tile);
    }
  }

  return { canvas, bodyTiles };
}

export function buildSprites(options: SpriteOptions): SpriteSet {
  const base = parseGrid(BASE_SPRITE);
  const frames = [shiftTripod(base, TRIPOD_A), shiftTripod(base, TRIPOD_B)];
  const skins = options.skins ?? SPRITE_SKINS;
  const sizeCells = Math.ceil(
    Math.hypot(base[0]?.length ?? 0, base.length),
  );
  const variants: SpriteVariant[][][] = [];

  for (let skin = 0; skin < skins; skin++) {
    const headingVariants: SpriteVariant[][] = [];
    for (let heading = 0; heading < options.headings; heading++) {
      const override = HEADING_OVERRIDES[heading];
      const overrideGrid =
        override && override.length === sizeCells ? parseGrid(override) : null;
      const frameVariants: SpriteVariant[] = [];
      for (let frame = 0; frame < frames.length; frame++) {
        const grid =
          overrideGrid ?? rotateGrid(frames[frame], heading, options.headings);
        frameVariants.push(renderVariant(grid, heading, frame, skin, options));
      }
      headingVariants.push(frameVariants);
    }
    variants.push(headingVariants);
  }

  return {
    cellPx: options.cellPx,
    sizeCells,
    sizePx: sizeCells * options.cellPx,
    headings: options.headings,
    frames: frames.length,
    skins,
    variants,
  };
}

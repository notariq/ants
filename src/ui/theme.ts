export type ThemeName = "light" | "dark";

export type Rgb = [number, number, number];

interface PaletteTuning {
  shadowAlpha: number;
  /** Overall colony alpha. */
  alpha: number;
}

export interface CanvasPalette extends PaletteTuning {
  /** Page background, mixed into chitin shading. */
  bg: Rgb;
  /** Base chitin colour. */
  chitin: Rgb;
  /** Legs and antennae. */
  leg: Rgb;
  /** Eyes and dark head detail. */
  mouth: Rgb;
  /** Ambient soil grain. */
  soil: Rgb;
  shadow: Rgb;
}

const TUNING_BY_THEME: Record<ThemeName, PaletteTuning> = {
  light: { shadowAlpha: 0.16, alpha: 0.95 },
  dark: { shadowAlpha: 0.45, alpha: 0.92 },
};

const STORAGE_KEY = "theme";

export function getInitialTheme(): ThemeName {
  const attribute = document.documentElement.dataset.theme;
  if (attribute === "light" || attribute === "dark") return attribute;
  try {
    return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "dark";
  }
}

export function applyTheme(name: ThemeName) {
  const root = document.documentElement;
  root.dataset.theme = name;
  root.style.colorScheme = name;
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // Storage can be unavailable in private contexts; the theme still applies.
  }

  const background = getComputedStyle(root).getPropertyValue("--bg").trim();
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta && background) meta.content = background;
}

export function initTheme() {
  const name = getInitialTheme();
  applyTheme(name);
  return name;
}

export function toggleTheme(current: ThemeName) {
  const next: ThemeName = current === "light" ? "dark" : "light";
  applyTheme(next);
  return next;
}

/** Parse hex or rgb()/rgba() colors into channel values. */
function parseColor(color: string): Rgb | null {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color);
  if (hex) {
    let digits = hex[1];
    if (digits.length === 3) {
      digits = digits
        .split("")
        .map((char) => char + char)
        .join("");
    }
    const value = Number.parseInt(digits, 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  }

  const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(color);
  if (!rgb) return null;
  return [
    Number.parseFloat(rgb[1]),
    Number.parseFloat(rgb[2]),
    Number.parseFloat(rgb[3]),
  ];
}

/** Read the canvas palette from CSS so each theme owns its colors. */
export function readCanvasPalette(name: ThemeName): CanvasPalette {
  const styles = getComputedStyle(document.documentElement);
  const variable = (property: string, fallback: string): Rgb =>
    parseColor(styles.getPropertyValue(property).trim() || fallback) ?? [0, 0, 0];

  return {
    bg: variable("--canvas-bg", "#f4f2ed"),
    chitin: variable("--canvas-chitin", "#68625e"),
    leg: variable("--canvas-leg", "#8c867e"),
    mouth: variable("--canvas-mouth", "#181614"),
    soil: variable("--canvas-soil", "#96938a"),
    shadow: variable("--canvas-shadow", "#3c3a36"),
    ...TUNING_BY_THEME[name],
  };
}

// ── colour helpers shared with the renderer ──────────────────────────────

export const packRgb = (c: Rgb): number => (c[0] << 16) | (c[1] << 8) | c[2];

export const mix = (a: Rgb, b: Rgb, k: number): Rgb => [
  (a[0] + (b[0] - a[0]) * k) | 0,
  (a[1] + (b[1] - a[1]) * k) | 0,
  (a[2] + (b[2] - a[2]) * k) | 0,
];

export const shade = (c: Rgb, k: number): Rgb => [
  Math.min(255, c[0] * k) | 0,
  Math.min(255, c[1] * k) | 0,
  Math.min(255, c[2] * k) | 0,
];

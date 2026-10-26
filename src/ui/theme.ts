export type ThemeName = "light" | "dark";

export interface CanvasPalette {
  ant: string;
  pheromone: string;
  ambient: string;
  shock: string;
  tint: string;
  antAlpha: number;
  pheromoneAlpha: readonly number[];
  ambientAlpha: number;
  shockAlpha: number;
  tintAlpha: number;
}

const ALPHAS: Record<
  ThemeName,
  Pick<
    CanvasPalette,
    | "antAlpha"
    | "pheromoneAlpha"
    | "ambientAlpha"
    | "shockAlpha"
    | "tintAlpha"
  >
> = {
  light: {
    antAlpha: 0.92,
    pheromoneAlpha: [0.12, 0.17, 0.23, 0.3, 0.38],
    ambientAlpha: 0.075,
    shockAlpha: 0.42,
    tintAlpha: 0.055,
  },
  dark: {
    antAlpha: 0.9,
    pheromoneAlpha: [0.13, 0.19, 0.26, 0.34, 0.44],
    ambientAlpha: 0.09,
    shockAlpha: 0.5,
    tintAlpha: 0.075,
  },
};

const STORAGE_KEY = "theme";
const listeners = new Set<(name: ThemeName) => void>();

export function getInitialTheme(): ThemeName {
  const attribute = document.documentElement.dataset.theme;
  if (attribute === "light" || attribute === "dark") return attribute;
  try {
    return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
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

  for (const listener of listeners) listener(name);
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

export function onThemeChange(listener: (name: ThemeName) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function readCanvasPalette(name: ThemeName): CanvasPalette {
  const styles = getComputedStyle(document.documentElement);
  const variable = (property: string, fallback: string) =>
    styles.getPropertyValue(property).trim() || fallback;

  return {
    ant: variable("--canvas-ant", "#121211"),
    pheromone: variable("--canvas-pheromone", "#5e5b54"),
    ambient: variable("--canvas-ambient", "#8b887f"),
    shock: variable("--canvas-shock", "#2a2a28"),
    tint: variable("--canvas-tint", "#34322d"),
    ...ALPHAS[name],
  };
}

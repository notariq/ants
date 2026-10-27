import "./styles.css";
import { CONTENT } from "./config";
import { ColonyEngine } from "./engine";
import {
  initTheme,
  readCanvasPalette,
  toggleTheme,
  type ThemeName,
} from "./ui/theme";
import { Typewriter } from "./ui/typewriter";

function must<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}

function placeholderLink(link: HTMLAnchorElement) {
  if (link.getAttribute("href") === "#") {
    link.addEventListener("click", (event) => event.preventDefault());
  }
}

let theme: ThemeName = initTheme();
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const MOTION_KEY = "colony-motion";

function readMotionOverride() {
  try {
    return localStorage.getItem(MOTION_KEY) === "on";
  } catch {
    return false;
  }
}

function storeMotionOverride(enabled: boolean) {
  try {
    localStorage.setItem(MOTION_KEY, enabled ? "on" : "off");
  } catch {
    // The toggle still works for this session if storage is unavailable.
  }
}

const nav = must<HTMLElement>("#site-nav");
for (const item of CONTENT.nav) {
  const link = document.createElement("a");
  link.href = item.href;
  link.textContent = item.label;
  if (item.active) link.setAttribute("aria-current", "page");
  placeholderLink(link);
  nav.append(link);
}

const themeButton = document.createElement("button");
themeButton.type = "button";
nav.append(themeButton);

const motionButton = document.createElement("button");
motionButton.type = "button";
motionButton.className = "motion-toggle";
motionButton.hidden = true;
nav.append(motionButton);

function paintThemeButton(name: ThemeName) {
  const next = name === "light" ? "dark" : "light";
  themeButton.textContent = next;
  themeButton.setAttribute("aria-label", `Switch to ${next} theme`);
  themeButton.title = `Switch to ${next} theme`;
}
paintThemeButton(theme);

const tagline = must<HTMLElement>("#tagline");
tagline.textContent = CONTENT.tagline;

const introFull = must<HTMLElement>("#intro-full");
const introTyped = must<HTMLElement>("#intro-typed");
introFull.textContent = CONTENT.intro;

const socials = must<HTMLElement>("#socials");
CONTENT.socials.forEach((social, index) => {
  if (index > 0) {
    const separator = document.createElement("span");
    separator.className = "separator";
    separator.textContent = " / ";
    socials.append(separator);
  }
  const link = document.createElement("a");
  link.href = social.href;
  link.textContent = social.label;
  if (/^https?:/i.test(social.href)) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  } else {
    placeholderLink(link);
  }
  socials.append(link);
});


const canvas = must<HTMLCanvasElement>("#colony");
const engine = new ColonyEngine(canvas, readCanvasPalette(theme));

if (readMotionOverride()) engine.setMotionEnabled(true);

function syncMotionButton() {
  motionButton.hidden = !reducedMotion.matches;
  if (motionButton.hidden) return;
  const enabled = engine.motionEnabled;
  motionButton.textContent = enabled ? "still" : "animate";
  motionButton.setAttribute("aria-pressed", String(enabled));
  motionButton.setAttribute(
    "aria-label",
    enabled ? "Pause colony animation" : "Start colony animation",
  );
  motionButton.title = enabled
    ? "Pause the colony and keep a still frame"
    : "Start the colony (system reduced motion is on)";
}

syncMotionButton();
reducedMotion.addEventListener("change", syncMotionButton);

motionButton.addEventListener("click", () => {
  const enabled = !engine.motionEnabled;
  engine.setMotionEnabled(enabled);
  storeMotionOverride(enabled);
  syncMotionButton();
});

themeButton.addEventListener("click", () => {
  theme = toggleTheme(theme);
  paintThemeButton(theme);
  engine.setPalette(readCanvasPalette(theme));
});

const typewriter = new Typewriter(introTyped, CONTENT.intro);
typewriter.start();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    reducedMotion.removeEventListener("change", syncMotionButton);
    engine.destroy();
    typewriter.destroy();
  });
}

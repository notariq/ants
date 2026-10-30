import "./styles.css";
import { CONTENT } from "./config";
import { ColonyEngine } from "./engine";
import { aboutPage } from "./pages/about";
import { antPage } from "./pages/projects";
import { createRouter } from "./router";
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

function readMotionOverride(): boolean | null {
  try {
    const value = localStorage.getItem(MOTION_KEY);
    if (value === "on") return true;
    if (value === "off") return false;
    return null;
  } catch {
    return null;
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
const navLinks: HTMLAnchorElement[] = [];
for (const item of CONTENT.nav) {
  const link = document.createElement("a");
  link.href = item.href;
  link.textContent = item.label;
  placeholderLink(link);
  nav.append(link);
  navLinks.push(link);
}

const motionButton = document.createElement("button");
motionButton.type = "button";
motionButton.className = "motion-toggle";
nav.append(motionButton);

const themeButton = document.createElement("button");
themeButton.type = "button";
nav.append(themeButton);


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
introFull.textContent = `${CONTENT.intro.name} (${CONTENT.intro.alias})`;

const socials = must<HTMLElement>("#socials");
CONTENT.socials.forEach((social, index) => {
  if (index > 0) {
    const separator = document.createElement("span");
    separator.className = "separator";
    separator.textContent = " ";
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

const storedMotion = readMotionOverride();
if (storedMotion !== null) engine.setMotionEnabled(storedMotion);

function syncMotionButton() {
  const enabled = engine.motionEnabled;
  motionButton.textContent = enabled ? "still" : "animate";
  motionButton.setAttribute("aria-pressed", String(enabled));
  motionButton.setAttribute(
    "aria-label",
    enabled ? "Pause colony animation" : "Start colony animation",
  );
  motionButton.title = enabled
    ? "Pause the colony and keep a still frame"
    : "Start the colony animation";
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

const typewriter = new Typewriter(introTyped);
let typewriterStarted = false;

function startTypewriter() {
  if (typewriterStarted) return;
  typewriterStarted = true;
  typewriter.play([CONTENT.intro.name, CONTENT.intro.alias]);
}

function syncNav(path: string) {
  const currentHref = path === "/" ? "#/" : `#${path}`;
  for (const link of navLinks) {
    if (link.getAttribute("href") === currentHref) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  }
}

const pageRoot = must<HTMLElement>("#page-root");

const router = createRouter({
  pages: [aboutPage, antPage],
  home: must<HTMLElement>("#view-home"),
  outlet: pageRoot,
  onChange(path) {
    const home = path === "/";
    canvas.hidden = !home;
    engine.setActive(home);
    syncNav(path);
    if (home) startTypewriter();
  },
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    reducedMotion.removeEventListener("change", syncMotionButton);
    router.destroy();
    engine.destroy();
    typewriter.destroy();
  });
}

export interface SocialLink {
  label: string;
  href: string;
}

export interface NavItem {
  label: string;
  href: string;
}

export const CONTENT = {
  tagline: "A thousand paths begin here. I'm",
  intro: {
    alias: "notariq",
    name: "Hauzan Ariq Bakri",
  },
  socials: [
    { label: "github", href: "https://github.com/notariq" },
    { label: "twitter", href: "https://x.com/_notariq" },
    { label: "linkedin", href: "#" },
  ] satisfies SocialLink[],
  nav: [
    { label: "ants", href: "#/" },
    { label: "projects", href: "#/projects" },
    { label: "about", href: "#/about" },
  ] satisfies NavItem[],
};

export const TUNING = {
  render: {
    targetColumns: 160,
    minCell: 8,
    maxCell: 11,
    cellAspect: 1.45,
    maxDpr: 2,
    ambientDensity: 0.03,
    ambientAlpha: 0.08,
    fontScale: 0.78,
  },
  ant: {
    count: 6,
    minCount: 4,
    maxCount: 6,
    lengthSideFraction: 0.3,
    lengthMin: 140,
    lengthMax: 340,
    separationFraction: 0.95,
    collisionFraction: 0.72,
    strideFraction: 0.28,
    duty: 0.55,
    wanderTurn: 1.1,
    wanderMin: 2.4,
    wanderMax: 6,
  },
  world: {
    wanderSpeed: 44,
    edgeMargin: 30,
    exitMargin: 180,
    entryInset: 32,
    avoidMargin: 40,
    avoidForce: 360,
    hoverRadius: 64,
    hoverForce: 80,
    step: 1 / 60,
    maxSteps: 4,
  },
  pointer: {
    scatterRadius: 300,
    burstSpeed: 240,
  },
  swarm: {
    blendSeconds: 0.65,
    separationRadius: 15,
    neighborRadius: 46,
    separationForce: 320,
    alignmentForce: 2.2,
    cohesionForce: 25,
    attractionForce: 60,
    maxSpeed: 190,
  },
} as const;

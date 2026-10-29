export interface InlineLink {
  label: string;
  href: string;
}

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
    { label: "github", href: "#" },
    { label: "twitter", href: "#" },
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
    targetColumns: 124,
    minCell: 8,
    maxCell: 13,
    cellAspect: 1.45,
    maxDpr: 2,
    ambientDensity: 0.037,
    fontScale: 0.74,
  },
  ant: {
    count: 12,
    minCount: 6,
    maxCount: 24,
    cellPx: 12,
    tileGap: 1,
    headings: 8,
    glyphFlicker: 0.02,
    trailsEnabled: true,
    trailLife: 0.45,
    strideLength: 9,
    separationRadius: 150,
    separationForce: 320,
    collisionDistance: 112,
    wanderTurn: 1.35,
    wanderMin: 2.4,
    wanderMax: 6,
  },
  world: {
    wanderSpeed: 26,
    edgeMargin: 22,
    exitMargin: 130,
    entryInset: 24,
    avoidMargin: 30,
    avoidForce: 380,
    hoverRadius: 38,
    hoverForce: 110,
    step: 1 / 60,
    maxSteps: 4,
  },
  pointer: {
    scatterRadius: 215,
    burstSpeed: 255,
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

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
  active?: boolean;
}

export const CONTENT = {
  tagline: "A thousand paths begin here. Hi, I'm",
  intro: "notariq",
  socials: [
    { label: "github", href: "#" },
    { label: "twitter", href: "#" },
    { label: "linkedin", href: "#" },
  ] satisfies SocialLink[],
  nav: [
    { label: "home", href: "#", active: true },
    { label: "projects", href: "#" },
    { label: "gallery", href: "#" },
    { label: "blog", href: "#" },
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
    maxCount: 12,
    cellPx: 8,
    tileGap: 1,
    headings: 8,
    glyphFlicker: 0.02,
    trailsEnabled: true,
    trailLife: 0.45,
    strideLength: 9,
    separationRadius: 150,
    separationForce: 320,
    collisionDistance: 112,
  },
  world: {
    nest: { x: 0.56, y: 0.52 },
    foods: [
      { x: 0.16, y: 0.24 },
      { x: 0.43, y: 0.15 },
      { x: 0.9, y: 0.38 },
      { x: 0.3, y: 0.46 },
    ],
    forageSpeed: 24,
    returnSpeed: 33,
    foodRadius: 60,
    nestRadius: 110,
    edgeMargin: 22,
    avoidMargin: 30,
    avoidForce: 380,
    hoverRadius: 38,
    hoverForce: 110,
    step: 1 / 60,
    maxSteps: 4,
  },
  pheromone: {
    tickHz: 30,
    evaporation: 0.075,
    diffusion: 0.08,
    seedAmount: 0.7,
    depositReturn: 11,
    depositOut: 3.2,
    paintWeight: 1.6,
    paintDeposit: 2.4,
    paintRadius: 0.25,
    paintSpacing: 5,
    paintDecay: 0.14,
    paintHold: 4.5,
    maxPaint: 10,
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
    fieldForce: 45,
    maxSpeed: 190,
  },
} as const;

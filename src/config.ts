export interface InlineLink {
  label: string;
  href: string;
}

export type BioSegment = string | InlineLink;

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
  tagline: "[MY TAGLINE]",
  intro: "[MY INTRO LINE]",
  bio: [
    [
      "i build ",
      { label: "[THINGS I BUILD]", href: "#" },
      " and write about ",
      { label: "[THINGS I THINK ABOUT]", href: "#" },
      ".",
    ],
    [
      "currently ",
      { label: "[WHERE I AM]", href: "#" },
      ", working on ",
      { label: "[WHAT I AM MAKING]", href: "#" },
      ".",
    ],
    [
      "previously ",
      { label: "[SOMETHING ELSE]", href: "#" },
      ".",
    ],
  ] satisfies BioSegment[][],
  socials: [
    { label: "github", href: "#" },
    { label: "linkedin", href: "#" },
    { label: "x", href: "#" },
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
    cellTint: false,
    fontScale: 0.74,
  },
  world: {
    minAnts: 100,
    maxAnts: 240,
    antArea: 12000,
    nest: { x: 0.78, y: 0.64 },
    foods: [
      { x: 0.16, y: 0.24 },
      { x: 0.43, y: 0.15 },
      { x: 0.9, y: 0.38 },
    ],
    forageSpeed: 24,
    returnSpeed: 29,
    foodRadius: 12,
    nestRadius: 16,
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
    seedAmount: 1.15,
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

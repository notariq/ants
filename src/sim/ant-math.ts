import { clamp } from "./math";

/** Body strata used to shade the head, thorax, and abdomen differently. */
export const PART_HEAD = 1;
export const PART_THORAX = 2;
export const PART_ABDOMEN = 3;
export const PART_LEG = 4;
export const PART_ANTENNA = 5;

interface Lobe {
  q: number;
  rq: number;
  rp: number;
}

// Three overlapping lobes plus a petiole bridge, in body-length fractions.
const LOBES: readonly Lobe[] = [
  { q: 0.38, rq: 0.115, rp: 0.075 },
  { q: 0.16, rq: 0.18, rp: 0.068 },
  { q: -0.03, rq: 0.075, rp: 0.038 },
  { q: -0.29, rq: 0.245, rp: 0.135 },
];

/** Half-width of the body at forward position `r` (fractions of length). */
export function bodyHalfWidth(r: number): number {
  let half = 0;
  for (const lobe of LOBES) {
    const t = (r - lobe.q) / lobe.rq;
    if (t <= -1 || t >= 1) continue;
    const w = lobe.rp * Math.sqrt(1 - t * t);
    if (w > half) half = w;
  }
  return half;
}

/** Which body segment owns the forward position `r`. */
export function bodyPart(r: number) {
  if (r > 0.3) return PART_HEAD;
  if (r > -0.07) return PART_THORAX;
  return PART_ABDOMEN;
}

/** A leg's fixed geometry, in body-length fractions. */
export interface LegSpec {
  side: 1 | -1;
  pair: 0 | 1 | 2;
  /** Hip position along the body, + forward. */
  rootQ: number;
  /** Resting foot position. */
  restQ: number;
  restP: number;
  /** Gait phase offset: 0 for tripod A, 0.5 for tripod B. */
  offset: number;
}

// Left-front, right-middle, left-hind share tripod A; the others tripod B.
// Small pair offsets make the tripod step as a wave instead of a single block.
export const LEG_SPECS: readonly LegSpec[] = [
  { side: 1, pair: 0, rootQ: 0.24, restQ: 0.36, restP: 0.27, offset: 0 },
  { side: -1, pair: 0, rootQ: 0.24, restQ: 0.36, restP: 0.27, offset: 0.5 },
  { side: 1, pair: 1, rootQ: 0.1, restQ: 0.06, restP: 0.32, offset: 0.02 },
  { side: -1, pair: 1, rootQ: 0.1, restQ: 0.06, restP: 0.32, offset: 0.52 },
  { side: 1, pair: 2, rootQ: -0.03, restQ: -0.26, restP: 0.28, offset: 0.04 },
  { side: -1, pair: 2, rootQ: -0.03, restQ: -0.26, restP: 0.28, offset: 0.54 },
];

/** Femur and tibia lengths for a body length, plus the maximum reach. */
export function legLengths(length: number) {
  const femur = length * 0.16;
  const tibia = length * 0.26;
  return { femur, tibia, reach: femur + tibia };
}

export interface LegPose {
  kneeX: number;
  kneeY: number;
  footX: number;
  footY: number;
}

/**
 * Solve a two-bone leg for the knee position. The foot is pulled onto the
 * reachable circle if the target is too far, and the knee is chosen on the
 * outward side so it bends like an insect leg instead of collapsing inward.
 */
export function solveLeg(
  rootX: number,
  rootY: number,
  targetX: number,
  targetY: number,
  side: 1 | -1,
  heading: number,
  length: number,
  out: LegPose,
): LegPose {
  const { femur, tibia, reach } = legLengths(length);
  let dx = targetX - rootX;
  let dy = targetY - rootY;
  let dist = Math.hypot(dx, dy);
  if (dist < 1e-4) {
    dx = Math.cos(heading);
    dy = Math.sin(heading);
    dist = 1;
  }
  const ux = dx / dist;
  const uy = dy / dist;
  const clamped = clamp(dist, Math.abs(femur - tibia) + 1, reach - 1);
  const footX = rootX + ux * clamped;
  const footY = rootY + uy * clamped;

  const base = Math.atan2(uy, ux);
  const cosKnee = clamp(
    (femur * femur + clamped * clamped - tibia * tibia) / (2 * femur * clamped),
    -1,
    1,
  );
  const bend = Math.acos(cosKnee);
  const outwardX = -Math.sin(heading) * side;
  const outwardY = Math.cos(heading) * side;

  const a1 = base + bend;
  const a2 = base - bend;
  const k1x = rootX + Math.cos(a1) * femur;
  const k1y = rootY + Math.sin(a1) * femur;
  const k2x = rootX + Math.cos(a2) * femur;
  const k2y = rootY + Math.sin(a2) * femur;
  const d1 = (k1x - rootX) * outwardX + (k1y - rootY) * outwardY;
  const d2 = (k2x - rootX) * outwardX + (k2y - rootY) * outwardY;

  out.kneeX = d1 >= d2 ? k1x : k2x;
  out.kneeY = d1 >= d2 ? k1y : k2y;
  out.footX = footX;
  out.footY = footY;
  return out;
}

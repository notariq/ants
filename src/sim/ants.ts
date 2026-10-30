import { TUNING } from "../config";
import {
  LEG_SPECS,
  bodyHalfWidth,
  legLengths,
  type LegSpec,
} from "./ant-math";
import { angleDiff, clamp, rand, smoothstep } from "./math";
import type { Vec2 } from "./types";

type AntTuning = typeof TUNING.ant;

/** One of the six legs, with its planted foot and current swing state. */
export interface Leg {
  side: 1 | -1;
  pair: number;
  /** Hip position along the body, + forward. */
  rootQ: number;
  /** Resting foot position, in body fractions. */
  restQ: number;
  restP: number;
  /** Tripod phase offset. */
  offset: number;
  /** Gait cycle in [0, 1). */
  cycle: number;
  planted: boolean;
  lift: number;
  footX: number;
  footY: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

/** Mutable state for one ant. */
export interface Ant {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  heading: number;
  /** 0 wandering, 1 full swarm. Smoothly blended. */
  swarm: number;
  swarmTarget: 0 | 1;
  pause: number;
  wander: number;
  wanderFreq: number;
  wanderAmp: number;
  wanderAngle: number;
  wanderTimer: number;
  speedScale: number;
  /** Body length in canvas pixels. */
  length: number;
  /** Smoothed angular velocity, splays antennae and shifts steps into turns. */
  turn: number;
  /** Distance travelled, drives the walk cycle so stopped ants freeze. */
  gait: number;
  legs: Leg[];
}

/** Resting foot position in world space. */
function legRestWorld(ant: Ant, leg: Leg, out: Vec2) {
  const q = leg.restQ * ant.length;
  const p = leg.restP * leg.side * ant.length;
  const cos = Math.cos(ant.heading);
  const sin = Math.sin(ant.heading);
  out.x = ant.x + cos * q - sin * p;
  out.y = ant.y + sin * q + cos * p;
  return out;
}

/** Hip position in world space. */
export function legRootWorld(ant: Ant, leg: Leg, out: Vec2) {
  const q = leg.rootQ * ant.length;
  const p = bodyHalfWidth(leg.rootQ) * leg.side * ant.length;
  const cos = Math.cos(ant.heading);
  const sin = Math.sin(ant.heading);
  out.x = ant.x + cos * q - sin * p;
  out.y = ant.y + sin * q + cos * p;
  return out;
}

/** Keep a foot inside its leg's reach while the body turns or gets pushed. */
function clampFoot(ant: Ant, leg: Leg) {
  const L = ant.length;
  const cos = Math.cos(ant.heading);
  const sin = Math.sin(ant.heading);
  const leftX = -sin;
  const leftY = cos;
  const q = leg.rootQ * L;
  const p = bodyHalfWidth(leg.rootQ) * leg.side * L;
  const rootX = ant.x + cos * q + leftX * p;
  const rootY = ant.y + sin * q + leftY * p;
  const reach = legLengths(L).reach * 0.94;
  let dx = leg.footX - rootX;
  let dy = leg.footY - rootY;
  const d = Math.hypot(dx, dy);
  if (d <= reach) return;
  dx /= d;
  dy /= d;
  leg.footX = rootX + dx * reach;
  leg.footY = rootY + dy * reach;
}

/** Put all six feet back on their resting spots. */
export function resetLegs(ant: Ant) {
  const scratch: Vec2 = { x: 0, y: 0 };
  for (const leg of ant.legs) {
    legRestWorld(ant, leg, scratch);
    leg.cycle = leg.offset;
    leg.planted = true;
    leg.lift = 0;
    leg.footX = scratch.x;
    leg.footY = scratch.y;
    leg.fromX = scratch.x;
    leg.fromY = scratch.y;
    leg.toX = scratch.x;
    leg.toY = scratch.y;
  }
}

function createLeg(spec: LegSpec): Leg {
  return {
    side: spec.side,
    pair: spec.pair,
    rootQ: spec.rootQ,
    restQ: spec.restQ,
    restP: spec.restP,
    offset: spec.offset,
    cycle: spec.offset,
    planted: true,
    lift: 0,
    footX: 0,
    footY: 0,
    fromX: 0,
    fromY: 0,
    toX: 0,
    toY: 0,
  };
}

/** Create an ant at a position with a randomized walk profile and planted feet. */
export function createAnt(
  id: number,
  x: number,
  y: number,
  heading: number,
  speed: number,
  length: number,
): Ant {
  const ant: Ant = {
    id,
    x,
    y,
    vx: Math.cos(heading) * speed,
    vy: Math.sin(heading) * speed,
    heading,
    swarm: 0,
    swarmTarget: 0,
    pause: 0,
    wander: Math.random() * Math.PI * 2,
    wanderFreq: rand(0.7, 1.7),
    wanderAmp: rand(0.22, 0.48),
    wanderAngle: heading,
    wanderTimer: 0,
    speedScale: 0.86 + Math.random() * 0.28,
    length,
    turn: 0,
    gait: Math.random() * length,
    legs: LEG_SPECS.map(createLeg),
  };
  resetLegs(ant);
  return ant;
}

/**
 * Direction for a wandering ant. The ant holds a rough heading for a few
 * seconds, then picks a nearby new one. A little sine wobble keeps the motion
 * from looking mechanical.
 */
export function wanderDirection(
  ant: Ant,
  time: number,
  tuning: AntTuning,
  out: Vec2,
) {
  if (time >= ant.wanderTimer) {
    ant.wanderAngle += rand(-tuning.wanderTurn, tuning.wanderTurn);
    ant.wanderTimer = time + rand(tuning.wanderMin, tuning.wanderMax);
  }

  const wobble =
    Math.sin(time * ant.wanderFreq + ant.wander) * ant.wanderAmp +
    Math.sin(time * 0.47 + ant.wander * 1.7) * ant.wanderAmp * 0.35;
  const angle = ant.wanderAngle + wobble;
  out.x = Math.cos(angle);
  out.y = Math.sin(angle);
  return out;
}

/** Turn toward velocity and track angular speed for the antennae. */
export function orientAnt(ant: Ant, dt: number) {
  const speed = Math.hypot(ant.vx, ant.vy);
  if (speed > 1) {
    const desired = Math.atan2(ant.vy, ant.vx);
    const turned = angleDiff(ant.heading, desired);
    ant.heading += turned * Math.min(1, dt * 13);
    ant.turn += (turned / Math.max(dt, 1e-3) - ant.turn) * Math.min(1, dt * 3);
    ant.turn = clamp(ant.turn, -8, 8);
  }
}

/** Choose a new touchdown spot ahead of the hip, clamped to leg reach. */
function startSwing(ant: Ant, leg: Leg, stride: number) {
  const L = ant.length;
  const cos = Math.cos(ant.heading);
  const sin = Math.sin(ant.heading);
  const leftX = -sin;
  const leftY = cos;
  const swingAdvance = (1 - TUNING.ant.duty) * stride;
  const touchX = ant.x + cos * swingAdvance;
  const touchY = ant.y + sin * swingAdvance;
  const q = leg.restQ * L + stride * 0.5;
  const p = leg.restP * leg.side * L;

  let tx = touchX + cos * q + leftX * p;
  let ty = touchY + sin * q + leftY * p;

  const rootQ = leg.rootQ * L;
  const rootP = bodyHalfWidth(leg.rootQ) * leg.side * L;
  const rootX = touchX + cos * rootQ + leftX * rootP;
  const rootY = touchY + sin * rootQ + leftY * rootP;

  const reach = legLengths(L).reach * 0.94;
  let dx = tx - rootX;
  let dy = ty - rootY;
  const dist = Math.hypot(dx, dy);
  if (dist > reach) {
    tx = rootX + (dx / dist) * reach;
    ty = rootY + (dy / dist) * reach;
  }

  // Keep the foot on its own side of the body, even during tight turns.
  dx = tx - touchX;
  dy = ty - touchY;
  const localP = dx * leftX + dy * leftY;
  if (localP * leg.side < 0.09 * L) {
    const wanted = leg.side * 0.09 * L;
    tx += leftX * (wanted - localP);
    ty += leftY * (wanted - localP);
  }

  leg.fromX = leg.footX;
  leg.fromY = leg.footY;
  leg.toX = tx;
  leg.toY = ty;
  leg.planted = false;
  leg.lift = 0;
}

/**
 * Advance the alternating tripod gait from distance travelled. Stance feet
 * stay fixed in world space; swing feet arc to a new touchdown spot.
 */
export function updateGait(ant: Ant, dt: number) {
  const speed = Math.hypot(ant.vx, ant.vy);
  const travel =
    (speed + Math.abs(ant.turn) * ant.length * 0.18) * dt;
  ant.gait += travel;
  const stride = ant.length * TUNING.ant.strideFraction;
  const step = travel / stride;
  if (step <= 0) return;

  const duty = TUNING.ant.duty;
  for (const leg of ant.legs) {
    const prev = leg.cycle;
    let cycle = leg.cycle + step;
    if (cycle >= 1) cycle -= 1;
    leg.cycle = cycle;

    if (cycle < prev) {
      // Completed the swing arc: plant the new foot.
      leg.footX = leg.toX;
      leg.footY = leg.toY;
      leg.planted = true;
      leg.lift = 0;
      continue;
    }

    if (prev < duty && cycle >= duty) startSwing(ant, leg, stride);

    if (!leg.planted) {
      const t = clamp((cycle - duty) / (1 - duty), 0, 1);
      const eased = smoothstep(0, 1, t);
      leg.footX = leg.fromX + (leg.toX - leg.fromX) * eased;
      leg.footY = leg.fromY + (leg.toY - leg.fromY) * eased;
      leg.lift = Math.sin(Math.PI * t);
    }
    clampFoot(ant, leg);
  }
}

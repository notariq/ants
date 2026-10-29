import type { TUNING } from "../config";
import { angleDiff, rand } from "./math";
import type { Vec2 } from "./types";

type AntTuning = typeof TUNING.ant;

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
  age: number;
  /** Distance travelled, drives the walk cycle so stopped ants freeze. */
  stride: number;
  wander: number;
  wanderFreq: number;
  wanderAmp: number;
  wanderAngle: number;
  wanderTimer: number;
  speedScale: number;
}

export function createAnt(
  id: number,
  x: number,
  y: number,
  heading: number,
  speed: number,
): Ant {
  return {
    id,
    x,
    y,
    vx: Math.cos(heading) * speed,
    vy: Math.sin(heading) * speed,
    heading,
    swarm: 0,
    swarmTarget: 0,
    pause: 0,
    age: 0,
    stride: Math.random() * 8,
    wander: Math.random() * Math.PI * 2,
    wanderFreq: rand(0.7, 1.7),
    wanderAmp: rand(0.22, 0.48),
    wanderAngle: heading,
    wanderTimer: 0,
    speedScale: 0.86 + Math.random() * 0.28,
  };
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

export function orientAnt(ant: Ant, dt: number) {
  const speed = Math.hypot(ant.vx, ant.vy);
  if (speed > 1) {
    const desired = Math.atan2(ant.vy, ant.vx);
    ant.heading += angleDiff(ant.heading, desired) * Math.min(1, dt * 13);
  }
  if (speed > 0.05) ant.stride = (ant.stride + speed * dt) % 4096;
}

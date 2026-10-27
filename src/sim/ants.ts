import { angleDiff, clamp, rand } from "./math";
import type { PheromoneField } from "./pheromone";
import type { Vec2 } from "./types";

export type AntState = "out" | "back";

export interface Ant {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  heading: number;
  food: number;
  state: AntState;
  /** 0 foraging, 1 full swarm. Smoothly blended. */
  swarm: number;
  swarmTarget: 0 | 1;
  pause: number;
  age: number;
  /** Distance travelled, drives the walk cycle so stopped ants freeze. */
  stride: number;
  wander: number;
  wanderFreq: number;
  wanderAmp: number;
  goalJitterX: number;
  goalJitterY: number;
  speedScale: number;
}

export function createAnt(
  id: number,
  x: number,
  y: number,
  heading: number,
  food: number,
  state: AntState,
  speed: number,
): Ant {
  return {
    id,
    x,
    y,
    vx: Math.cos(heading) * speed,
    vy: Math.sin(heading) * speed,
    heading,
    food,
    state,
    swarm: 0,
    swarmTarget: 0,
    pause: 0,
    age: 0,
    stride: Math.random() * 8,
    wander: Math.random() * Math.PI * 2,
    wanderFreq: rand(0.7, 1.7),
    wanderAmp: rand(0.22, 0.48),
    goalJitterX: 0,
    goalJitterY: 0,
    speedScale: 0.86 + Math.random() * 0.28,
  };
}

/**
 * Blend "head for the target" with "follow the strongest nearby pheromone"
 * and a little individual wander. The gradient has no direction of travel, so
 * it is only trusted while it broadly agrees with the ant's goal.
 */
export function aimAtTarget(
  ant: Ant,
  target: Vec2,
  field: PheromoneField,
  time: number,
  grad: Vec2,
  out: Vec2,
) {
  const dx = target.x - ant.x;
  const dy = target.y - ant.y;
  const dist = Math.hypot(dx, dy) || 1;
  const tx = dx / dist;
  const ty = dy / dist;

  field.gradient(ant.x, ant.y, grad);
  const along = grad.x * tx + grad.y * ty;
  const nearGoal = clamp((dist - 48) / 120, 0, 1);
  const follow =
    along > -0.12
      ? (ant.state === "out" ? 0.5 : 0.3) *
        (0.45 + 0.55 * clamp(along, 0, 1)) *
        nearGoal
      : 0;

  const wobble =
    Math.sin(time * ant.wanderFreq + ant.wander) * ant.wanderAmp +
    Math.sin(time * 0.47 + ant.wander * 1.7) * ant.wanderAmp * 0.35;
  out.x = tx + grad.x * follow - ty * wobble;
  out.y = ty + grad.y * follow + tx * wobble;
  const len = Math.hypot(out.x, out.y) || 1;
  out.x /= len;
  out.y /= len;
  return dist;
}

export function orientAnt(ant: Ant, dt: number) {
  const speed = Math.hypot(ant.vx, ant.vy);
  if (speed > 1) {
    const desired = Math.atan2(ant.vy, ant.vx);
    ant.heading += angleDiff(ant.heading, desired) * Math.min(1, dt * 13);
  }
  if (speed > 0.05) ant.stride = (ant.stride + speed * dt) % 4096;
}

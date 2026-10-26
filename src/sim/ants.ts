import { angleDiff, clamp } from "./math";
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
  phase: number;
  wander: number;
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
    phase: Math.random() * 8,
    wander: Math.random() * Math.PI * 2,
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
  const follow =
    along > -0.12
      ? (ant.state === "out" ? 1 : 0.68) * (0.58 + 0.42 * clamp(along, 0, 1))
      : 0;

  const wobble = Math.sin(time * 1.35 + ant.wander) * 0.22;
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
  ant.phase += dt * (speed > 3 ? 5 + speed * 0.16 : 0.7);
}

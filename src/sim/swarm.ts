import type { TUNING } from "../config";
import type { Ant } from "./ants";
import type { PheromoneField } from "./pheromone";
import type { PointerState, Vec2 } from "./types";

type SwarmTuning = typeof TUNING.swarm;

const GRAD = { x: 0, y: 0 };

/**
 * Boids-style acceleration for a scattering ant. Separation dominates up
 * close, alignment keeps the burst moving together, cohesion rounds it into a
 * loose cloud, and the pointer/trail pulls the cloud where the user leads it.
 */
export function swarmAcceleration(
  ant: Ant,
  ants: readonly Ant[],
  field: PheromoneField,
  pointer: PointerState,
  tuning: SwarmTuning,
  out: Vec2,
) {
  out.x = 0;
  out.y = 0;

  let neighbors = 0;
  let avgVx = 0;
  let avgVy = 0;
  let avgX = 0;
  let avgY = 0;
  const neighborR2 = tuning.neighborRadius * tuning.neighborRadius;
  const separationR2 = tuning.separationRadius * tuning.separationRadius;

  for (const other of ants) {
    if (other === ant) continue;
    const dx = other.x - ant.x;
    const dy = other.y - ant.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > neighborR2 || d2 < 1e-4) continue;
    const d = Math.sqrt(d2);

    if (d2 < separationR2) {
      const weight = (1 - d / tuning.separationRadius) / d;
      out.x -= dx * weight * tuning.separationForce;
      out.y -= dy * weight * tuning.separationForce;
    }

    avgVx += other.vx;
    avgVy += other.vy;
    avgX += other.x;
    avgY += other.y;
    neighbors++;
  }

  if (neighbors > 0) {
    out.x += (avgVx / neighbors - ant.vx) * tuning.alignmentForce;
    out.y += (avgVy / neighbors - ant.vy) * tuning.alignmentForce;

    const cx = avgX / neighbors - ant.x;
    const cy = avgY / neighbors - ant.y;
    const cl = Math.hypot(cx, cy);
    if (cl > 1) {
      out.x += (cx / cl) * tuning.cohesionForce;
      out.y += (cy / cl) * tuning.cohesionForce;
    }
  }

  if (pointer.down && pointer.active) {
    const dx = pointer.x - ant.x;
    const dy = pointer.y - ant.y;
    const d = Math.hypot(dx, dy);
    if (d > 1 && d < tuning.neighborRadius * 8) {
      const weight = 1 - d / (tuning.neighborRadius * 8);
      out.x += (dx / d) * tuning.attractionForce * weight;
      out.y += (dy / d) * tuning.attractionForce * weight;
    }
  }

  field.gradient(ant.x, ant.y, GRAD);
  out.x += GRAD.x * tuning.fieldForce;
  out.y += GRAD.y * tuning.fieldForce;
  return out;
}

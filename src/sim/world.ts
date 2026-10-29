import { TUNING } from "../config";
import { createAnt, orientAnt, wanderDirection, type Ant } from "./ants";
import { clamp, rand, TAU } from "./math";
import { swarmAcceleration } from "./swarm";
import type { Box, PointerState, Vec2 } from "./types";

type WorldTuning = typeof TUNING.world;
type PointerTuning = typeof TUNING.pointer;
type SwarmTuning = typeof TUNING.swarm;
type AntTuning = typeof TUNING.ant;

const EDGE_FORCE = 280;

export class World {
  width = 0;
  height = 0;
  time = 0;
  ants: Ant[] = [];
  readonly pointer: PointerState = {
    x: 0,
    y: 0,
    active: false,
    down: false,
  };

  private boxes: Box[] = [];
  private nextId = 1;

  private readonly aim: Vec2 = { x: 0, y: 0 };
  private readonly swarmAcc: Vec2 = { x: 0, y: 0 };
  private readonly push: Vec2 = { x: 0, y: 0 };
  private readonly separation: Vec2 = { x: 0, y: 0 };
  private swarmActive = false;

  constructor(
    private readonly worldTuning: WorldTuning = TUNING.world,
    private readonly pointerTuning: PointerTuning = TUNING.pointer,
    private readonly swarmTuning: SwarmTuning = TUNING.swarm,
    private readonly antTuning: AntTuning = TUNING.ant,
  ) {}

  get antCount() {
    return this.ants.length;
  }

  resize(width: number, height: number) {
    if (width < 1 || height < 1) return;
    this.width = width;
    this.height = height;

    const target = clamp(
      Math.round(
        this.antTuning.count * ((width * height) / (1440 * 900)),
      ),
      this.antTuning.minCount,
      this.antTuning.maxCount,
    );

    if (this.ants.length === 0) {
      for (let i = 0; i < target; i++) this.spawnAnt();
    } else {
      if (this.ants.length > target) this.ants.length = target;
      while (this.ants.length < target) this.spawnAnt();
      for (const ant of this.ants) {
        ant.x = clamp(ant.x, 0, width);
        ant.y = clamp(ant.y, 0, height);
      }
    }
  }

  setAvoidBoxes(boxes: Box[]) {
    this.boxes = boxes;
  }

  step(dt: number) {
    this.time += dt;
    this.swarmActive = this.ants.some(
      (ant) => ant.swarmTarget === 1 || ant.swarm > 0.01,
    );

    for (const ant of this.ants) this.stepAnt(ant, dt);
    this.resolveCollisions();
  }

  setPointer(x: number, y: number, active: boolean) {
    this.pointer.x = x;
    this.pointer.y = y;
    this.pointer.active = active;
  }

  pointerDown(x: number, y: number) {
    this.pointer.x = x;
    this.pointer.y = y;
    this.pointer.active = true;
    this.pointer.down = true;
    this.scatter(x, y);
  }

  pointerUp() {
    this.pointer.down = false;
    for (const ant of this.ants) ant.swarmTarget = 0;
  }

  private scatter(x: number, y: number) {
    const radius = this.pointerTuning.scatterRadius;
    const r2 = radius * radius;
    for (const ant of this.ants) {
      const dx = ant.x - x;
      const dy = ant.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const d = Math.sqrt(d2);
      const falloff = 1 - d / radius;
      const angle = d > 0.5 ? Math.atan2(dy, dx) : Math.random() * TAU;
      const burst = this.pointerTuning.burstSpeed * (0.35 + 0.65 * falloff);
      ant.swarmTarget = 1;
      ant.vx += Math.cos(angle) * burst + rand(-26, 26);
      ant.vy += Math.sin(angle) * burst + rand(-26, 26);
      ant.pause = 0;
    }
  }

  private stepAnt(ant: Ant, dt: number) {
    ant.age += dt;
    ant.swarm +=
      (ant.swarmTarget - ant.swarm) * Math.min(1, dt * 2.4);
    if (ant.swarm < 0.001) ant.swarm = 0;
    if (ant.pause > 0) ant.pause = Math.max(0, ant.pause - dt);
    else if (ant.swarm < 0.05 && Math.random() < dt * 0.04) {
      ant.pause = 0.35 + Math.random() * 0.9;
    }

    wanderDirection(ant, this.time, this.antTuning, this.aim);

    let desiredSpeed =
      this.worldTuning.wanderSpeed * ant.speedScale;
    if (ant.pause > 0) desiredSpeed *= 0.16;

    let ax = (this.aim.x * desiredSpeed - ant.vx) * 5.4;
    let ay = (this.aim.y * desiredSpeed - ant.vy) * 5.4;

    if (this.swarmActive && ant.swarm > 0.001) {
      const blend = ant.swarm;
      swarmAcceleration(
        ant,
        this.ants,
        this.pointer,
        this.swarmTuning,
        this.swarmAcc,
      );
      ax = ax * (1 - blend) + this.swarmAcc.x * blend;
      ay = ay * (1 - blend) + this.swarmAcc.y * blend;
    }

    this.avoidContent(ant, this.push);
    ax += this.push.x;
    ay += this.push.y;

    if (this.pointer.active && !this.pointer.down) {
      const dx = ant.x - this.pointer.x;
      const dy = ant.y - this.pointer.y;
      const d = Math.hypot(dx, dy);
      const radius = this.worldTuning.hoverRadius;
      if (d < radius && d > 0.5) {
        const weight = (1 - d / radius) ** 2;
        ax += (dx / d) * this.worldTuning.hoverForce * weight;
        ay += (dy / d) * this.worldTuning.hoverForce * weight;
      }
    }

    this.separateFromOthers(ant, this.separation);
    ax += this.separation.x;
    ay += this.separation.y;

    const margin = this.worldTuning.edgeMargin;
    if (ant.x < margin) ax += ((margin - ant.x) / margin) * EDGE_FORCE;
    else if (ant.x > this.width - margin) {
      ax -= ((ant.x - (this.width - margin)) / margin) * EDGE_FORCE;
    }
    if (ant.y < margin) ay += ((margin - ant.y) / margin) * EDGE_FORCE;
    else if (ant.y > this.height - margin) {
      ay -= ((ant.y - (this.height - margin)) / margin) * EDGE_FORCE;
    }

    ant.vx += ax * dt;
    ant.vy += ay * dt;

    const wanderMax = desiredSpeed * 1.7;
    const maxSpeed =
      wanderMax + (this.swarmTuning.maxSpeed - wanderMax) * ant.swarm;
    const speed = Math.hypot(ant.vx, ant.vy);
    if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
      ant.vx *= scale;
      ant.vy *= scale;
    }

    ant.x += ant.vx * dt;
    ant.y += ant.vy * dt;
    ant.x = clamp(ant.x, 0, this.width);
    ant.y = clamp(ant.y, 0, this.height);
    orientAnt(ant, dt);
  }

  private separateFromOthers(ant: Ant, out: Vec2) {
    out.x = 0;
    out.y = 0;
    const radius = this.antTuning.separationRadius;
    const force = this.antTuning.separationForce;
    const r2 = radius * radius;

    for (const other of this.ants) {
      if (other === ant) continue;
      const dx = ant.x - other.x;
      const dy = ant.y - other.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r2 || d2 < 1e-6) continue;
      const d = Math.sqrt(d2);
      const weight = (1 - d / radius) ** 2;
      out.x += (dx / d) * force * weight;
      out.y += (dy / d) * force * weight;
    }
  }

  private resolveCollisions() {
    const minDist = this.antTuning.collisionDistance;
    const min2 = minDist * minDist;

    for (let i = 0; i < this.ants.length; i++) {
      const a = this.ants[i];
      for (let j = i + 1; j < this.ants.length; j++) {
        const b = this.ants[j];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min2 || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const push = (minDist - d) * 0.5;
        dx /= d;
        dy /= d;
        a.x = clamp(a.x + dx * push, 0, this.width);
        a.y = clamp(a.y + dy * push, 0, this.height);
        b.x = clamp(b.x - dx * push, 0, this.width);
        b.y = clamp(b.y - dy * push, 0, this.height);
      }
    }
  }

  private avoidContent(ant: Ant, out: Vec2) {
    out.x = 0;
    out.y = 0;
    const margin = this.worldTuning.avoidMargin;
    const force = this.worldTuning.avoidForce;

    for (const box of this.boxes) {
      const nearestX = clamp(ant.x, box.left, box.right);
      const nearestY = clamp(ant.y, box.top, box.bottom);
      let dx = ant.x - nearestX;
      let dy = ant.y - nearestY;
      let d = Math.hypot(dx, dy);

      if (d < 1e-3) {
        const edges = [
          { d: ant.x - box.left, x: -1, y: 0 },
          { d: box.right - ant.x, x: 1, y: 0 },
          { d: ant.y - box.top, x: 0, y: -1 },
          { d: box.bottom - ant.y, x: 0, y: 1 },
        ];
        const nearest = edges.reduce((a, b) => (b.d < a.d ? b : a));
        out.x += nearest.x * force * 1.3;
        out.y += nearest.y * force * 1.3;
        continue;
      }

      if (d < margin) {
        const weight = (1 - d / margin) ** 2;
        out.x += (dx / d) * force * weight;
        out.y += (dy / d) * force * weight;
      }
    }
  }

  private spawnAnt() {
    const margin = Math.max(this.worldTuning.edgeMargin, 1);
    const x = rand(margin, Math.max(margin, this.width - margin));
    const y = rand(margin, Math.max(margin, this.height - margin));
    const heading = Math.random() * TAU;
    const speed =
      this.worldTuning.wanderSpeed * (0.86 + Math.random() * 0.28);

    this.ants.push(createAnt(this.nextId++, x, y, heading, speed));
  }
}

import { TUNING } from "../config";
import { aimAtTarget, createAnt, orientAnt, type Ant } from "./ants";
import { clamp, rand, TAU } from "./math";
import { PheromoneField } from "./pheromone";
import { swarmAcceleration } from "./swarm";
import type { Box, PointerState, Vec2 } from "./types";

type WorldTuning = typeof TUNING.world;
type PheromoneTuning = typeof TUNING.pheromone;
type PointerTuning = typeof TUNING.pointer;
type SwarmTuning = typeof TUNING.swarm;
type AntTuning = typeof TUNING.ant;

const EDGE_FORCE = 280;

export class World {
  width = 0;
  height = 0;
  time = 0;
  ants: Ant[] = [];
  readonly field = new PheromoneField(TUNING.pheromone);
  readonly pointer: PointerState = {
    x: 0,
    y: 0,
    active: false,
    down: false,
    lastPaint: null,
  };

  private nest: Vec2 = { x: 0, y: 0 };
  private foods: Vec2[] = [];
  private paths: Vec2[][] = [];
  private boxes: Box[] = [];
  private nextId = 1;

  private readonly grad: Vec2 = { x: 0, y: 0 };
  private readonly aim: Vec2 = { x: 0, y: 0 };
  private readonly goal: Vec2 = { x: 0, y: 0 };
  private readonly swarmAcc: Vec2 = { x: 0, y: 0 };
  private readonly push: Vec2 = { x: 0, y: 0 };
  private readonly separation: Vec2 = { x: 0, y: 0 };
  private swarmActive = false;

  constructor(
    private readonly worldTuning: WorldTuning = TUNING.world,
    private readonly pheromoneTuning: PheromoneTuning = TUNING.pheromone,
    private readonly pointerTuning: PointerTuning = TUNING.pointer,
    private readonly swarmTuning: SwarmTuning = TUNING.swarm,
    private readonly antTuning: AntTuning = TUNING.ant,
  ) {}

  get antCount() {
    return this.ants.length;
  }

  resize(width: number, height: number, cellW: number, cellH: number) {
    if (width < 1 || height < 1) return;
    this.width = width;
    this.height = height;

    const cols = Math.ceil(width / cellW);
    const rows = Math.ceil(height / cellH);
    this.field.resize(cols, rows, cellW, cellH);

    this.nest = {
      x: width * this.worldTuning.nest.x,
      y: height * this.worldTuning.nest.y,
    };
    this.foods = this.worldTuning.foods.map((food) => ({
      x: width * food.x,
      y: height * food.y,
    }));

    this.paths = this.foods.map((food, i) => this.makePath(this.nest, food, i));
    for (const path of this.paths) {
      this.field.seedPath(path, this.pheromoneTuning.seedAmount);
    }

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

    if (this.pointer.down && this.pointer.active) {
      this.field.depositPaint(
        this.pointer.x,
        this.pointer.y,
        this.pheromoneTuning.paintHold * dt,
        this.pheromoneTuning.paintRadius * 2,
      );
    }
    this.field.update(dt);
  }

  setPointer(x: number, y: number, active: boolean) {
    this.pointer.x = x;
    this.pointer.y = y;
    this.pointer.active = active;
    if (!active) this.pointer.lastPaint = null;
  }

  pointerDown(x: number, y: number) {
    this.pointer.x = x;
    this.pointer.y = y;
    this.pointer.active = true;
    this.pointer.down = true;
    this.pointer.lastPaint = { x, y };
    this.field.depositPaint(
      x,
      y,
      this.pheromoneTuning.paintDeposit * 0.5,
      this.pheromoneTuning.paintRadius,
    );
    this.scatter(x, y);
  }

  paintTo(x: number, y: number) {
    const clampedX = clamp(x, 0, this.width);
    const clampedY = clamp(y, 0, this.height);
    const last = this.pointer.lastPaint;
    if (!last) {
      this.pointer.lastPaint = { x: clampedX, y: clampedY };
      this.field.depositPaint(
        clampedX,
        clampedY,
        this.pheromoneTuning.paintDeposit,
        this.pheromoneTuning.paintRadius,
      );
      return;
    }

    const dx = clampedX - last.x;
    const dy = clampedY - last.y;
    const length = Math.hypot(dx, dy);
    const samples = Math.max(
      1,
      Math.ceil(length / this.pheromoneTuning.paintSpacing),
    );
    for (let i = 1; i <= samples; i++) {
      const t = i / samples;
      this.field.depositPaint(
        last.x + dx * t,
        last.y + dy * t,
        this.pheromoneTuning.paintDeposit,
        this.pheromoneTuning.paintRadius,
      );
    }
    this.pointer.lastPaint = { x: clampedX, y: clampedY };
  }

  pointerUp() {
    this.pointer.down = false;
    this.pointer.lastPaint = null;
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

    const base = ant.state === "out" ? this.foods[ant.food] : this.nest;
    this.goal.x = base.x + ant.goalJitterX;
    this.goal.y = base.y + ant.goalJitterY;
    aimAtTarget(
      ant,
      this.goal,
      this.field,
      this.time,
      this.grad,
      this.aim,
    );

    let desiredSpeed =
      (ant.state === "out"
        ? this.worldTuning.forageSpeed
        : this.worldTuning.returnSpeed) * ant.speedScale;
    if (ant.pause > 0) desiredSpeed *= 0.16;

    let ax = (this.aim.x * desiredSpeed - ant.vx) * 5.4;
    let ay = (this.aim.y * desiredSpeed - ant.vy) * 5.4;

    if (this.swarmActive && ant.swarm > 0.001) {
      const blend = ant.swarm;
      swarmAcceleration(
        ant,
        this.ants,
        this.field,
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

    const forageMax = desiredSpeed * 1.7;
    const maxSpeed =
      forageMax + (this.swarmTuning.maxSpeed - forageMax) * ant.swarm;
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

    const depositRate =
      ant.state === "back"
        ? this.pheromoneTuning.depositReturn
        : this.pheromoneTuning.depositOut;
    this.field.deposit(
      ant.x,
      ant.y,
      depositRate * dt * (0.35 + 0.65 * (1 - ant.swarm)),
      0,
    );

    if (ant.pause <= 0 && ant.swarm < 0.18) this.arrive(ant);
  }

  private arrive(ant: Ant) {
    if (ant.state === "out") {
      const food = this.foods[ant.food];
      if (
        (ant.x - food.x) ** 2 + (ant.y - food.y) ** 2 <
        this.worldTuning.foodRadius ** 2
      ) {
        ant.state = "back";
        ant.pause = 0.15 + Math.random() * 0.35;
        ant.heading += Math.PI;
        ant.vx *= -0.35;
        ant.vy *= -0.35;
        this.rerollGoal(ant);
      }
      return;
    }

    if (
      (ant.x - this.nest.x) ** 2 + (ant.y - this.nest.y) ** 2 <
      this.worldTuning.nestRadius ** 2
    ) {
      ant.state = "out";
      ant.food = Math.floor(Math.random() * this.foods.length);
      ant.pause = 0.15 + Math.random() * 0.35;
      ant.heading += Math.PI;
      ant.vx *= -0.35;
      ant.vy *= -0.35;
      this.rerollGoal(ant);
    }
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

  private rerollGoal(ant: Ant) {
    const radius =
      ant.state === "out"
        ? this.worldTuning.foodRadius
        : this.worldTuning.nestRadius;
    const angle = Math.random() * TAU;
    const distance = Math.sqrt(Math.random()) * radius * 0.9;
    ant.goalJitterX = Math.cos(angle) * distance;
    ant.goalJitterY = Math.sin(angle) * distance;
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
    const food = Math.floor(Math.random() * this.paths.length);
    const path = this.paths[food];
    if (!path || path.length < 2) return;
    const state = Math.random() < 0.54 ? "out" : "back";
    const t = Math.random();
    const index = Math.min(path.length - 2, Math.floor(t * (path.length - 1)));
    const a = path[index];
    const b = path[index + 1];
    const from = state === "out" ? a : b;
    const to = state === "out" ? b : a;
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const jitter = rand(-2, 2);
    const x = a.x - Math.sin(angle) * jitter;
    const y = a.y + Math.cos(angle) * jitter;
    const speed =
      (state === "out"
        ? this.worldTuning.forageSpeed
        : this.worldTuning.returnSpeed) *
      (0.86 + Math.random() * 0.28);

    const ant = createAnt(
      this.nextId++,
      x,
      y,
      angle + rand(-0.08, 0.08),
      food,
      state,
      speed,
    );
    this.rerollGoal(ant);
    this.ants.push(ant);
  }

  private makePath(from: Vec2, to: Vec2, index: number) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length;
    const ny = dx / length;
    const bend =
      (index % 2 === 0 ? 1 : -1) *
      Math.min(this.width, this.height) *
      (0.075 + index * 0.012);
    const control = {
      x: (from.x + to.x) * 0.5 + nx * bend,
      y: (from.y + to.y) * 0.5 + ny * bend,
    };
    const points: Vec2[] = [];
    const steps = 72;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const it = 1 - t;
      const wobble =
        Math.sin(t * Math.PI * 3 + index * 1.7) *
        Math.min(this.width, this.height) *
        0.012 *
        Math.sin(t * Math.PI);
      points.push({
        x:
          it * it * from.x +
          2 * it * t * control.x +
          t * t * to.x +
          nx * wobble,
        y:
          it * it * from.y +
          2 * it * t * control.y +
          t * t * to.y +
          ny * wobble,
      });
    }
    return points;
  }
}

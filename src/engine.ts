import { TUNING } from "./config";
import { ColonyRenderer } from "./render/layers";
import { clamp } from "./sim/math";
import { World } from "./sim/world";
import type { CanvasPalette } from "./ui/theme";

export interface SimStats {
  ants: number;
  fps: number;
  x: number;
  y: number;
}

const MEASURE_EVERY_FRAMES = 30;
const STATS_INTERVAL = 0.2;

export class ColonyEngine {
  private readonly world = new World();
  private readonly renderer: ColonyRenderer;
  private readonly reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );
  private readonly resizeObserver: ResizeObserver;
  private readonly intersectionObserver: IntersectionObserver;

  private raf = 0;
  private last = 0;
  private acc = 0;
  private frames = 0;
  private fps = 60;
  private statsClock = 0;
  private intersecting = true;
  private visible = true;
  private disposed = false;
  private dragPointer: number | null = null;
  private motionOverride = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    palette: CanvasPalette,
    private readonly onStats: (stats: SimStats) => void,
  ) {
    this.renderer = new ColonyRenderer(canvas, palette);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.intersectionObserver = new IntersectionObserver(([entry]) => {
      this.intersecting = entry.isIntersecting;
      this.updateVisibility();
    });
    this.intersectionObserver.observe(canvas);

    window.addEventListener("resize", this.resize);
    document.addEventListener("visibilitychange", this.updateVisibility);
    this.reducedMotion.addEventListener("change", this.onMotionPreference);

    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerCancel);
    canvas.addEventListener("lostpointercapture", this.onLostCapture);
    canvas.addEventListener("pointerleave", this.onPointerLeave);

    this.resize();
    this.schedule();
  }

  setPalette(palette: CanvasPalette) {
    this.renderer.setPalette(palette);
    if (this.isStatic()) this.drawStill();
  }

  get motionEnabled() {
    return !this.isStatic();
  }

  setMotionEnabled(enabled: boolean) {
    this.motionOverride = enabled;
    this.syncMotion();
  }

  destroy() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.intersectionObserver.disconnect();
    window.removeEventListener("resize", this.resize);
    document.removeEventListener("visibilitychange", this.updateVisibility);
    this.reducedMotion.removeEventListener("change", this.onMotionPreference);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerCancel);
    this.canvas.removeEventListener("lostpointercapture", this.onLostCapture);
    this.canvas.removeEventListener("pointerleave", this.onPointerLeave);
  }

  private resize = () => {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const dpr = Math.min(
      window.devicePixelRatio || 1,
      TUNING.render.maxDpr,
    );
    this.renderer.resize(rect.width, rect.height, dpr);
    this.world.resize(
      rect.width,
      rect.height,
      this.renderer.grid.cellW,
      this.renderer.grid.cellH,
    );
    this.measureContent();
    if (this.isStatic()) this.drawStill();
  };

  private measureContent() {
    const origin = this.canvas.getBoundingClientRect();
    const boxes = Array.from(
      document.querySelectorAll<HTMLElement>("[data-ants-avoid]"),
      (element) => {
        const rect = element.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) return null;
        return {
          left: rect.left - origin.left,
          top: rect.top - origin.top,
          right: rect.right - origin.left,
          bottom: rect.bottom - origin.top,
        };
      },
    ).filter((box) => box !== null);

    this.world.setAvoidBoxes(boxes);
    this.renderer.setAvoidBoxes(boxes);
  }

  private isStatic() {
    return this.reducedMotion.matches && !this.motionOverride;
  }

  private syncMotion() {
    if (this.isStatic()) {
      cancelAnimationFrame(this.raf);
      this.drawStill();
      return;
    }
    this.schedule();
  }

  private schedule() {
    cancelAnimationFrame(this.raf);
    if (this.disposed || !this.visible || this.isStatic()) {
      return;
    }
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number) => {
    if (this.disposed) return;
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.acc += dt;

    const step = TUNING.world.step;
    let steps = 0;
    while (this.acc >= step && steps < TUNING.world.maxSteps) {
      this.world.step(step);
      this.acc -= step;
      steps++;
    }
    if (steps === TUNING.world.maxSteps) this.acc = 0;

    this.renderer.render(this.world);

    if (++this.frames % MEASURE_EVERY_FRAMES === 0) this.measureContent();

    if (dt > 0) this.fps += (1 / dt - this.fps) * 0.06;
    this.statsClock += dt;
    if (this.statsClock >= STATS_INTERVAL) {
      this.statsClock = 0;
      this.reportStats();
    }

    this.raf = requestAnimationFrame(this.frame);
  };

  private reportStats() {
    this.onStats({
      ants: this.world.antCount,
      fps: Math.round(this.fps),
      x: Math.round(this.world.pointer.x),
      y: Math.round(this.world.pointer.y),
    });
  }

  private drawStill() {
    this.fps = 0;
    if (this.world.time < 0.001) {
      for (let i = 0; i < 240; i++) this.world.step(TUNING.world.step);
    }
    this.measureContent();
    this.renderer.render(this.world);
    this.reportStats();
  }

  private updateVisibility = () => {
    this.visible =
      this.intersecting && document.visibilityState !== "hidden";
    this.schedule();
  };

  private onMotionPreference = () => {
    this.syncMotion();
  };

  private localPoint(event: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    return {
      x,
      y,
      inside: x >= 0 && y >= 0 && x <= rect.width && y <= rect.height,
      width: rect.width,
      height: rect.height,
    };
  }

  private onPointerDown = (event: PointerEvent) => {
    if (this.isStatic()) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const point = this.localPoint(event);
    if (!point.inside) return;
    this.canvas.setPointerCapture(event.pointerId);
    this.dragPointer = event.pointerId;
    this.world.pointerDown(point.x, point.y);
  };

  private onPointerMove = (event: PointerEvent) => {
    if (this.isStatic()) return;
    const point = this.localPoint(event);

    if (this.dragPointer === event.pointerId) {
      const x = clamp(point.x, 0, point.width);
      const y = clamp(point.y, 0, point.height);
      this.world.setPointer(x, y, true);
      if (point.inside) this.world.paintTo(point.x, point.y);
      return;
    }

    this.world.setPointer(
      point.x,
      point.y,
      point.inside && event.pointerType !== "touch",
    );
  };

  private onPointerUp = (event: PointerEvent) => {
    if (this.dragPointer !== event.pointerId) return;
    this.releaseDrag(event.pointerId);
    const point = this.localPoint(event);
    this.world.setPointer(point.x, point.y, point.inside);
  };

  private onPointerCancel = (event: PointerEvent) => {
    if (this.dragPointer !== event.pointerId) return;
    this.releaseDrag(event.pointerId);
    this.world.setPointer(0, 0, false);
  };

  private onLostCapture = (event: PointerEvent) => {
    if (this.dragPointer !== event.pointerId) return;
    this.releaseDrag(event.pointerId);
  };

  private onPointerLeave = () => {
    if (this.dragPointer !== null) return;
    this.world.setPointer(0, 0, false);
  };

  private releaseDrag(pointerId: number) {
    this.world.pointerUp();
    this.dragPointer = null;
    if (this.canvas.hasPointerCapture(pointerId)) {
      this.canvas.releasePointerCapture(pointerId);
    }
  }
}

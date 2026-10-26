import type { SimStats } from "../engine";

export class StatsView {
  private visible = true;
  private latest: SimStats = { ants: 0, fps: 0, x: 0, y: 0 };

  constructor(
    private readonly toggle: HTMLButtonElement,
    private readonly panel: HTMLElement,
    private readonly ants: HTMLElement,
    private readonly fps: HTMLElement,
    private readonly pointer: HTMLElement,
  ) {
    this.toggle.addEventListener("click", this.onToggle);
    this.render();
  }

  update(stats: SimStats) {
    this.latest = stats;
    if (this.visible) this.render();
  }

  private onToggle = () => {
    this.visible = !this.visible;
    this.toggle.setAttribute("aria-pressed", String(this.visible));
    this.panel.hidden = !this.visible;
    if (this.visible) this.render();
  };

  private render() {
    this.ants.textContent = `ants ${String(this.latest.ants).padStart(3, "0")}`;
    this.fps.textContent =
      this.latest.fps > 0
        ? `fps ${String(this.latest.fps).padStart(3, "0")}`
        : "fps ---";
    this.pointer.textContent = `x ${String(this.latest.x).padStart(4, "0")} / y ${String(this.latest.y).padStart(4, "0")}`;
  }
}

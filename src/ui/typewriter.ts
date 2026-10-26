export class Typewriter {
  private timer: number | null = null;
  private index = 0;
  private readonly reduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );

  constructor(
    private readonly element: HTMLElement,
    private readonly text: string,
  ) {
    this.reduced.addEventListener("change", this.onMotionPreference);
  }

  start() {
    if (this.reduced.matches) {
      this.showFull();
      return;
    }
    this.timer = window.setTimeout(this.typeNext, 380);
  }

  destroy() {
    this.clearTimer();
    this.reduced.removeEventListener("change", this.onMotionPreference);
  }

  private typeNext = () => {
    if (this.index >= this.text.length) return;
    this.index++;
    this.element.textContent = this.text.slice(0, this.index);
    const delay = 38 + Math.random() * 34;
    const punctuation = /[.,;:!?—-]/.test(this.text[this.index - 1] ?? "");
    this.timer = window.setTimeout(this.typeNext, punctuation ? delay + 90 : delay);
  };

  private onMotionPreference = () => {
    if (this.reduced.matches) this.showFull();
  };

  private showFull() {
    this.clearTimer();
    this.index = this.text.length;
    this.element.textContent = this.text;
  }

  private clearTimer() {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

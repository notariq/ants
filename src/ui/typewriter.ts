export class Typewriter {
  private run = 0;
  private finalText = "";
  private readonly reduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );

  constructor(private readonly element: HTMLElement) {
    this.reduced.addEventListener("change", this.onMotionPreference);
  }

  play(texts: readonly string[]) {
    const run = ++this.run;
    this.finalText = texts.at(-1) ?? "";

    if (this.reduced.matches) {
      this.element.textContent = this.finalText;
      return;
    }

    void this.runSequence(texts, run);
  }

  destroy() {
    this.run++;
    this.reduced.removeEventListener("change", this.onMotionPreference);
  }

  private async runSequence(texts: readonly string[], run: number) {
    this.element.textContent = "";
    await this.wait(380);

    for (let index = 0; index < texts.length; index++) {
      if (run !== this.run) return;
      await this.type(texts[index] ?? "", run);
      if (run !== this.run) return;

      if (index < texts.length - 1) {
        await this.wait(560);
        if (run !== this.run) return;
        await this.erase(run);
        if (run !== this.run) return;
        await this.wait(260);
      }
    }
  }

  private async type(text: string, run: number) {
    for (let index = 1; index <= text.length; index++) {
      if (run !== this.run) return;
      this.element.textContent = text.slice(0, index);
      const punctuation = /[.,;:!?]/.test(text[index - 1] ?? "");
      await this.wait(52 + Math.random() * 38 + (punctuation ? 90 : 0));
    }
  }

  private async erase(run: number) {
    const text = this.element.textContent ?? "";
    for (let index = text.length - 1; index >= 0; index--) {
      if (run !== this.run) return;
      this.element.textContent = text.slice(0, index);
      await this.wait(28 + Math.random() * 18);
    }
  }

  private wait(ms: number) {
    return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
  }

  private onMotionPreference = () => {
    if (!this.reduced.matches) return;
    this.run++;
    this.element.textContent = this.finalText;
  };
}

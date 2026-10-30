import type { Page } from "../router";
import { Typewriter } from "../ui/typewriter";

export const antPage: Page = {
  path: "/projects",
  title: "projects",
  mount(root) {
    const section = document.createElement("section");
    section.className = "page projects";

    const intro = document.createElement('p');
    intro.className = "projects-title"

    const typewriter = new Typewriter(intro);
    typewriter.play(["compiling..."])

    section.append(intro);
    root.append(section);
  },
};

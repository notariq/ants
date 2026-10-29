import type { Page } from "../router";

export const antPage: Page = {
  path: "/projects",
  title: "projects",
  mount(root) {
    const section = document.createElement("section");
    section.className = "page";

    const heading = document.createElement("h1");
    heading.className = "sr-only";
    heading.textContent = "ant";

    section.append(heading);
    root.append(section);
  },
};

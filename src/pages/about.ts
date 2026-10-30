import type { Page } from "../router";
import asciiArt from "../assets/ascii-art.txt?raw";

export const aboutPage: Page = {
  path: "/about",
  title: "about",
  mount(root) {
    const section = document.createElement("section");
    section.className = "page about";

    const grid = document.createElement("div");
    grid.className = "about-grid";

    const media = document.createElement("figure");
    media.className = "about-media";

    const art = document.createElement("pre");
    art.className = "about-art";
    art.setAttribute("role", "img");
    art.setAttribute("aria-label", "ASCII portrait");
    art.textContent = asciiArt.trimEnd();
    media.append(art);

    const copy = document.createElement("div");
    copy.className = "about-copy";

    const heading = document.createElement("h1");
    heading.className = "about-title";
    heading.textContent = "Hauzan Ariq Bakri";

    const intro = document.createElement("p");
    intro.textContent =
      "Saravá! Informatics graduate — with interest in Systems Engineering and ML Infrastructures. Currently working/studying/building between projects and freelancing. Open to new opportunities and collaborations!";

    const email = document.createElement("p");
    email.textContent =
      "hauzanbakri@gmail.com";

    copy.append(heading, intro, email);
    grid.append(media, copy);
    section.append(grid);
    root.append(section);
  },
};

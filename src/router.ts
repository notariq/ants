export interface Page {
  path: string;
  title: string;
  mount(root: HTMLElement): void;
}

interface RouterOptions {
  pages: readonly Page[];
  home: HTMLElement;
  outlet: HTMLElement;
  siteTitle?: string;
  onChange?: (path: string) => void;
}

export function normalizePath(hash: string): string {
  const raw = hash.replace(/^#/, "").split("?")[0] ?? "";
  if (!raw || raw === "/") return "/";
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return path.replace(/\/+$/, "") || "/";
}

export function createRouter({
  pages,
  home,
  outlet,
  siteTitle = "notariq",
  onChange,
}: RouterOptions) {
  const byPath = new Map(pages.map((page) => [page.path, page]));
  const views = new Map<string, HTMLElement>();

  function getView(page: Page): HTMLElement {
    let view = views.get(page.path);
    if (!view) {
      view = document.createElement("div");
      view.className = "page-view";
      page.mount(view);
      outlet.append(view);
      views.set(page.path, view);
    }
    return view;
  }

  function showHome() {
    home.hidden = false;
    outlet.hidden = true;
    for (const view of views.values()) view.hidden = true;
    document.title = siteTitle;
  }

  function showPage(page: Page) {
    home.hidden = true;
    outlet.hidden = false;
    getView(page);
    for (const [path, view] of views) view.hidden = path !== page.path;
    document.title = page.title ? `${page.title} · ${siteTitle}` : siteTitle;
  }

  function resolve() {
    const path = normalizePath(window.location.hash);
    const page = byPath.get(path);

    if (path === "/") {
      showHome();
    } else if (page) {
      showPage(page);
    } else {
      window.history.replaceState(null, "", "#/");
      showHome();
      onChange?.("/");
      return;
    }

    onChange?.(path);
  }

  window.addEventListener("hashchange", resolve);
  resolve();

  return {
    destroy() {
      window.removeEventListener("hashchange", resolve);
    },
  };
}

# notariq

A small portfolio homepage built around a live ASCII ant colony. The colony forages, leaves pheromone trails, and reacts to the pointer while the navigation and text sit calmly in the foreground.

## Run

```bash
npm install
npm run dev
```

Other commands:

```bash
npm run typecheck   # strict TypeScript check
npm run build       # typecheck + production build
npm run preview     # serve the production build
```

The dev server runs at `http://localhost:5173/` by default.

## Edit content

All copy, links, and navigation labels live in `src/config.ts` under `CONTENT`. Replace the bracketed placeholders and `#` hrefs:

- `tagline` and `intro`
- `bio` paragraphs, including inline links
- `socials`
- `nav` items

Navigation and social links with `href: "#"` are treated as placeholders and do not navigate.

## Tune the colony

The same file exposes `TUNING`:

- `render`: glyph grid density, minimum/maximum cell size, DPR cap, ambient glyph density, optional cell tint.
- `world`: ant count (`antArea`, `minAnts`, `maxAnts`), nest and food positions, movement speeds, content avoidance, hover response, fixed timestep.
- `pheromone`: trail evaporation, diffusion, deposit rates, and the user-painted trail parameters.
- `pointer`: click scatter radius and burst speed.
- `swarm`: boids separation, alignment, cohesion, attraction, and maximum speed.

All simulation coordinates are screen-space; the layout adapts on resize and the ant count is recalculated from the viewport area.

## Interactions

- **Click** near the colony: scatters nearby ants and emits an ASCII shockwave ring.
- **Drag**: paints a temporary trail of `#` glyphs. Ants are pulled toward the pointer and then follow the marked route.
- **Hover**: gently pushes ants away.
- **stats**: toggles the readout in the top-right corner.
- **theme label**: switches between light and dark; the choice is stored in `localStorage`.
- **animate / still**: appears when the OS requests reduced motion. Starts or pauses the colony and stores the choice in `localStorage`.
- Text is selectable; the canvas never blocks the content.

`prefers-reduced-motion: reduce` starts with the colony settled, shows full text immediately, and exposes the `animate` control in the nav. Clicking it starts the simulation and stores `colony-motion=on`; the `still` control pauses it and stores `colony-motion=off`. The typewriter and caret continue to follow the OS preference. The still frame redraws on resize and theme changes.

## How it works

- `src/engine.ts` owns the fixed-timestep loop, pointer input, resize handling, stats, and reduced-motion behavior.
- `src/sim/world.ts` spawns ants, builds nest-to-food paths, steers foragers, and manages clicks and painted trails.
- `src/sim/pheromone.ts` keeps a separate evaporated trail field and a slower-decaying paint field.
- `src/sim/swarm.ts` applies boids forces while ants are scattered.
- `src/render/grid.ts` maps CSS pixels to an ASCII cell grid and handles DPR scaling.
- `src/render/layers.ts` batches ambient glyphs, pheromone, paint, shockwaves, and oriented ant sprites by intensity.
- `src/ui/*` handles the typewriter, stats view, and theme persistence.

The scene uses one visible `<canvas>` and no animation or rendering libraries. Tailwind CSS v4 is loaded through `@tailwindcss/vite`; the page-specific styling and theme variables live in `src/styles.css`.

## Notes

- The page is intentionally a single view. Add real routes or project/gallery pages before replacing the placeholder nav hrefs.
- `public/favicon.svg` is the monochrome ant mark.
- No backend is required; the production output is static and can be deployed to any static host.

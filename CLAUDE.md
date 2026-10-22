# Portfolio v2 — Grégoire Tinnes

Grégoire Tinnes's portfolio site. The project is in its design phase: the v3 mockup is built in a Claude Design
canvas, and the site itself (not started yet) will be built from the specs in `docs/specs/`.

## Repository map

- `docs/specs/` — design specs, in French, the source of truth. Read the relevant one before any change.
  - `2026-10-14-portfolio-design.md` — main spec: content, art direction, stack and architecture (§7), content
    Grégoire provides (§8.2), quality checks (§9), deployment (§10), build steps (§11).
  - `2026-10-20-maquette-v3-parcours.md` — v3 mockup: the home page as one scroll-driven camera move through the
    projects. It overrides the main spec's home layout.
  - `2026-10-21-maquette-v3-bureau.md` — v3 mockup: the office scene that ends the journey (Contact). §12 gives the
    build order and where it stands.
- `docs/prototypes/petit-prince/` — Three.js prototype of the Little Prince planet; versions the web model.
- `docs/prototypes/bureau/` — Three.js office scene, the final version the site will reuse, rendered headless into
  the layered images the mockup shows.
- `docs/prototypes/outils/` — tools to check and screenshot canvas components outside the canvas.

## The mockup canvas

- A private Claude Design artifact: https://claude.ai/artifact/Qm7HYAAf7d991WuXECGZue. Its components
  (`project/*.dc.html`) and uploaded images live in the artifact, never in this repo.
- Read the published files right before editing them, check before publishing that nobody changed them since, and
  never overwrite changes you didn't make.
- Before publishing, check the components you changed with `docs/prototypes/outils/` and look at the pictures,
  on desktop and mobile.

## Working on the prototypes

- Each prototype folder is its own npm package: `npm install`, then its README gives the serve and render commands.
- Headless rendering uses Playwright's Chromium; set `CHROMIUM_PATH` if Playwright's browsers aren't installed.
- `renders/` folders are generated and gitignored.

## The site (to come)

- Stack and layout: main spec §7 (static Astro, strict TypeScript, Three.js, GSAP, Lenis, pnpm, Node 24).
- Checks to run before calling a change done: main spec §9.

## Conventions

- Specs, READMEs and commit messages are in French; code and code comments are in English.
- When a design decision changes, update the spec that holds it in the same change.
- Never commit Grégoire's photos (keep them in `.design-assets/`, which is gitignored) or the Blender export
  `projet2.glb`.
- Never write a real email address: the contact email stays the placeholder « [ton email] » until Grégoire gives
  the address to publish.

## Working with Grégoire

- Write to him in French, informally (« tu »).
- Feel free to suggest surprising ideas, always offered as choices.
- End every report with the decisions he still has to make and hasn't given an opinion on.

# Portfolio v2 — Grégoire Tinnes

Grégoire Tinnes's portfolio site: a static Astro site at the root of this repository, built step by step from the
specs in `docs/specs/` and the plan in `docs/plans/`. The v3 mockup, built in a Claude Design canvas, was validated on
23 October 2026; the performance measurement (step 1) is done; steps 2 to 7 (foundations to the 3D scenes) are built.
`docs/etat-du-projet.md` says where things stand and what comes next: read it first.

## Repository map

- `src/` — the site: `pages/`, `layouts/`, `components/`, `lib/url.ts` (`withBase`, the only way to build an internal
  URL), `content/` (one folder per project: `project.yaml`, `fr.md`, `en.md`, cover; the wall's frames), checked by
  `content.config.ts` and, across files, by `integrations/content-checks.ts` at build start; main spec §7.2 gives the
  full layout to come.
- `public/` — files served as they are. `scripts/budgets.ts` — the budgets of main spec §9.4, checked on `dist/`.
- `tests/unit/` (Vitest) and `tests/e2e/` (Playwright, on the built site, `desktop` 1440 × 900 and `mobile` Pixel 7).
- `.github/workflows/` — `ci.yml` (every push and pull request) and `deploy.yml` (push to `main` → GitHub Pages,
  preview at https://greg0s.github.io/portfoliov2/).
- `docs/etat-du-projet.md` — where the project stands, what comes next, what Grégoire still has to provide.
- `docs/specs/` — design specs, in French, the source of truth. Read the relevant one before any change.
  - `2026-10-14-portfolio-design.md` — main spec: content, art direction, 3D scenes (§6), stack and architecture
    (§7), content Grégoire provides (§8.2), quality checks (§9), deployment (§10), build steps (§11).
  - `2026-10-20-maquette-v3-parcours.md` — v3 mockup: the home page as one scroll-driven camera move through the
    projects. It overrides the main spec's home layout.
  - `2026-10-21-maquette-v3-bureau.md` — v3 mockup: the office scene that ends the journey (Contact). §12 gives the
    build order and where it stands.
- `docs/plans/2026-10-23-site-implementation-plan.md` — how the site is built, step by step (main spec §11, steps 2
  to 12): files, tasks, tests and what "done" means for each step.
- `docs/prototypes/petit-prince/` — Three.js prototype of the Little Prince planet; versions the web model and renders
  the layers the mockup animates (the scarf in the wind, the rose).
- `docs/prototypes/bureau/` — Three.js office scene, the final version the site will reuse, rendered headless into
  the layered images the mockup shows.
- `docs/prototypes/perf/` — performance test bench (main spec §11, step 1): the real-time office, the pre-rendered
  office and the journey with its blurred cards, published as a private artifact that records each run.
- `docs/prototypes/outils/` — tools to check, screenshot and test the interactions of canvas components outside the
  canvas.

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

## Working on the site

- Node 24 and pnpm, pinned in `package.json` (`corepack enable`); `.npmrc` sets `engine-strict`. Stack and layout:
  main spec §7 (static Astro, strict TypeScript, Three.js; native scroll, no Lenis or GSAP).
- Commands: `pnpm dev`, `pnpm build`, `pnpm preview`, `pnpm lint`, `pnpm format` / `pnpm format:check`, `pnpm check`,
  `pnpm test`, `pnpm test:e2e`, `pnpm budgets`, `pnpm optimize-media` (wall originals → web versions), `pnpm optimize-screen` (the screen's captures and icons),
  `pnpm render-planet-fallbacks` (the planet's still images, from `docs/prototypes/petit-prince`), `pnpm render-office-layers`
  (the office's layers and `placement.json`, from the site's own scene);
  Lighthouse with `pnpm exec lhci autorun` (after a build).
- Before calling a change done, run what CI runs, in this order: lint, format:check, check, test, build, budgets,
  test:e2e (main spec §9). Lighthouse warns until step 7 and fails from step 7 on.
- The site lives under the base path `/portfoliov2/` until it goes live (`BASE_PATH` overrides it). Never write an
  internal URL by hand: use `withBase()`. Playwright tests use relative paths (`en/`), resolved under the base.
- `astro preview` keeps a lock file for one server at a time: Playwright and Lighthouse start theirs with
  `--ignore-lock`; `pnpm exec astro preview stop` stops a background one.
- Headless Chromium behind a proxy needs `--no-proxy-server` to reach `localhost` (e.g. for Lighthouse:
  `--collect.settings.chromeFlags="--no-sandbox --no-proxy-server"`, with `CHROME_PATH` set to Playwright's Chromium).
- pnpm refuses packages published less than a day ago (its release-age policy): pin the previous version rather than
  adding an exclusion.
- Visible changes ship with side-by-side pictures of the site and the mockup, desktop and mobile (plan §2.10).

## Conventions

- Everything written in the repository is in English: code, comments, specs, READMEs, commit messages, branch names
  and pull requests (Grégoire's rule, 23 October 2026). Docs still in French are translated when Grégoire asks.
- Commit messages follow Conventional Commits with a gitmoji: `<gitmoji> <type>(<scope>): <subject>`, e.g.
  `📝 docs(specs): update the main spec to the v3 mockup` or `✨ feat(journey): add anchor scrolling`.
- Never mention or link Claude in commits, pull requests or branch names: no co-author or session trailers, no
  "Generated with" footers, no `claude/` branch prefixes.
- One branch per task, opened from `main`, with one pull request per task; Grégoire reviews and merges. Never push
  to `main`.
- When a design decision changes, update the spec that holds it in the same change.
- Never commit the originals of Grégoire's photos or of third-party images (keep them in `.design-assets/`, which is
  gitignored), nor the Blender export `projet2.glb`. The site may commit only the web versions it publishes, at
  display size, with their credits (main spec §7.3, decided by Grégoire on 23 October 2026).
- The contact email is contact@gregoiretinn.es. Never write any other address of Grégoire's (his personal ones
  included), and keep his phone number out of everything published.

## Working with Grégoire

- Write to him in French, informally (« tu »).
- Feel free to suggest surprising ideas, always offered as choices.
- End every report with the decisions he still has to make and hasn't given an opinion on.

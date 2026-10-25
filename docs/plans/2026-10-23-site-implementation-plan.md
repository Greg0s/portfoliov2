# Site implementation plan

- **Date**: 23 October 2026
- **Covers**: steps 2 to 12 of the main spec (§11), from the foundations to going live.
- **Sources**: the main spec (`docs/specs/2026-10-14-portfolio-design.md`), the v3 specs (journey and office), the
  measurement results (`docs/prototypes/perf/RESULTS.md`). When this plan and a spec disagree, the spec wins and this
  plan is fixed in the same change.
- **Status**: in progress; step 2 (foundations) is done, step 3 (design system) waits for Grégoire's validation, step 4
  (content) is built and its drafts wait for Grégoire's review, step 5 (static home) is built, step 6 (journey) is built and waits for the runs on real devices. Each step is updated here when it is done.

## 1. What is already decided

The measurement (step 1) is done and its conclusions are binding:

| Topic                | Decision                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Office               | real-time Three.js scene, with the pre-rendered layers as the fallback (switch under 40 fps, no WebGL, light version, reduced motion) |
| Office town          | built off the main thread (a worker); its build blocks the page for 0.6 to 1 s otherwise                                              |
| Office warm-up       | the whole scene drawn once, culling off, during the journey, so the arrival starts at 60 fps                                          |
| Office shadows       | computed once, then frozen                                                                                                            |
| Cards                | HTML and CSS 3D over the Three.js canvas, blurred with `filter: blur()`                                                               |
| Stars                | one WebGL point cloud, the twinkle computed in the shader; never animated HTML elements                                               |
| Small worlds, videos | unchanged from the mockup (HTML and CSS)                                                                                              |

## 2. Technical choices this plan makes

These are reversible choices made to keep the plan concrete. Each is checked by the tests of the step that introduces
it.

1. **One repository, the site at the root.** `src/`, `public/`, `scripts/` and `tests/` sit next to `docs/`
   (main spec §7.2). The prototypes stay separate npm packages; pnpm, ESLint and Prettier ignore `docs/prototypes/`.
2. **One canvas, one renderer, one loop.** A single full-screen `WebGLRenderer` behind the HTML draws the stars, the
   planet and the office, each its own scene. One `requestAnimationFrame` loop (`src/motion/ticker.ts`) drives the
   glides, the journey camera, the CSS transforms and the render (main spec §7.4); no Lenis or GSAP (step 6). The canvas is kept across pages with `transition:persist`. One exception (step 7): the live planet draws in its own small canvas inside the opening's planet square, so that the CSS places, floats and blurs it exactly like its fallback image; it lives only near the opening and is released past the middle of the journey. The live office is the second exception: it draws in its own canvas over the contact section, between its HTML sky and its HTML screen, and only while the contact shows; its layers need no canvas at all.
3. **One camera for CSS and WebGL.** The journey camera is a pure function of the scroll progress. It produces both
   the CSS `perspective` and transforms of the cards and small worlds, and the matching Three.js `PerspectiveCamera`
   (field of view derived from the CSS perspective), so that the stars, the planet and the cards share one space.
4. **Geometry in a worker.** The planet relief, the prince's hair and the office town are generated in one module
   worker (`src/scene/workers/geometry.worker.ts`) and sent back as transferable typed arrays, merged per material.
   The planet relief is measured at 1 to 1.9 s on the Pixel 9: on the main thread it would cost the Lighthouse score.
5. **The site's office scene is the only source.** `docs/prototypes/bureau/scene.js` is ported to TypeScript modules
   in `src/scene/office/`. The fallback layers and `placement.json` are rendered from those modules
   (`scripts/render-office-layers.ts`), never from the prototype again, so the live scene and its fallback cannot drift.
6. **The rose comes from the versioned planet model.** The office takes it from `public/models/petit-prince.glb`
   (already loaded for the opening), not from Grégoire's unversioned `projet2.glb`.
7. **Generated images are committed.** The planet fallbacks, the office layers and `placement.json` are rendered
   locally by scripts and committed (they are our own renders, at display size). CI checks their budgets; it does not
   re-render them (software WebGL in CI is slow and lacks the real rose).
8. **One quality module.** `src/scene/quality.ts` samples frame times after the warm-ups and decides the light
   version (journey under 40 fps for 3 s) and the office layers (office under 40 fps in its first seconds). URL
   overrides force each path for tests and captures: `?gl=0`, `?lite=1`, `?office=live|layers`, `?heure=aube|crepuscule`,
   `?still=1` (frozen time, for stable screenshots) and `?planete=live` (the live planet whatever the rate, for tests
   on machines without a GPU).
9. **Budgets are enforced in CI from step 2**, not only at step 11: a script measures the initial JavaScript per page
   (gzip), the model, the fallbacks, the office set, the wall images and the screen captures; Lighthouse CI runs on the
   built site, as a warning until step 7, as an error from step 7 on.
10. **Fidelity is checked against the mockup.** `scripts/compare-with-mockup.ts` shoots the site and the matching
    canvas component at the same anchor, moment and framing, and lays them side by side. The canvas files are
    downloaded into `.design-assets/canvas/` (gitignored). Every visual PR ships these pictures, desktop and mobile.
11. **Browsers.** Playwright runs the e2e suite on Chromium (main spec §9.3) and a smoke suite on WebKit, from step 6,
    since many recruiters browse on Safari.

## 3. How each step is delivered

- **Branches and pull requests**: one branch and one pull request per step (Grégoire's choice, 23 October 2026),
  opened from `main` and named `feat/<step>` (e.g. `feat/foundations`). Within a step, the work lands as a series of
  commits in the order listed per step below, each leaving CI green.
- **Done means**: CI green (lint, format, `astro check`, unit tests, build with content checks, e2e, budgets), the
  preview at `https://greg0s.github.io/portfoliov2/` up to date, the spec updated if a decision moved, this plan's
  status updated, and for anything visible, side-by-side pictures with the mockup validated by Grégoire.
- **Real devices**: at the end of steps 6, 7 and 9, a run of the preview with `?mesure=1` on Grégoire's laptop and
  Pixel 9 records the frame rates into the bench artifact, with the same phases as the measurement. Headless Chromium
  never proves a frame rate.

## 4. Order and dependencies

```
2 Foundations ─ 3 Design system ─ 4 Content ─ 5 Static home ─ 6 Journey ─ 7 3D scenes ─ 8 Interactive office ─ 9 Media and transitions ─ 11 Polish ─ 12 Go live
                                      └──────────────── 10 Writing (with Grégoire, in parallel from step 4) ───────────────┘
```

Step 10 runs alongside the build as soon as the content schema exists; it must be done before step 11.

---

## Step 2 — Foundations

**Goal**: an empty Astro site that builds, is checked and deploys to the preview.

**Status**: done (`feat/foundations`). Astro 7, TypeScript 6 (typescript-eslint does not support TypeScript 7 yet),
ESLint 10 with `eslint-plugin-jsx-a11y-x` (the ESLint 10 fork of `jsx-a11y` that `eslint-plugin-astro` accepts),
Vitest 5, Playwright. Lighthouse scores 100 in every category on both placeholder homes. A placeholder favicon avoids
a console error; step 3 replaces it.

**Pull request**: `feat/foundations`, in one go: project, tooling, CI, deployment, README, CLAUDE.md.

**Files**

| File                                                   | Content                                                                                                                                   |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                                         | `packageManager` pinned pnpm; scripts `dev`, `build`, `preview`, `lint`, `format`, `format:check`, `check`, `test`, `test:e2e`, `budgets` |
| `.nvmrc`, `.npmrc`                                     | Node 24; `engine-strict=true`                                                                                                             |
| `astro.config.ts`                                      | `output: 'static'`, `site`, `base` from `BASE_PATH` (default `/portfoliov2/`), `trailingSlash: 'always'`                                  |
| `tsconfig.json`                                        | Astro `strictest` preset, plus `noUncheckedIndexedAccess`                                                                                 |
| `eslint.config.js`                                     | flat config: `typescript-eslint` strict type-checked, `eslint-plugin-astro`, its a11y rules                                               |
| `.prettierrc`, `.prettierignore`                       | Prettier with `prettier-plugin-astro`; ignores `docs/prototypes/`, `dist/`, renders                                                       |
| `vitest.config.ts`                                     | `tests/unit/**`, `getViteConfig` from Astro                                                                                               |
| `playwright.config.ts`                                 | runs on `astro preview` of the build; projects `desktop` (1440 × 900) and `mobile` (Pixel 7)                                              |
| `src/lib/url.ts`                                       | `withBase(path)`, the only way to build an internal URL                                                                                   |
| `src/pages/index.astro`, `en/index.astro`, `404.astro` | placeholders                                                                                                                              |
| `scripts/budgets.ts`                                   | reads `dist/`, prints and asserts the budgets of main spec §9.4 that exist yet                                                            |
| `lighthouserc.json`                                    | mobile preset, home FR and EN; warnings only                                                                                              |
| `.github/workflows/ci.yml`                             | on push to `main` and pull request: install (cached), lint, format, check, unit, build, budgets, e2e, Lighthouse                          |
| `.github/workflows/deploy.yml`                         | on push to `main`: build, `actions/upload-pages-artifact`, `actions/deploy-pages`                                                         |
| `README.md`                                            | in English, for recruiters: what the site is, stack, how to run, how to add a project                                                     |
| `CLAUDE.md`                                            | the site's commands and layout, the checks of §9, the existing rules kept                                                                 |
| `.gitignore`                                           | adds `node_modules/`, `dist/`, `.astro/`, `test-results/`, `playwright-report/`                                                           |

**Tests**

- Unit: `withBase` with and without a base, with and without a leading slash, with a fragment.
- E2E: `/` and `/en/` answer, declare their `lang`, and log no console error; an unknown path serves the 404.

**Done when** the skeleton deploys to the preview and CI is green on the pull request.

**From Grégoire**: GitHub Pages enabled with "GitHub Actions" as the source (done, 23 October 2026).

---

## Step 3 — Design system

**Goal**: the charter in code, the header and mobile menu, FR/EN routing, typed interface strings, the visitor's
moment.

**Status**: built (`feat/design-system`, on top of `feat/foundations`), waiting for Grégoire's validation of the
header and menu. As built: the moment's tint is a registered custom property (`--page-tint`) on the root background, so
that the change at noon fades; the inline moment script is `applyMoment` from `src/scene/time.ts`, inlined from its
source; the menu is a native modal `<dialog>` with a Tab loop; header and menu links to an anchor of the current page
go through the blackout, links to another page navigate; the language links read "FR — Français" to screen readers
(visible text first, as WCAG 2.5.3 asks) and keep the anchor, translated. The home page shows three placeholder
sections (`#accueil`, `#projets`, `#contact`) until step 5.

**Pull request**: `feat/design-system`; commits in order: tokens, fonts, base styles and moment; then layout, header, menu,
language switch and blackout.

**Files**

| File                                              | Content                                                                                                                                                         |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/styles/tokens.css`                           | the colour tokens of §5.2, type scale of §5.1, easings and durations of §5.5                                                                                    |
| `src/styles/base.css`                             | background gradient, page tint per moment, focus ring, links, skip link, `.visually-hidden`                                                                     |
| `src/styles/fonts.css`                            | Fontsource variable Libre Franklin (roman, italic) and Manrope, Latin subset only; roman Libre Franklin and Manrope preloaded, the italic not                   |
| `src/config.ts`                                   | email `contact@gregoiretinn.es`, LinkedIn, GitHub, Instagram, CV path                                                                                           |
| `src/i18n/fr.ts`, `en.ts`                         | interface strings; `en` typed as `Record<keyof typeof fr, string>`                                                                                              |
| `src/i18n/routes.ts`                              | route ids → path per locale (`home`, `project`), `alternate(url)`, fragments per locale                                                                         |
| `src/i18n/index.ts`                               | `getLocale(url)`, `t(locale)`                                                                                                                                   |
| `src/scene/time.ts`                               | `momentAt(date)` (dawn before noon, dusk after), `?heure=` override, `onMomentChange`                                                                           |
| `src/layouts/Base.astro`                          | `<html lang>`, meta, canonical, `hreflang` and `x-default`, the inline moment script (sets `data-moment` before first paint), skip link, header, `ClientRouter` |
| `src/components/Header.astro`                     | name, Projects, Contact, FR/EN                                                                                                                                  |
| `src/components/Menu.astro`, `src/motion/menu.ts` | mobile full-screen menu, the "museum lights dimming" opening, focus trap, Escape, `aria-expanded`                                                               |
| `src/components/LanguageSwitch.astro`             | link to the equivalent page                                                                                                                                     |
| `src/motion/blackout.ts`                          | the veil: out in 0.25 s, a callback (the jump, wired at step 6), in in 0.35 s                                                                                   |

**Tests**

- Unit: FR ↔ EN paths for every route and fragment; `momentAt` at 11:59, 12:00, 00:00; `?heure=` wins over the clock.
- Type check: a key missing from `en.ts` fails `astro check`.
- E2E: the switch leads to the equivalent page; the menu opens and closes with the keyboard and gives the focus back;
  `?heure=aube` sets the dawn tint; axe finds no violation on both homes (kept on every later page).

**Done when** the empty pages exist in FR and EN, the route tests pass, and Grégoire has validated the header and menu
next to the mockup.

---

## Step 4 — Content

**Goal**: the content collections with their build-time checks, the case study page, the 8 projects drafted, the wall
collection.

**Status**: built (`feat/content`, on top of `feat/design-system`); the drafts wait for Grégoire's review. As built:
Astro 7's default Markdown processor (Sätteri) runs no remark plugins, so the site uses the `unified` processor of
`@astrojs/markdown-remark` for `remark-directive` and `:::challenge`; a rehype plugin wraps each `##` of a case study in
its section. A case study brings its own header and footer through the layout's `header` and `footer` slots; its
Contact link goes through the blackout to the home's `#contact` (the veil persists across the client router's swap).
`links` gains `gallery` (Behance for Le Petit Prince and Obaine). The challenges are styled by `CaseStudy.astro`, no
`Challenge.astro` is needed. The case study's images and videos section waits for Grégoire's media (main spec §8.2);
the wall has no picture yet, since the canvas only holds versions under 600 px: `pnpm optimize-media` makes the web
versions once the originals are in `.design-assets/wall/<frame>/`. Covers are the canvas's web versions (Obaine's is
566 px wide, blurry full width until a better one).

**Pull request**: `feat/content`; commits in order: collections, checks and case study page; the 8 drafts; the wall frames
and images.

**Files**

| File                                                                                           | Content                                                                                                                     |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `src/content.config.ts`                                                                        | collections `projects` (`*/project.yaml`), `projectTexts` (`*/{fr,en}.md`), `wall` (`*/*.yaml`), Zod schemas with `image()` |
| `src/lib/content-checks.ts`                                                                    | pure checks: FR/EN pair, unique `order`, wall image ≥ 600 px and orientation matching its frame, explicit messages          |
| `src/integrations/content-checks.ts`                                                           | Astro integration running the checks at build start, failing the build                                                      |
| `src/lib/wall.ts`                                                                              | frames fixed in code (id, type, aspect), `draw(frames, previous)`, `cartelFields(image, locale)`                            |
| `src/content/projects/<slug>/`                                                                 | `project.yaml`, `fr.md`, `en.md`, cover image, for the 8 slugs of §8.1                                                      |
| `src/content/wall/<frame>/`                                                                    | one image per frame for now, web versions with `title`, `author`, `year`, `credit`, `focus`                                 |
| `src/pages/projets/[slug].astro`, `src/pages/en/projects/[slug].astro`                         | case studies from the collections                                                                                           |
| `src/components/CaseStudy.astro`, `ProjectFacts.astro`, `Challenge.astro`, `NextProject.astro` | the page of §4                                                                                                              |
| `src/lib/markdown/challenge.ts`                                                                | remark directive `:::challenge` with its problem, solution and result                                                       |
| `scripts/optimize-media.ts`                                                                    | `sharp`: originals in `.design-assets/` → display-size web versions                                                         |

The wall images and other canvas assets are downloaded from the canvas artifact into `.design-assets/`, then only
their web versions are committed, with their credits (main spec §7.3).

**Tests**

- Unit: each content check, on fixtures (a project without `fr.md`, two equal `order`s, a 500 px image, a portrait
  image in a landscape frame) with the expected message; `draw` never gives a frame another frame's image and changes
  the image when a frame has several; `cartelFields` shows only what is known (no title: author first; nothing: no
  cartel); French film titles with the original below, English with the original only.
- E2E: the 8 case studies answer in FR and EN, number `01 / 08` to `08 / 08`, and the last "next project" leads to the
  first.

**Done when** the 8 case studies display in FR and EN and removing a `fr.md` fails the build.

**Needs from Grégoire**: read access to the old site (`Greg0s/portfolio`) and the project repositories for the drafts;
years and roles for Le Petit Prince and Obaine; Lyrix's address.

---

## Step 5 — Static home

**Goal**: the complete home without animation, usable without JavaScript, SEO basics, old URLs redirected.

**Status**: built (`feat/static-home`, on top of `feat/content`). As built: the planet of the opening is the
prototype's render for each moment, with the mockup's decor as an eager image (the page's largest paint) and the right
planet preloaded by an inline script, since only the browser knows the moment and the width; the office is one flat
picture per moment and framing, rendered from the mockup's layers with `docs/prototypes/outils`, and kept in
`.design-assets/office/` at full size; the projects are the list the journey will animate at step 6, placed from
`src/scene/slots.ts` (journey spec §5); the copy button of the email appears only with JavaScript; the sitemap comes
from `@astrojs/sitemap` and `robots.txt` points to it; `src/redirects.ts` builds the old URLs for the base path, since
Astro adds the base to the old path but not to its target, and `/index.html` is left out (it would collide with the
home). No `Seo.astro`: the layout already writes the title, the description, the canonical and the alternates.

**Pull request**: `feat/static-home`; commits in order: opening, list, contact and still office; then meta, 404, redirects
and robots.

**Files**

| File                                                 | Content                                                                                                                                                          |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/Opening.astro`                       | planet fallback per moment (LCP, `fetchpriority="high"`), name, job title, tagline, "See the projects"                                                           |
| `src/components/Journey.astro`                       | the projects as an ordered list of cards with their cartel: the same DOM the journey animates at step 6                                                          |
| `src/components/ProjectCard.astro`, `Cartel.astro`   | card (cover, link, `id` for the fragment), cartel                                                                                                                |
| `src/components/Contact.astro`, `EmailActions.astro` | "On s'écrit ?", `mailto:` link, copy button (shown only with JavaScript), links, CV, copyright                                                                   |
| `src/components/Office.astro`                        | the office layers stacked as a still image per moment and framing (renamed from `OfficeStill.astro` at step 7, when the live office and its layers came over it) |
| `scripts/render-planet-fallbacks.ts`                 | renders the planet at its opening pose per moment, desktop and mobile sizes, WebP ≤ 50 kB                                                                        |
| `public/images/planet/`, `public/images/office/`     | committed renders; office layers with the windows layer lightened (computer set under 500 kB)                                                                    |
| `src/redirects.ts`, `astro.config.ts`                | old URLs → case studies, `about.html` → `/`, `contact.html` → `/#contact`                                                                                        |
| `src/components/Seo.astro`, `public/robots.txt`      | title, description (from `summary`), canonical, alternates                                                                                                       |
| `src/pages/404.astro`                                | bilingual, links to both homes                                                                                                                                   |

**Tests**

- E2E with JavaScript disabled: the opening, the 8 projects with their cartel and the contact are visible, every link
  works, no hidden content; the planet and office fallbacks show.
- E2E: no broken internal link (crawl of every built page); the copy button copies `contact@gregoiretinn.es` and
  announces it; old URLs land on their target.
- Budgets: planet fallbacks ≤ 50 kB each, office set ≤ 500 kB; Lighthouse on the home (expected near 100).

**Done when** the home is complete and usable without JavaScript.

---

## Step 6 — Journey

**Goal**: the scroll-driven camera move, anchor to anchor, with stars in WebGL, focus, cartels, motion and reduced
motion.

**Status**: built (`feat/journey`, on top of `feat/static-home`); waits for Grégoire's runs on his laptop and Pixel 9
(`?mesure=1`). As built:

- **No Lenis, no GSAP.** The scroll stays native, snapped on the anchors by CSS (`scroll-snap-type: y mandatory`,
  one marker per anchor); `snap.ts` turns a wheel or trackpad gesture (inertia included), a swipe over 40 px or a key
  into one step, and glides there, starting at the finger's speed. The loop is a plain `requestAnimationFrame`
  (`ticker.ts`). A safety net settles any scroll left between two anchors 220 ms after it stops.
- **The camera** eases toward the scroll (130 ms on desktop, 150 ms on mobile); through the end it runs on its own
  clock, so that the arrival takes the same 3.5 s both ways.
- **Stars**: 90 far and 56 near on desktop, 50 and 36 on mobile, from the mockup's seeded sequence, rather than the
  three layers of 60, 40 and 20 planned: the site draws the mockup's sky. Three.js loads after the page
  (initial JavaScript of the home: 11 kB gzip).
- **At rest**, only the weightless motions move, a few px per second: the loop draws them 20 times a second; a glide,
  the mouse or a hover draws at every frame. Drawing a frame never reads the layout back.
- **Reduced motion, `?lite=1`, no JavaScript or no 3D CSS**: the list of step 5. Only the job title changes, in a
  500 ms fade (main spec §5.5). `?still=1` freezes time, `?gl=0` turns WebGL off, `?mesure=1` plays the journey by
  itself and shows the frame rates per phase (opening, projects, rest, end) as JSON to copy into the bench.
- **E2E**: wheel, swipe (CDP touch events) and keys go through every anchor to the contact; fragments, Tab and Enter,
  reduced motion, `?lite=1`, the measurement run; a smoke test on WebKit (Desktop Safari) in CI. The long-task check
  became "no frame of the journey forces a layout": without a GPU, Chromium composites in software and its commits
  alone exceed 50 ms, whatever the page does.
- **Lighthouse** (warning until step 7): the home's performance falls from 100 to about 55 in headless Chromium,
  where the continuous animation is composited in software and every frame counts as blocking time. Step 7 must start
  the ambient motions and the planet's render once the page has settled, to keep 90.

**Pull request**: `feat/journey`; commits in order: camera, anchors, steps, snapping and keyboard; renderer, star cloud and
small worlds; floating, cursor, tilt, drift, job title, blackout jump and reduced motion.

**Files**

| File                                                         | Content                                                                                                                                              |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/motion/ticker.ts`                                       | the only loop (`requestAnimationFrame`): the glides, the camera, the CSS and the render; paused when the tab is hidden                               |
| `src/scene/journey/anchors.ts`                               | anchor positions over 12.5 screens (opening 1, each project 1.25, the end 1.5)                                                                       |
| `src/scene/journey/steps.ts`                                 | `f(s) = s + k · sin(2πs) / 2π`, `k = 0.75`                                                                                                           |
| `src/scene/journey/camera.ts`                                | progress → camera depth; per object: scale, blur (sharp within ±10 %, up to 12 px), opacity (down to 0.25); CSS and Three.js cameras from one source |
| `src/scene/journey/layout.ts`                                | the 8 card slots (desktop and mobile, journey spec §5), 21/16 small worlds                                                                           |
| `src/scene/journey/snap.ts`                                  | a gesture (wheel, trackpad with inertia, touch, keys) → next or previous anchor, never blocking native scroll                                        |
| `src/scene/journey/journey.ts`                               | applies the transforms, cartel in 300 ms / out 200 ms, focus → anchor, fragments                                                                     |
| `src/scene/renderer.ts`                                      | the shared `WebGLRenderer`: pixel ratio capped (2, 1.5 on phones), context loss, visibility                                                          |
| `src/scene/stars/stars.ts`, `stars.glsl.ts`                  | one `Points` geometry, three layers (about 60, 40, 20), twinkle 2.5 to 7 s in the shader; the trails of step 7 reuse it                              |
| `src/components/SmallWorlds.astro`                           | the small worlds in SVG and CSS                                                                                                                      |
| `src/motion/float.ts`, `cursor.ts`, `tilt.ts`, `jobTitle.ts` | floating, "See the project" disc and mobile pill, camera drift and mouse tilt, the weightless job title                                              |
| `src/motion/reducedMotion.ts`                                | list mode, still opening, fade-only transitions                                                                                                      |

**Tests**

- Unit: `f(0) = 0`, `f(1) = 1`, `f` increasing, speed 25 % at the middle and 175 % at the ends; property test
  (fast-check): any sequence of gestures ends on an anchor; at each project anchor, its card has zero blur and the
  others are blurred; a point projected by the CSS camera and by the Three.js camera lands on the same pixel (± 0.5 px).
- E2E (desktop and mobile): wheel, touch and keyboard each go from the opening to the contact through every anchor;
  `#<slug>` and `#contact` land directly; Tab brings each project sharp with its cartel and Enter opens it; with
  reduced motion the projects are a list and two screenshots one second apart are identical; no long task over 50 ms
  while scrolling (PerformanceObserver); WebKit smoke.
- Visual: screenshots at every anchor, both moments, desktop and mobile, next to the mockup.

**Done when** the journey goes from the opening to the contact by finger, wheel and keyboard, the reduced-motion e2e
test passes, and the Pixel 9 run holds 60 fps on the journey.

---

## Step 7 — 3D scenes

**Goal**: the live planet, then the live office with its arrival, warm-up, layers fallback and light version.

**Pull request**: `feat/3d-scenes`; commits in order: the planet (model, relief in the worker, lights, wind, handoff to
image); the live office (ported scene, town in the worker, warm-up, arrival, head, room life); the quality module,
office layers and light version.

**Files**

| File                                                                                       | Content                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public/models/petit-prince.glb`                                                           | the optimized model (≤ 600 kB), from `docs/prototypes/petit-prince/`                                                                                                                        |
| `src/scene/workers/geometry.worker.ts`                                                     | planet relief and hair, office town; seeded, merged per material, transferable                                                                                                              |
| `src/scene/planet/load.ts`, `planet.ts`, `lights.ts`, `wind.ts`                            | loading (Meshopt, unnamed child meshes), spot per moment, scarf wave and rose sway with gusts, bloom on the decor only                                                                      |
| `src/scene/planet/handoff.ts`                                                              | once a blurred light: stop the scene, cross-fade to the image, free the GPU memory before the office                                                                                        |
| `src/scene/office/room.ts`, `objects.ts`, `town.ts`, `sky.ts`, `moments.ts`, `framings.ts` | the port of `docs/prototypes/bureau/scene.js`                                                                                                                                               |
| `src/scene/office/corners.ts`                                                              | screen and picture corners projected every frame                                                                                                                                            |
| `src/scene/office/warmup.ts`                                                               | from mid-journey (or at once on `#contact`): build, compile (`compileAsync`), upload, one draw culling off                                                                                  |
| `src/scene/office/arrival.ts`                                                              | the 3.5 s arrival on its own clock: light-speed jump (star trails, anamorphic flare), sky rising, town rising, window frame, room unfolding, town receding from 1.6×, welcome shooting star |
| `src/scene/office/head.ts`, `life.ts`                                                      | head follows the mouse (damped 0.5 s), clouds, town windows, shooting stars                                                                                                                 |
| `src/scene/office/layers.ts`                                                               | the layers fallback, as in the mockup, behind the same HTML as the live office (`view.ts`), in place of its canvas                                                                          |
| `src/scene/quality.ts`                                                                     | frame sampling, light version, office switch, URL overrides                                                                                                                                 |
| `scripts/render-office-layers.ts`                                                          | renders the layers and `placement.json` from `src/scene/office/`                                                                                                                            |

**Tests**

- Unit: same seed, same relief and same town (hash of the buffers); projected corners match `placement.json` within
  1 px for both framings; the quality module picks the light version or the layers from synthetic frame times; the
  moment cross-fades at noon.
- E2E: `?gl=0` shows both fallbacks; `?office=layers` and `?office=live` both reach the seated view; `?lite=1` gives
  the list without 3D; no console error; no long task over 100 ms during the journey, office preparation included
  (proves the worker); network log: nothing of the office before the first project, office set ≤ 500 kB.
- Budgets: Lighthouse performance ≥ 90 on mobile becomes an error.
- Visual: the opening and the seated office, both moments, desktop and mobile, next to the mockup.

**Done when** the scenes hold the §9.4 budgets, degrade cleanly on mobile, Lighthouse performance stays at 90 or more,
and the Pixel 9 and laptop runs hold 60 fps from the arrival on.

---

## Step 8 — Interactive office

**Goal**: the screen (Windows desktop, Firefox, Thunderbird, Recycle Bin), the wall (draw, placement, cartels), the
email actions.

**Pull request**: `feat/interactive-office`; commits in order: the screen (desktop, taskbar, apps, captures, Recycle Bin); the
wall (pictures, cartels, mobile small frame); the email actions (copy button states, mobile bubble).

**Files**

| File                                              | Content                                                                                                                                        |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/quad.ts`                                 | `quadMatrix(w, h, corners)`, from `docs/prototypes/perf/src/quad.js` (done at step 7)                                                          |
| `src/components/office/Screen.astro`              | the Windows 11 dark desktop, taskbar, Firefox, Thunderbird and the Recycle Bin's dialogs, as a template the office view copies onto the screen |
| `src/scene/office/screen.ts`                      | open from the icon in 0.4 s, tabs, address bar, slow scroll after 1.1 s (≤ 140 px/s), close after 0.6 s, the Recycle Bin, the taskbar clock    |
| `src/scene/office/wall.ts`                        | the cartels over the pictures, moved with the head; the draw and the redraw in the blackout run in `view.ts`                                   |
| `src/components/EmailActions.astro`               | the copy button, and the mobile bubble ("Copier \| Envoyer un mail")                                                                           |
| `scripts/optimize-screen.ts`                      | `pnpm optimize-screen`: the originals in `.design-assets/screen/` → `public/images/screen/` and `public/images/taskbar/`                       |
| `public/images/screen/`, `public/images/taskbar/` | captures (WebP, 1280 px, LinkedIn in two slices), wallpaper; the icons as one WebP strip, from the mockup's                                    |

**Tests**

- Unit: `quadMatrix` maps the four corners exactly; the cartel placement avoids the contact text.
- E2E (desktop), rewritten from `docs/prototypes/outils/interactions/`: hovering each link opens its app and tab,
  leaving closes it after 0.6 s; the Recycle Bin dialog, "Oui", the blackout, then the message; after the draw every
  picture stays inside its frame's quad; captures are not loaded before the first hover; the copy icon becomes a check
  for 1.8 s.
- E2E (mobile): tapping the email opens the bubble, "Copier" shows "Copié"; links open directly; no capture is
  downloaded; tapping the small frame shows its cartel.
- Budgets: captures ≤ 1.5 MB, icons ≤ 40 kB, each wall image ≤ 40 kB.

**Done when** every contact link shows its page on the screen and emptying the Recycle Bin redraws the wall.

---

## Step 9 — Media and transitions

**Goal**: card videos, the dive into a case study and back, next project, scenes kept by the router.

**Pull request**: `feat/media-transitions`; commits in order: card videos, then the dive transition.

**Files**

| File                           | Content                                                                                                                           |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `src/scene/journey/videos.ts`  | only the sharp card and its two neighbours load; only the sharp one plays; poster with reduced motion                             |
| `src/motion/dive.ts`           | card flies over 0.9 s onto the opening media's place, keeping its format; named view transition, fragment kept, reverse on return |
| `src/components/YouTube.astro` | `youtube-nocookie.com` loaded on click                                                                                            |
| `src/layouts/Base.astro`       | `transition:persist` on the canvas and the journey; scenes paused on case studies                                                 |

**Tests**

- E2E: open a case study from the journey, then "Back to projects" and the browser's Back button both return to the
  same sharp project; "Next project" chains to the first after the last; at most three videos loaded and one playing;
  without view transitions the fallback fade works; `/#contact` from a case study goes through the blackout.
- Budgets: each loop ≤ 4 MB.

**Done when** the full journey is smooth and degrades cleanly (Pixel 9 and laptop runs).

**Needs from Grégoire**: the 8 loop videos.

---

## Step 10 — Writing

**Goal**: complete FR and EN case studies, CV, HD visuals, wall images and credits.

**Tasks**: Claude drafts from the old site and the repositories (step 4); Grégoire corrects and completes; a build
check fails on placeholders (`[année]`, `TODO`) in production builds.

**Done when** Grégoire has read and validated everything.

---

## Step 11 — Polish

**Goal**: accessibility, performance, SEO, share images, sitemap, the full e2e suite.

**Files**: `@astrojs/sitemap` with alternates; `scripts/render-share-images.ts` (1200 × 630 per page); `Person`
JSON-LD; favicons; the last §9.3 tests.

**Tests**: axe on every page in both languages; a manual pass with VoiceOver and TalkBack; Lighthouse mobile ≥ 90
performance, 100 accessibility, 100 SEO as errors; WebKit e2e on the whole suite.

**Done when** the Lighthouse targets are met.

---

## Step 12 — Go live

**Tasks**: main spec §10, with Grégoire's explicit approval at that moment: remove the custom domain from
`Greg0s/portfolio`, set `gregoiretinn.es` on this repository and `BASE_PATH=/`, check HTTPS and the old URLs, archive
the old repository.

**Tests**: a post-deploy smoke test against the production address (pages, redirects, HTTPS).

**Done when** `gregoiretinn.es` serves the new site over HTTPS and the old repository is archived.

## 5. Risks this plan adds to main spec §12

| Risk                                                | Answer                                                                                   |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| CSS cards and WebGL stars drifting apart            | one camera function for both, tested to half a pixel                                     |
| Live office and its layers diverging                | layers rendered from the site's own scene; corners test against `placement.json`         |
| A 40 fps threshold measured during first-time costs | sampled after the warm-ups, first frames excluded                                        |
| No iPhone measured in step 1                        | WebKit e2e from step 6; a real iPhone run if one is available                            |
| Worker support for the geometry                     | module workers are supported by every target browser; the fallback layers cover the rest |

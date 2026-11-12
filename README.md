# Grégoire Tinnes — portfolio

The portfolio of Grégoire Tinnes, creative developer. The home page is one scroll-driven camera move
through the night, in three stops: the Little Prince's planet, alive in the wind; a ring of seven projects turning
around it, each one a card with its label; and the desk of the dreamer who watches the planet, where the computer
screen, the picture wall and the contact links live. Each project opens into a case study, in French and in English.

**Live**: [gregoiretinn.es](https://gregoiretinn.es)

## Stack

- [Astro](https://astro.build), static output, strict TypeScript
- [Three.js](https://threejs.org) for the planet, the stars and the office; the project cards stay in HTML and CSS 3D
  over the canvas, so they remain accessible
- Native scrolling, with no smooth-scroll or animation library
- Vitest, Playwright and Lighthouse CI; deployed to GitHub Pages by GitHub Actions

Everything stays readable without JavaScript, without WebGL and with reduced motion: the 3D is decoration over
semantic HTML.

## Run it

Node 24 and pnpm (the version is pinned in `package.json`; `corepack enable` provides it).

```sh
pnpm install
pnpm dev          # http://localhost:4321/
```

| Command             | What it does                                                    |
| ------------------- | --------------------------------------------------------------- |
| `pnpm dev`          | development server                                              |
| `pnpm build`        | static build into `dist/`                                       |
| `pnpm preview`      | serves `dist/` as GitHub Pages does                             |
| `pnpm lint`         | ESLint (TypeScript type-checked rules, Astro, accessibility)    |
| `pnpm format:check` | Prettier (`pnpm format` rewrites)                               |
| `pnpm check`        | `astro check`: types, translation keys included                 |
| `pnpm test`         | unit tests (Vitest)                                             |
| `pnpm test:e2e`     | end-to-end tests on the built site (Playwright, desktop/mobile) |
| `pnpm budgets`      | checks the performance budgets on `dist/`                       |

The site is built for the root of https://gregoiretinn.es. Set `BASE_PATH` (e.g. `/portfoliov2/`) and `SITE_URL` to
build it for another address; every internal link goes through `withBase()` in `src/lib/url.ts`.

## Add a project

Each project is a folder in `src/content/projects/<slug>/`:

- `project.yaml` for what does not translate: `order`, `year`, `stack`, `links`, `cover`, its two accent `colors`, and
  card's video loop;
- `fr.md` and `en.md` for the title, kind, role, summary and the case study itself.

The build fails with an explicit message if a field is missing, a translation is missing or two projects share the
same `order`.

## Repository

| Path               | Content                                                                 |
| ------------------ | ----------------------------------------------------------------------- |
| `src/`             | the site                                                                |
| `public/`          | files served as they are                                                |
| `scripts/`         | build-time scripts (budgets, renders)                                   |
| `tests/`           | `unit/` (Vitest) and `e2e/` (Playwright)                                |
| `docs/specs/`      | design specs (in French), the source of truth                           |
| `docs/plans/`      | the step-by-step implementation plan                                    |
| `docs/prototypes/` | Three.js prototypes and the performance bench, each its own npm package |

## Credits

Code by Grégoire Tinnes. The images of third parties shown on the office wall are credited where they appear.

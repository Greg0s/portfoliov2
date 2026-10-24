# Grégoire Tinnes — portfolio

The portfolio of Grégoire Tinnes, creative developer: "I code images." The home page is a single camera move
back through the night, from the Little Prince's planet, past eight projects hung like works in a museum, to the desk
of the dreamer who watches the planet. Each project opens into a case study, in French and in English.

- **Preview**: https://greg0s.github.io/portfoliov2/ (under construction; the current site stays at
  [gregoiretinn.es](https://gregoiretinn.es) until this one goes live)
- **Contact**: contact@gregoiretinn.es

## Stack

- [Astro](https://astro.build), static output, strict TypeScript
- [Three.js](https://threejs.org) for the planet, the stars and the office; the project cards stay in HTML and CSS 3D
  over the canvas, so they remain accessible
- [GSAP](https://gsap.com) and [Lenis](https://lenis.darkroom.engineering) for one animation loop over native scrolling
- Vitest, Playwright and Lighthouse CI; deployed to GitHub Pages by GitHub Actions

Everything stays readable without JavaScript, without WebGL and with reduced motion: the 3D is decoration over
semantic HTML.

## Run it

Node 24 and pnpm (the version is pinned in `package.json`; `corepack enable` provides it).

```sh
pnpm install
pnpm dev          # http://localhost:4321/portfoliov2/
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

The site is served under `/portfoliov2/` during the preview. Set `BASE_PATH=/` to build it for the root of a domain;
every internal link goes through `withBase()` in `src/lib/url.ts`.

## Add a project

From step 4 of the build, each project is a folder in `src/content/projects/<slug>/`:

- `project.yaml` for what does not translate: `order`, `year`, `stack`, `links`, `cover`, and the card's video loop;
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

/**
 * The content collections (main spec §7.3). Each file is checked against its schema when the site builds; the checks
 * across files (a missing translation, a shared order, a wall picture too small or of the wrong shape) run in
 * src/integrations/content-checks.ts.
 */
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const focus = z
  .string()
  .regex(/^\d{1,3}% \d{1,3}%$/, 'a focus is an object-position such as "50% 30%"')
  .optional();

/** What does not translate: one `project.yaml` per project folder. The entry id is the folder name, the slug. */
const projects = defineCollection({
  loader: glob({
    pattern: '*/project.yaml',
    base: './src/content/projects',
    generateId: ({ entry }) => entry.split('/')[0] ?? entry,
  }),
  schema: ({ image }) =>
    z.strictObject({
      order: z.number().int().min(1),
      year: z.number().int().min(2000).max(2100),
      stack: z.array(z.string().min(1)).min(1),
      links: z
        .strictObject({
          live: z.url().optional(),
          code: z.url().optional(),
          video: z.url().optional(),
          /** A gallery of the project elsewhere, such as Behance. */
          gallery: z.url().optional(),
        })
        .default({}),
      cover: image(),
      coverFocus: focus,
      /** The card's muted video loop, added at step 9. */
      loop: z.string().optional(),
    }),
});

/** The texts of each project, one file per language: `<slug>/fr.md` and `<slug>/en.md`, ids `<slug>/<locale>`. */
const projectTexts = defineCollection({
  loader: glob({
    pattern: '*/{fr,en}.md',
    base: './src/content/projects',
    generateId: ({ entry }) => entry.replace(/\.md$/, ''),
  }),
  schema: z.strictObject({
    title: z.string().min(1),
    kind: z.string().min(1),
    role: z.string().min(1),
    /** The short description of the card's label, also the page's meta description. */
    summary: z.string().min(1).max(200),
    /** The lede of the case study; the summary when absent. */
    lede: z.string().min(1).optional(),
    coverAlt: z.string().min(1),
  }),
});

const localized = z.strictObject({ fr: z.string().min(1), en: z.string().min(1) });

/** One picture of the wall per `<frame>/<picture>.yaml`, next to its image. */
const wall = defineCollection({
  loader: glob({ pattern: '*/*.yaml', base: './src/content/wall' }),
  schema: ({ image }) =>
    z.strictObject({
      image: image(),
      title: z.union([z.string().min(1), localized]).optional(),
      originalTitle: z.string().min(1).optional(),
      author: z.string().min(1).optional(),
      place: z.string().min(1).optional(),
      year: z.number().int().optional(),
      credit: z.string().min(1).optional(),
      focus,
    }),
});

export const collections = { projects, projectTexts, wall };

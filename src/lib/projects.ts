/**
 * The projects in one language: each project's data joined with its text, in the order of the journey. The case
 * studies, and the home from step 5, read the projects only through here.
 */
import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import type { Locale } from '../i18n';

export interface Project {
  slug: string;
  data: CollectionEntry<'projects'>['data'];
  text: CollectionEntry<'projectTexts'>;
}

export async function getProjects(locale: Locale): Promise<Project[]> {
  const projects = await getCollection('projects');
  const joined = await Promise.all(
    projects.map(async ({ id, data }) => {
      const text = await getEntry('projectTexts', `${id}/${locale}`);
      // The build checks already fail on a missing text; this keeps the types honest.
      if (!text) throw new Error(`Project "${id}" has no ${locale}.md.`);
      return { slug: id, data, text };
    }),
  );
  return joined.sort((a, b) => a.data.order - b.data.order);
}

/**
 * The widths a project's cover is served at, up to its own: the case study's opening media, and wherever the next
 * page's cover is shown or loaded ahead (the next project's band, a swipe), so that the browser fetches it once.
 */
export function coverWidths(cover: { width: number }): number[] {
  return [640, 960, 1280, 1920].filter((width) => width < cover.width).concat(cover.width);
}

/** A project's number as the case study shows it: `01`. */
export function projectNumber(order: number): string {
  return String(order).padStart(2, '0');
}

/** A project's tag: `2024 — Three.js · génératif`. */
export function projectTag(project: Project): string {
  return `${String(project.data.year)} — ${project.text.data.kind}`;
}

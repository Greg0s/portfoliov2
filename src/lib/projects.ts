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

/** A project's number as the case study shows it: `01`. */
export function projectNumber(order: number): string {
  return String(order).padStart(2, '0');
}

/** A project's tag: `2024 — Three.js · génératif`. */
export function projectTag(project: Project): string {
  return `${String(project.data.year)} — ${project.text.data.kind}`;
}

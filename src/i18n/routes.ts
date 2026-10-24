/**
 * The site's routes in each language, defined in one place (main spec §4 and §7.3): French at the root, English
 * under `/en/`. Paths here never carry the base path; `withBase` adds it.
 */

export const locales = ['fr', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'fr';

export type Route = { id: 'home' } | { id: 'project'; slug: string };

const projectDir: Record<Locale, string> = { fr: 'projets', en: 'projects' };

/** The path of a route in a language, e.g. `/en/projects/lyrix/`. */
export function pathFor(route: Route, locale: Locale): string {
  const prefix = locale === defaultLocale ? '/' : `/${locale}/`;
  switch (route.id) {
    case 'home':
      return prefix;
    case 'project':
      return `${prefix}${projectDir[locale]}/${route.slug}/`;
  }
}

/** Reads a path without its base: its language, and its route when the site has one there. */
export function parsePath(path: string): { locale: Locale; route: Route | undefined } {
  const segments = path.split(/[?#]/)[0]?.split('/').filter(Boolean) ?? [];
  const first = segments[0];
  const locale: Locale = locales.find((l) => l !== defaultLocale && l === first) ?? defaultLocale;
  const rest = locale === defaultLocale ? segments : segments.slice(1);

  if (rest.length === 0) return { locale, route: { id: 'home' } };
  const [dir, slug, ...extra] = rest;
  if (dir === projectDir[locale] && slug && extra.length === 0) return { locale, route: { id: 'project', slug } };
  return { locale, route: undefined };
}

/** Anchors of the home page, named in each language (main spec §4); a project's anchor is its slug. */
export const fragments = {
  opening: { fr: 'accueil', en: 'home' },
  projects: { fr: 'projets', en: 'projects' },
  contact: { fr: 'contact', en: 'contact' },
} as const satisfies Record<string, Record<Locale, string>>;

export type Fragment = keyof typeof fragments;

/** A fragment in another language; a project's slug, or an unknown fragment, stays as it is. */
export function translateFragment(fragment: string, to: Locale): string {
  for (const names of Object.values(fragments)) {
    if (Object.values(names).some((name) => name === fragment)) return names[to];
  }
  return fragment;
}

/**
 * The equivalent of a page in another language, with its fragment translated. A page the site does not know (the
 * 404) leads to the other language's home.
 */
export function alternate(path: string, to: Locale): string {
  const hash = path.includes('#') ? path.slice(path.indexOf('#') + 1) : '';
  const { route } = parsePath(path);
  const target = pathFor(route ?? { id: 'home' }, to);
  return hash ? `${target}#${translateFragment(hash, to)}` : target;
}

/**
 * The sitemap's language alternates. `@astrojs/sitemap` pairs pages by their language prefix only, which misses the
 * case studies (`/projets/<slug>/` and `/en/projects/<slug>/`): each page gets its alternates from the site's own
 * routes instead, the same ones the pages' `hreflang` links use.
 */
import { stripBase } from '../i18n';
import { alternate, defaultLocale, locales, parsePath } from '../i18n/routes';
import { joinBase } from './url';

export interface SitemapLink {
  lang: string;
  url: string;
}

/** Every language version of a page of the site, given its absolute URL; none for a page outside the routes. */
export function sitemapLinks(url: string, base: string): SitemapLink[] {
  const { origin, pathname } = new URL(url);
  const path = stripBase(pathname, base);
  if (!parsePath(path).route) return [];
  const links = locales.map((lang) => ({ lang, url: `${origin}${joinBase(base, alternate(path, lang))}` }));
  const fallback = links.find(({ lang }) => lang === defaultLocale);
  return fallback ? [...links, { lang: 'x-default', url: fallback.url }] : links;
}

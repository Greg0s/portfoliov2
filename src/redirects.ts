/**
 * The old site's URLs (main spec §4): the pages of the projects the v3 keeps lead to their case study, `about.html`
 * to the home and `contact.html` to the contact. The old site is `Greg0s/portfolio`, whose pages were `<slug>.html`
 * at the root; anything else lands on the 404.
 */
import { pathFor } from './i18n/routes';
import { joinBase } from './lib/url';

/** The old page of each project kept in the v3, by slug. */
const projects: Record<string, string> = {
  'la-fabrique-des-mondes': 'la-fabrique-des-mondes',
  'what-we-play': 'what-we-play',
  'litterature-combinatoire': 'litterature-combinatoire',
  'sncf-wrapped': 'sncf-wrapped',
  recoding: 'recoding',
  'le-petit-prince': 'le-petit-prince',
  obaine: 'obaine',
};

/**
 * Old path (without the base) → new path, for Astro's `redirects`. Astro adds the base to the old path, never to the
 * target, so the targets carry it (`withBase`). `/index.html` is left out: it would collide with the home page.
 */
const home = pathFor({ id: 'home' }, 'fr');

/** The old URLs for a base path; the configuration passes its own, since `import.meta.env` is not set there. */
export function buildRedirects(base: string): Record<string, string> {
  const to = (path: string): string => joinBase(base, path);
  return {
    '/about.html': to(home),
    '/contact.html': to(`${home}#contact`),
    // The promotional video of Littérature & Combinatoire was its own page; it is part of that case study now.
    '/litterature-combinatoire-pub.html': to(pathFor({ id: 'project', slug: 'litterature-combinatoire' }, 'fr')),
    ...Object.fromEntries(
      Object.entries(projects).map(([page, slug]) => [`/${page}.html`, to(pathFor({ id: 'project', slug }, 'fr'))]),
    ),
  };
}

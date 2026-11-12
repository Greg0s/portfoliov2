/**
 * The pictures and descriptions a link to the site shows when it is shared (plan step 11): Open Graph and Twitter
 * cards, and the page's JSON-LD. The share images are rendered from the built site by `scripts/render-share-images.ts`.
 */
import { config } from '../config';
import type { Locale } from '../i18n/routes';

export { SHARE_DIR, SHARE_SIZE, shareImagePath } from './share-image';

/** Open Graph's locale for each language. */
export const ogLocales: Record<Locale, string> = { fr: 'fr_FR', en: 'en_US' };

/** The person the site is about, as schema.org reads him, with his profiles; one `@id` across the site. */
export function person(siteUrl: string, jobTitle: string): Record<string, unknown> {
  return {
    '@type': 'Person',
    '@id': `${siteUrl}#person`,
    name: config.name,
    jobTitle,
    url: siteUrl,
    sameAs: Object.values(config.links),
  };
}

/** The home's JSON-LD: the site and the person it presents. */
export function homeData(options: {
  siteUrl: string;
  locale: Locale;
  description: string;
  jobTitle: string;
  image: string;
}): Record<string, unknown> {
  const { siteUrl, locale, description, jobTitle, image } = options;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { ...person(siteUrl, jobTitle), image },
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}#website`,
        url: siteUrl,
        name: config.name,
        description,
        inLanguage: locale,
        author: { '@id': `${siteUrl}#person` },
      },
    ],
  };
}

/** A case study's JSON-LD: the project, made by the person the site presents. */
export function caseStudyData(options: {
  siteUrl: string;
  url: string;
  locale: Locale;
  name: string;
  description: string;
  image: string;
  year: number;
  keywords: readonly string[];
  jobTitle: string;
}): Record<string, unknown> {
  const { siteUrl, url, locale, name, description, image, year, keywords, jobTitle } = options;
  return {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    '@id': `${url}#work`,
    url,
    name,
    description,
    image,
    dateCreated: String(year),
    inLanguage: locale,
    keywords: keywords.join(', '),
    author: person(siteUrl, jobTitle),
  };
}

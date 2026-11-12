/**
 * Where the share images are, apart from the rest of `share.ts` so that `scripts/render-share-images.ts`, run by
 * Node, can read it without Astro's resolution.
 */
import type { Locale } from '../i18n/routes';

/** Where the share images live, under `public/`, and their size: the 1.91:1 every network crops to. */
export const SHARE_DIR = '/images/share';
export const SHARE_SIZE = { width: 1200, height: 630 } as const;

/** The share image of a page: the home (`home`) or a case study (its slug), in a language. */
export function shareImagePath(locale: Locale, page: string): string {
  return `${SHARE_DIR}/${locale}/${page}.jpg`;
}

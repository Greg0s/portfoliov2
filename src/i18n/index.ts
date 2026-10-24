import { en } from './en';
import { fr, type Key } from './fr';
import { parsePath, type Locale } from './routes';

export { alternate, defaultLocale, fragments, locales, pathFor, type Locale } from './routes';

const dictionaries: Record<Locale, Record<Key, string>> = { fr, en };

/** Removes the base path from a pathname, so that routes can be read the same in the preview and in production. */
export function stripBase(pathname: string, base: string = import.meta.env.BASE_URL): string {
  const prefix = `/${base.replace(/^\/+|\/+$/g, '')}`;
  if (prefix !== '/' && (pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return pathname.slice(prefix.length) || '/';
  }
  return pathname;
}

/** The language of a page, from its URL. */
export function getLocale(url: URL): Locale {
  return parsePath(stripBase(url.pathname)).locale;
}

/** The interface strings of a language. */
export function t(locale: Locale): (key: Key) => string {
  const dictionary = dictionaries[locale];
  return (key) => dictionary[key];
}

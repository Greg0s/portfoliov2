/**
 * Builds internal URLs. Every internal link goes through `withBase`, so that the site works both under the preview's
 * base path (`/portfoliov2/`) and at the root after going live (main spec §7.3).
 */

/**
 * Joins a base path and a site path. Pages get a trailing slash (the site uses `trailingSlash: 'always'`); files,
 * whose last segment has an extension, do not. A query string or a fragment is kept as is.
 */
export function joinBase(base: string, path: string): string {
  const prefix = `/${base.replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/$/, '/');
  const match = /^([^?#]*)(.*)$/.exec(path);
  const pathname = (match?.[1] ?? '').replace(/^\/+/, '');
  const suffix = match?.[2] ?? '';
  const lastSegment = pathname.split('/').at(-1) ?? '';
  const isFile = lastSegment.includes('.');
  const page = pathname === '' || isFile || pathname.endsWith('/') ? pathname : `${pathname}/`;
  return `${prefix}${page}${suffix}`;
}

/** Prefixes a site path with the base path of the current build. */
export function withBase(path: string): string {
  return joinBase(import.meta.env.BASE_URL, path);
}

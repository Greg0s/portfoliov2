import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import contentChecks from './src/integrations/content-checks';
import { sitemapLinks } from './src/lib/sitemap';
import { buildRedirects } from './src/redirects';

// The site lives at the root of https://gregoiretinn.es (main spec §10); BASE_PATH and SITE_URL build it for elsewhere.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  output: 'static',
  site: process.env.SITE_URL ?? 'https://gregoiretinn.es',
  base,
  trailingSlash: 'always',
  // The old site's URLs (main spec §4); static pages that send the visitor on.
  redirects: buildRedirects(base),
  // Only where the code asks for it: a card's case study, from the first touch (src/motion/dive.ts).
  prefetch: { prefetchAll: false },
  integrations: [
    contentChecks(),
    sitemap({
      // Each page with its language versions, from the site's routes (the case studies' paths differ by language).
      serialize: (item) => ({ ...item, links: sitemapLinks(item.url, base) }),
    }),
  ],
});

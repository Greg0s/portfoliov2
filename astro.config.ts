import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import remarkDirective from 'remark-directive';
import contentChecks from './src/integrations/content-checks';
import { remarkChallenge } from './src/lib/markdown/challenge';
import { rehypeSections } from './src/lib/markdown/sections';
import { buildRedirects } from './src/redirects';

// The preview lives under /portfoliov2/ on GitHub Pages; going live (main spec §10) sets BASE_PATH to "/".
const base = process.env.BASE_PATH ?? '/portfoliov2/';

export default defineConfig({
  output: 'static',
  site: process.env.SITE_URL ?? 'https://greg0s.github.io',
  base,
  trailingSlash: 'always',
  // The old site's URLs (main spec §4); static pages that send the visitor on.
  redirects: buildRedirects(base),
  // Only where the code asks for it: a card's case study, from the first touch (src/motion/dive.ts).
  prefetch: { prefetchAll: false },
  integrations: [contentChecks(), sitemap({ i18n: { defaultLocale: 'fr', locales: { fr: 'fr', en: 'en' } } })],
  markdown: {
    // The case studies need remark directives (`:::challenge`), which the default Markdown processor does not run.
    processor: unified({ remarkPlugins: [remarkDirective, remarkChallenge], rehypePlugins: [rehypeSections] }),
  },
});

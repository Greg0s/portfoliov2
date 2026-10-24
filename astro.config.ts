import { unified } from '@astrojs/markdown-remark';
import { defineConfig } from 'astro/config';
import remarkDirective from 'remark-directive';
import contentChecks from './src/integrations/content-checks';
import { remarkChallenge } from './src/lib/markdown/challenge';
import { rehypeSections } from './src/lib/markdown/sections';

// The preview lives under /portfoliov2/ on GitHub Pages; going live (main spec §10) sets BASE_PATH to "/".
const base = process.env.BASE_PATH ?? '/portfoliov2/';

export default defineConfig({
  output: 'static',
  site: process.env.SITE_URL ?? 'https://greg0s.github.io',
  base,
  trailingSlash: 'always',
  integrations: [contentChecks()],
  markdown: {
    // The case studies need remark directives (`:::challenge`), which the default Markdown processor does not run.
    processor: unified({ remarkPlugins: [remarkDirective, remarkChallenge], rehypePlugins: [rehypeSections] }),
  },
});

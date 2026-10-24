import { defineConfig } from 'astro/config';

// The preview lives under /portfoliov2/ on GitHub Pages; going live (main spec §10) sets BASE_PATH to "/".
const base = process.env.BASE_PATH ?? '/portfoliov2/';

export default defineConfig({
  output: 'static',
  site: process.env.SITE_URL ?? 'https://greg0s.github.io',
  base,
  trailingSlash: 'always',
});

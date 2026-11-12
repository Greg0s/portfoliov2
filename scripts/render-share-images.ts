/**
 * Renders the share images (plan step 11): the 1200 × 630 picture a link to the site shows on LinkedIn, WhatsApp,
 * Slack or iMessage, one per page and language, taken from the built site itself so that it always looks like the
 * page it leads to. The home shows the opening (the planet, the name and "Développeur créatif"); a case study shows
 * its cover, its title and its tag. The header, the call to action, the case study's lede and its content are left
 * out: a share image is a poster, not a screenshot. Always at dusk, the darker moment, which reads best in a feed.
 *
 * Usage: `pnpm build`, then `pnpm render-share-images`. Writes `public/images/share/<locale>/<page>.jpg`, which
 * `src/lib/share-image.ts` points to. Playwright's Chromium is used; CHROMIUM_PATH points to another one.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { pathFor } from '../src/i18n/routes.ts';
import { SHARE_DIR, SHARE_SIZE } from '../src/lib/share-image.ts';

const PORT = '4329';
const BASE = process.env.BASE_PATH ?? '/portfoliov2/';

const LIMIT = 200 * 1024;
/** The moment the pages are rendered at (`-- --heure=aube`), and where (`-- --out=<dir>`, to compare before replacing). */
const arg = (name: string): string | undefined =>
  process.argv.find((value) => value.startsWith(`--${name}=`))?.split('=')[1];
const MOMENT = arg('heure') ?? 'crepuscule';
const OUT = resolve(arg('out') ?? join('public', SHARE_DIR.replace(/^\//, '')));
const locales = ['fr', 'en'] as const;
const slugs = readdirSync(resolve('src/content/projects')).filter((name) =>
  statSync(resolve('src/content/projects', name)).isDirectory(),
);

/** What a share image leaves out of the page, and the name it signs a case study with. */
const css = `
  [data-site-header], .menu-button, .cta, .case-header, .peeks, .case .lede, .case-content, .skip-link { display: none !important; }
  .share-signature {
    position: fixed; top: 40px; left: 64px; z-index: 100; margin: 0;
    font: 500 13px/1 'Libre Franklin', sans-serif; letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--accent, #7cc4d6);
  }
`;

const server = spawn('pnpm', ['exec', 'astro', 'preview', '--port', PORT, '--ignore-lock'], {
  stdio: 'ignore',
  env: process.env,
});
const origin = `http://localhost:${PORT}${BASE}`;
for (let tries = 0; ; tries++) {
  try {
    await fetch(origin);
    break;
  } catch (error) {
    if (tries > 60) throw error;
    await new Promise((done) => setTimeout(done, 500));
  }
}

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-proxy-server'],
});
try {
  const page = await browser.newPage({ viewport: SHARE_SIZE, deviceScaleFactor: 1 });
  const pages = locales.flatMap((locale) => [
    { locale, name: 'home', path: pathFor({ id: 'home' }, locale), signed: false },
    ...slugs.map((slug) => ({ locale, name: slug, path: pathFor({ id: 'project', slug }, locale), signed: true })),
  ]);
  for (const { locale, name, path, signed } of pages) {
    await page.goto(`${origin}${path.replace(/^\//, '')}?heure=${MOMENT}`);
    // The home waits for its arrival to end and its planet to turn into the live one; a case study, for its cover.
    await page.waitForFunction(() => !document.documentElement.hasAttribute('data-arrival'), null, {
      timeout: 30_000,
    });
    await page.addStyleTag({ content: css });
    if (signed) {
      await page.evaluate(() => {
        const signature = document.createElement('p');
        signature.className = 'share-signature';
        signature.textContent = 'Grégoire Tinnes';
        document.querySelector('.case-page')?.append(signature);
      });
    }
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(3000);
    const dir = join(OUT, locale);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${name}.jpg`);
    await sharp(await page.screenshot())
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(file);
    const size = statSync(file).size;
    console.log(`${locale}/${name}.jpg: ${String(Math.round(size / 1024))} kB`);
    if (size > LIMIT) throw new Error(`${file} is over ${String(LIMIT / 1024)} kB`);
  }
} finally {
  await browser.close();
  server.kill();
}

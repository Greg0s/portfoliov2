/**
 * Renders the office's fallback layers from the site's own modules (plan §2.5, step 7): for each moment and framing,
 * the town, the room, the desk and every town window lit, in WebP and in AVIF, with `placement.json`, where things land
 * in them; and once, the desk's contact shadows (`public/images/office/contact-shadows.png`), which the live office
 * loads rather than making them. The live office and its fallback come from the same `src/scene/office/`, so they cannot drift apart.
 *
 * Usage: `pnpm render-office-layers` (all), `-- --layers=city,room` (some layers), `-- --preview` (the three passes
 * together over a transparent sky, to compare with the mockup), `-- --out=<dir>` (somewhere else).
 * Playwright's Chromium is used; CHROMIUM_PATH points to another one.
 */
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { createServer } from 'vite';

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key = '', value = 'true'] = arg.replace(/^--/, '').split('=');
    return [key, value];
  }),
);
const OUT = resolve(args.out ?? 'public/images/office/layers');
const PREVIEW = args.preview === 'true';
const LAYERS = PREVIEW ? ['preview'] : (args.layers ?? 'contact,city,room,desk,windows').split(',');
const CONTACT_FILE = resolve('public/images/office/contact-shadows.png');
const MOMENTS = (args.moments ?? 'aube,crepuscule').split(',');
const FRAMINGS = (args.framings ?? 'desktop,mobile').split(',');
/** Pixel ratio of each framing's render, and the margin around the frame the head and the arrival move into. */
const SCALES: Record<string, number> = { desktop: 1.5, mobile: 2 };
const OVERSCAN = 0.04;

const server = await createServer({
  root: resolve('.'),
  logLevel: 'warn',
  server: { port: 8767, strictPort: true, host: '127.0.0.1' },
  optimizeDeps: { entries: ['scripts/office/render.html'] },
});
await server.listen();
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-proxy-server'],
});

mkdirSync(OUT, { recursive: true });
const placement: Record<string, unknown> = {};
try {
  if (LAYERS.includes('contact')) {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:8767/scripts/office/render.html?layer=contact');
    await page.waitForFunction(() => window.__done === true, null, { timeout: 600_000 });
    const result = await page.evaluate(() => ({ image: window.__image, error: window.__error }));
    await page.close();
    if (result.error || !result.image) throw new Error(`contact shadows: ${result.error ?? 'no image'}`);
    // Lossless: the live office lays it as it is.
    await sharp(Buffer.from(result.image.split(',')[1] ?? '', 'base64'))
      .png({ compressionLevel: 9 })
      .toFile(CONTACT_FILE);
    console.log(`${CONTACT_FILE}: ${String(Math.round(statSync(CONTACT_FILE).size / 1024))} kB`);
  }
  for (const moment of MOMENTS) {
    for (const framing of FRAMINGS) {
      for (const layer of LAYERS.filter((name) => name !== 'contact')) {
        const name = `${moment}-${framing}-${layer}`;
        const page = await browser.newPage();
        const logs: string[] = [];
        page.on('console', (message) => logs.push(message.text()));
        page.on('pageerror', (error) => logs.push(`page error: ${error.message}`));
        const scale = SCALES[framing] ?? 1;
        const query = new URLSearchParams({ moment, framing, layer, scale: String(scale), overscan: String(OVERSCAN) });
        const started = Date.now();
        await page.goto(`http://127.0.0.1:8767/scripts/office/render.html?${query.toString()}`);
        await page.waitForFunction(() => window.__done === true, null, { timeout: 600_000 });
        const result = await page.evaluate(() => ({
          image: window.__image,
          meta: window.__meta,
          error: window.__error,
        }));
        await page.close();
        if (result.error || !result.image) {
          console.error(name, result.error ?? 'no image', logs.join('\n'));
          process.exitCode = 1;
          continue;
        }
        const png = Buffer.from(result.image.split(',')[1] ?? '', 'base64');
        const file = join(OUT, `${name}.${PREVIEW ? 'png' : 'webp'}`);
        if (PREVIEW) writeFileSync(file, png);
        else {
          await sharp(png).webp({ quality: 86, alphaQuality: 90, effort: 6 }).toFile(file);
          // And in AVIF, for the browsers that show it (`src/lib/avif.ts`): at quality 60, as faithful to the render
          // as the WebP and about 40 % lighter.
          await sharp(png)
            .avif({ quality: 60, effort: 6 })
            .toFile(file.replace(/\.webp$/, '.avif'));
        }
        placement[`${moment}-${framing}`] ??= result.meta;
        const seconds = ((Date.now() - started) / 1000).toFixed(1);
        const kB = (path: string): string => String(Math.round(statSync(path).size / 1024));
        console.log(
          PREVIEW
            ? `${file}: ${kB(file)} kB, ${seconds} s`
            : `${file}: ${kB(file)} kB, AVIF ${kB(file.replace(/\.webp$/, '.avif'))} kB, ${seconds} s`,
        );
      }
    }
  }
  if (!PREVIEW) writeFileSync(join(OUT, 'placement.json'), `${JSON.stringify(placement, null, 2)}\n`);
} finally {
  await browser.close();
  await server.close();
}

/**
 * Renders the office's fallback layers from the site's own modules (plan §2.5, step 7): for each moment and framing,
 * the town, the room, the desk and every town window lit, in WebP and in AVIF, with `placement.json`, where things land
 * in them; and once, the desk's contact shadows (`public/images/office/contact-shadows.png`), which the live office
 * loads rather than making them. The live office and its fallback come from the same `src/scene/office/`, so they cannot drift apart.
 *
 * Usage: `pnpm render-office-layers` (all), `-- --layers=city,room` (some layers), `-- --preview` (the three passes
 * together over a transparent sky, to compare with the mockup), `-- --out=<dir>` (somewhere else),
 * `-- --layers=room-near45,room-near80,room-near105,room-depth,desk-depth,room-near45-depth,room-near80-depth,room-near105-depth` (for the office in
 * relief, `?bureau=relief`: the room seen from 45, 80 and 105 cm in front of the seat, the depth of the room and the desk, coarser and lossless, and `relief.json`).
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
/** The depth layers' pixel ratio: one vertex of the relief every 3 px of the frame on a computer, every 2 on a phone. */
const DEPTH_SCALES: Record<string, number> = { desktop: 1 / 3, mobile: 0.5 };
/** The near layers' margin and depth pixel ratio: wider, so that the camera backing from them still sees them whole. */
const NEAR_OVERSCAN = 0.3;
const NEAR_DEPTH_SCALES: Record<string, number> = { desktop: 0.75, mobile: 1 };

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
const relief: Record<string, unknown> = {};
let colour = false;
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
        const depth = layer.endsWith('-depth');
        const near = /-near\d/.test(layer);
        const scale = (depth ? (near ? NEAR_DEPTH_SCALES : DEPTH_SCALES) : SCALES)[framing] ?? 1;
        const overscan = near ? NEAR_OVERSCAN : OVERSCAN;
        const query = new URLSearchParams({ moment, framing, layer, scale: String(scale), overscan: String(overscan) });
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
        else if (depth) {
          // Lossless: each pixel's two bytes are one number.
          await sharp(png).webp({ lossless: true, effort: 6 }).toFile(file);
          const { anchors, w, h } = result.meta as { anchors: unknown; w: number; h: number };
          relief[`${moment}-${framing}`] = { w, h, overscan: OVERSCAN, nearOverscan: NEAR_OVERSCAN, anchors };
        } else {
          if (!near) colour = true;
          await sharp(png).webp({ quality: 86, alphaQuality: 90, effort: 6 }).toFile(file);
          // And in AVIF, for the browsers that show it (`src/lib/avif.ts`): at quality 60, as faithful to the render
          // as the WebP and about 40 % lighter.
          await sharp(png)
            .avif({ quality: 60, effort: 6 })
            .toFile(file.replace(/\.webp$/, '.avif'));
        }
        if (!depth && !near) {
          const meta = { ...(result.meta as Record<string, unknown>) };
          delete meta.anchors;
          placement[`${moment}-${framing}`] ??= meta;
        }
        const seconds = ((Date.now() - started) / 1000).toFixed(1);
        const kB = (path: string): string => String(Math.round(statSync(path).size / 1024));
        console.log(
          PREVIEW || depth
            ? `${file}: ${kB(file)} kB, ${seconds} s`
            : `${file}: ${kB(file)} kB, AVIF ${kB(file.replace(/\.webp$/, '.avif'))} kB, ${seconds} s`,
        );
      }
    }
  }
  if (!PREVIEW && colour) writeFileSync(join(OUT, 'placement.json'), `${JSON.stringify(placement, null, 2)}\n`);
  if (Object.keys(relief).length) writeFileSync(join(OUT, 'relief.json'), `${JSON.stringify(relief, null, 2)}\n`);
} finally {
  await browser.close();
  await server.close();
}

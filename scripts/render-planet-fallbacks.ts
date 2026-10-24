/**
 * Renders the planet's fallbacks (main spec §6, plan step 5): the image shown before the 3D planet is ready, without
 * WebGL or with "reduce motion". The planet prototype (docs/prototypes/petit-prince) renders it alone on a transparent
 * background for each moment; each render becomes a desktop and a mobile WebP of at most 50 kB. The decor around it
 * (`decor.webp`, white stars and glowing planets) is the mockup's, rendered by the same prototype.
 *
 * Usage: `cd docs/prototypes/petit-prince && npm install`, then `pnpm render-planet-fallbacks`.
 * Playwright's Chromium is used; CHROMIUM_PATH points to another one.
 */
import { execFile } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';

const PROTOTYPE = resolve('docs/prototypes/petit-prince');
const OUT = resolve('public/images/planet');
const PORT = 8765;
const LIMIT = 50 * 1024;
const moments = { aube: 'aube', crepuscule: 'crepuscule' } as const;
/** Width in pixels of the square around the planet: 600 CSS px at 1.5x on desktop, 360 CSS px at 2x on mobile. */
const sizes = { desktop: 900, mobile: 720 } as const;

if (!existsSync(join(PROTOTYPE, 'node_modules'))) {
  console.error('Run `npm install` in docs/prototypes/petit-prince first.');
  process.exit(1);
}

const types: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.glb': 'model/gltf-binary',
  '.wasm': 'application/wasm',
};
const server = createServer((request, response) => {
  const path = join(PROTOTYPE, decodeURIComponent(new URL(request.url ?? '/', 'http://x').pathname));
  if (!path.startsWith(PROTOTYPE) || !existsSync(path)) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' });
  createReadStream(path).pipe(response);
});
await new Promise<void>((done) => server.listen(PORT, done));

const renders = mkdtempSync(join(tmpdir(), 'planet-'));
try {
  const jobs = Object.entries(moments).map(([name, tod]) => `${name}:layer=planet&w=1200&h=1200&tod=${tod}`);
  // Asynchronous, so that this process keeps serving the prototype to the browser.
  await promisify(execFile)('node', ['shoot.cjs', renders, ...jobs], {
    cwd: PROTOTYPE,
    env: { ...process.env, BASE_URL: `http://127.0.0.1:${String(PORT)}/render.html` },
  });

  mkdirSync(OUT, { recursive: true });
  for (const moment of Object.keys(moments)) {
    // The whole square, as the opening places it: the planet sits at its centre.
    const square = await sharp(join(renders, `${moment}.png`)).toBuffer();
    for (const [framing, width] of Object.entries(sizes)) {
      let quality = 86;
      let output = await sharp(square).resize({ width }).webp({ quality, alphaQuality: 80, effort: 6 }).toBuffer();
      while (output.length > LIMIT && quality > 40) {
        quality -= 6;
        output = await sharp(square).resize({ width }).webp({ quality, alphaQuality: 80, effort: 6 }).toBuffer();
      }
      const file = join(OUT, `planet-${moment}-${framing}.webp`);
      await sharp(output).toFile(file);
      const { height } = await sharp(output).metadata();
      console.log(
        `${file}: ${String(width)} × ${String(height)} px, quality ${String(quality)}, ${String(Math.round(output.length / 1024))} kB`,
      );
    }
  }
} finally {
  rmSync(renders, { recursive: true, force: true });
  server.close();
}

/**
 * Renders the planet's loops (the performance analysis of 23 November 2026, behind `?planete=images`): the site's own
 * live planet, posed one part at a time on the wind's clock, at the size each framing shows it (1200 px for a
 * computer's 600 CSS px at 2x, 720 px for a phone's 360 at 2x). Only 8 % of the square ever moves: the scarf, the rose,
 * the fox's tail and its ears. Each part's loop (6, 6, 4.2 and 2.6 s at 30 frames a second) is cut to the rectangle its
 * motion reaches, with a margin of still pixels the player fades over, and encoded as a small AV1 video without chroma
 * subsampling (4:2:0 fringes the fox's orange): the colour, premultiplied by its alpha, on top, the alpha below in grey.
 * The planet at rest is a still image under them, in AVIF 4:4:4 too. All parts are posed in every frame, each at its own point of its
 * loop: their rectangles never overlap, so that each only holds its own part's motion.
 *
 * Writes `public/images/planet/loops/` (`<framing>-base.avif`, `<framing>-<part>.mp4`) and the player's manifest,
 * `src/scene/planet/loops.json`.
 * Usage: `pnpm render-planet-loops`. ffmpeg with libaom-av1 is needed; Playwright's Chromium draws (CHROMIUM_PATH
 * points to another one).
 */
import { spawn } from 'node:child_process';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { createServer } from 'vite';
import { LOOPS } from '../src/scene/planet/wind.ts';
import type { PartTimes } from '../src/scene/planet/planet.ts';

type Part = keyof PartTimes;
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const OUT = resolve('public/images/planet/loops');
const PORT = 8769;
const FPS = 30;
/** The parts, in the order the player loads them: the scarf first, which starts the wind (Grégoire, 24 November 2026). */
const PARTS: Part[] = ['scarf', 'ears', 'tail', 'rose'];
/** The square's size per framing, in px. */
const SIZES = { desktop: 1200, mobile: 720 } as const;
/** Still pixels kept around a part's motion, then the width the player fades the loop in over, at 1200 px. */
const MARGIN = 16;
const FEATHER = 8;
/** How many poses per loop tell where a part's motion reaches. */
const SAMPLES = 24;
/** The encoder's quality: lower is finer. */
const CRF = 26;

const frames = (part: Part): number => Math.round((LOOPS[part] / 1000) * FPS);
const even = (value: number, up: boolean): number => (up ? Math.ceil(value / 2) * 2 : Math.floor(value / 2) * 2);

/** The rectangle around a part's motion, with its margin, on even pixels, inside the square. */
function padded(rect: Rect, margin: number, size: number): Rect {
  const x = Math.max(0, even(rect.x - margin, false));
  const y = Math.max(0, even(rect.y - margin, false));
  const x1 = Math.min(size, even(rect.x + rect.w + margin, true));
  const y1 = Math.min(size, even(rect.y + rect.h + margin, true));
  return { x, y, w: x1 - x, h: y1 - y };
}

const overlap = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const server = await createServer({
  root: resolve('.'),
  logLevel: 'warn',
  server: { port: PORT, strictPort: true, host: '127.0.0.1' },
  optimizeDeps: { entries: ['scripts/planet/render.html'] },
});
await server.listen();
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-proxy-server'],
});
mkdirSync(OUT, { recursive: true });
const manifest: Record<string, unknown> = {};
try {
  for (const [framing, size] of Object.entries(SIZES)) {
    const scale = size / 1200;
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.goto(`http://127.0.0.1:${String(PORT)}/scripts/planet/render.html?size=${String(size)}`);
    await page.waitForFunction(() => window.__ready, null, { timeout: 600_000 });
    const error = await page.evaluate(() => window.__error);
    if (error) throw new Error(error);

    // Where each part's motion reaches, with its margin.
    const rects = new Map<Part, Rect>();
    for (const part of PARTS) {
      const bounds = await page.evaluate(([p, samples]) => window.__bounds?.(p, samples) ?? null, [
        part,
        SAMPLES,
      ] as const);
      if (!bounds) throw new Error(`The ${part} does not move.`);
      rects.set(part, padded(bounds, Math.round(MARGIN * scale), size));
    }
    const rectOf = (part: Part): Rect => {
      const rect = rects.get(part);
      if (!rect) throw new Error(`No rectangle for the ${part}.`);
      return rect;
    };
    for (const a of PARTS)
      for (const b of PARTS)
        if (a < b && overlap(rectOf(a), rectOf(b)))
          throw new Error(`The ${a}'s and the ${b}'s rectangles overlap at ${String(size)} px.`);

    // The planet at rest, under the loops.
    const still = await page.evaluate(() => window.__still?.() ?? '');
    // In AVIF without chroma subsampling, like the loops: where they play, it shows, and the fox's orange keeps its edge.
    const base = join(OUT, `${framing}-base.avif`);
    await sharp(Buffer.from(still.split(',')[1] ?? '', 'base64'))
      .avif({ quality: 80, chromaSubsampling: '4:4:4', effort: 6 })
      .toFile(base);

    // Every frame poses each part at its own point of its loop.
    const encoders = new Map(
      PARTS.map((part) => {
        const rect = rectOf(part);
        const file = join(OUT, `${framing}-${part}.mp4`);
        const ffmpeg = spawn(
          'ffmpeg',
          [
            ...['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24'],
            ...['-s', `${String(rect.w)}x${String(rect.h * 2)}`, '-r', String(FPS), '-i', '-'],
            ...['-vf', 'scale=out_color_matrix=bt709:out_range=tv', '-pix_fmt', 'yuv444p'],
            ...['-c:v', 'libaom-av1', '-crf', String(CRF), '-b:v', '0', '-cpu-used', '3', '-row-mt', '1'],
            // One key frame: a loop only ever goes back to its start.
            ...['-g', '9999', '-color_primaries', 'bt709', '-color_trc', 'iec61966-2-1', '-colorspace', 'bt709'],
            ...['-color_range', 'tv', '-movflags', '+faststart', '-an', file],
          ],
          { stdio: ['pipe', 'inherit', 'inherit'] },
        );
        const closed = new Promise<void>((resolveClosed, reject) => {
          ffmpeg.on('close', (code) => {
            if (code === 0) resolveClosed();
            else reject(new Error(`ffmpeg ended with ${String(code)} for ${file}`));
          });
        });
        return [part, { rect, file, ffmpeg, closed }] as const;
      }),
    );
    const longest = Math.max(...PARTS.map(frames));
    for (let k = 0; k < longest; k += 1) {
      const times = Object.fromEntries(
        PARTS.map((part) => [part, ((k % frames(part)) * LOOPS[part]) / frames(part)]),
      ) as unknown as PartTimes;
      const wanted = PARTS.filter((part) => k < frames(part));
      const crops = await page.evaluate(([t, r]) => window.__crops?.(t, r) ?? [], [times, wanted.map(rectOf)] as const);
      wanted.forEach((part, i) => {
        const { rect, ffmpeg } = encoders.get(part) as { rect: Rect; ffmpeg: ReturnType<typeof spawn> };
        ffmpeg.stdin?.write(stack(Buffer.from(crops[i] ?? '', 'base64'), rect.w * rect.h));
        if (k === frames(part) - 1) ffmpeg.stdin?.end();
      });
      if (k % 30 === 0) console.log(`${framing}: frame ${String(k + 1)} of ${String(longest)}`);
    }
    await Promise.all([...encoders.values()].map(({ closed }) => closed));
    await page.close();

    manifest[framing] = {
      size,
      base: `${framing}-base.avif`,
      feather: Math.max(2, Math.round(FEATHER * scale)),
      parts: PARTS.map((part) => ({
        name: part,
        src: `${framing}-${part}.mp4`,
        ...rectOf(part),
        period: LOOPS[part],
        frames: frames(part),
      })),
    };
    const weights = [base, ...PARTS.map((part) => join(OUT, `${framing}-${part}.mp4`))].map(
      (file) => `${file.split('/').pop() ?? file} ${String(Math.round(statSync(file).size / 1024))} kB`,
    );
    console.log(`${framing}: ${weights.join(', ')}`);
  }
  writeFileSync(resolve('src/scene/planet/loops.json'), `${JSON.stringify(manifest, null, 2)}\n`);
} finally {
  await browser.close();
  await server.close();
}

/** A frame for the encoder: the colour, premultiplied by its alpha, on top; the alpha below, in grey. */
function stack(rgba: Buffer, pixels: number): Buffer {
  const stacked = Buffer.alloc(pixels * 6);
  for (let i = 0; i < pixels; i += 1) {
    const a = rgba[i * 4 + 3] ?? 0;
    // Premultiplied: where the part is transparent, its colour is black, which costs nothing to encode.
    stacked[i * 3] = Math.round(((rgba[i * 4] ?? 0) * a) / 255);
    stacked[i * 3 + 1] = Math.round(((rgba[i * 4 + 1] ?? 0) * a) / 255);
    stacked[i * 3 + 2] = Math.round(((rgba[i * 4 + 2] ?? 0) * a) / 255);
    const below = (pixels + i) * 3;
    stacked[below] = a;
    stacked[below + 1] = a;
    stacked[below + 2] = a;
  }
  return stacked;
}

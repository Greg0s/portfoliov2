// Builds the measurement page into dist/: bundles the tests (minified, split by test, as the site would load them),
// copies the planet model and the office layers, makes the test videos, and writes the compressed size of each file
// to dist/sizes.json.
// The office layers come from ../bureau (`npm run layers` there first). The videos need ffmpeg.
import * as esbuild from 'esbuild';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const here = path.dirname(new URL(import.meta.url).pathname);
const dist = path.join(here, 'dist');
const layersSrc = path.join(here, '../bureau/renders/layers');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'app'), { recursive: true });

// scene.js lives in ../bureau, which has its own node_modules: resolve every `three` import from this package, so
// that the bundle holds one copy of Three.js.
const oneThree = {
  name: 'one-three',
  setup(build) {
    build.onResolve({ filter: /^three(\/.*)?$/ }, (args) => (args.resolveDir.startsWith(here) ? undefined : build.resolve(args.path, { kind: args.kind, resolveDir: here })));
  },
};

await esbuild.build({
  entryPoints: ['run', 'office-live', 'office-layers', 'journey'].map((f) => path.join(here, `src/${f}.js`)),
  outdir: path.join(dist, 'app'),
  bundle: true,
  splitting: true,
  format: 'esm',
  minify: true,
  target: 'es2022',
  chunkNames: 'chunk-[hash]',
  plugins: [oneThree],
  logLevel: 'warning',
});

fs.copyFileSync(path.join(here, 'src/run.html'), path.join(dist, 'run.html'));
// The launcher is published as the artifact's page, which gets its document skeleton at publish time; locally it
// gets one here.
const launcher = fs.readFileSync(path.join(here, 'launcher.html'), 'utf8');
fs.writeFileSync(path.join(dist, 'index.html'), `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>${launcher}</body></html>`);

fs.mkdirSync(path.join(dist, 'models'));
fs.copyFileSync(path.join(here, '../petit-prince/models/petit-prince.glb'), path.join(dist, 'models/petit-prince-glb.wasm'));

fs.mkdirSync(path.join(dist, 'layers'));
if (!fs.existsSync(layersSrc)) throw new Error('Office layers missing: run `npm run layers` in ../bureau first.');
for (const f of fs.readdirSync(layersSrc).filter((f) => /\.(webp|json)$/.test(f) && f !== 'placement.json')) {
  fs.copyFileSync(path.join(layersSrc, f), path.join(dist, 'layers', f));
}

// Three 6 s loops at 1280 × 720, 2.5 Mbit/s: stand-ins for the project videos (main spec §12: 4 MB at most per loop).
const media = path.join(here, 'renders/media');
fs.mkdirSync(media, { recursive: true });
const CLIPS = {
  a: ['-f', 'lavfi', '-i', 'gradients=s=1280x720:c0=0x1d2b64:c1=0xf8cdda:c2=0x6a3093:c3=0xff7a50:n=4:speed=0.03:d=6:r=30'],
  b: ['-f', 'lavfi', '-i', 'mandelbrot=s=1280x720:r=30,trim=duration=6'],
  c: ['-f', 'lavfi', '-i', 'life=s=320x180:mold=10:r=30:ratio=0.1:death_color=#1b1b3a:life_color=#ffd38c,scale=1280:720:flags=neighbor,trim=duration=6'],
};
for (const [k, input] of Object.entries(CLIPS)) {
  const mp4 = path.join(media, `clip-${k}.mp4`);
  const webp = path.join(media, `clip-${k}.webp`);
  if (!fs.existsSync(mp4)) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...input, '-c:v', 'libx264', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-b:v', '2500k', '-movflags', '+faststart', '-an', mp4]);
  if (!fs.existsSync(webp)) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '1', '-i', mp4, '-frames:v', '1', '-vf', 'scale=640:-1', '-c:v', 'libwebp', '-quality', '80', webp]);
}
fs.cpSync(media, path.join(dist, 'media'), { recursive: true });

// Compressed sizes (brotli, as GitHub Pages serves gzip at best: gzip given too).
const sizes = {};
const walk = (dir) => {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else {
      const buf = fs.readFileSync(p);
      const rel = path.relative(dist, p);
      const text = /\.(js|html|json)$/.test(f);
      sizes[rel] = { kB: Math.round(buf.length / 1024), gzipKB: text ? Math.round(zlib.gzipSync(buf, { level: 9 }).length / 1024) : null };
    }
  }
};
walk(dist);
fs.writeFileSync(path.join(dist, 'sizes.json'), JSON.stringify(sizes, null, 1));
for (const [f, s] of Object.entries(sizes)) if (f.startsWith('app/')) console.log(f, s.kB + ' kB', s.gzipKB + ' kB gz');

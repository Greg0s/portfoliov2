// Renders the final layers (both moments, both framings), converts them to WebP and gathers their placement data.
// Serve this folder first (`npm run serve`); CHROMIUM_PATH is passed on to shoot.cjs.
// Options: --city=proposal renders the proposed town (files suffixed with -proposal), --layers=city,windows renders only
// some layers.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import sharp from 'sharp';

const OUT = 'renders/layers';
const SCALES = { desktop: 1.5, mobile: 2 };
const OVERSCAN = 0.04;
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const CITY = args.city ?? 'current';
const LAYERS = (args.layers ?? 'city,room,desk,windows').split(',');
const suffix = CITY === 'current' ? '' : `-${CITY}`;

fs.mkdirSync(OUT, { recursive: true });
const jobs = [];
for (const moment of ['aube', 'crepuscule']) {
  for (const [framing, scale] of Object.entries(SCALES)) {
    for (const layer of LAYERS) {
      jobs.push(`${moment}-${framing}-${layer}${suffix}:moment=${moment}&framing=${framing}&layer=${layer}&scale=${scale}&overscan=${OVERSCAN}&city=${CITY}`);
    }
  }
}
execFileSync('node', ['shoot.cjs', OUT, ...jobs], { stdio: 'inherit' });

const placement = {};
for (const f of fs.readdirSync(OUT).filter((f) => f.endsWith('.png'))) {
  const name = f.replace('.png', '');
  await sharp(`${OUT}/${f}`).webp({ quality: 86, alphaQuality: 90, effort: 6 }).toFile(`${OUT}/${name}.webp`);
  const meta = JSON.parse(fs.readFileSync(`${OUT}/${name}.json`, 'utf8'));
  placement[meta.framing] ??= meta;
}
fs.writeFileSync(`${OUT}/placement.json`, JSON.stringify(placement, null, 2));
for (const f of fs.readdirSync(OUT).filter((f) => f.endsWith('.webp'))) console.log(f, Math.round(fs.statSync(`${OUT}/${f}`).size / 1024) + ' Ko');

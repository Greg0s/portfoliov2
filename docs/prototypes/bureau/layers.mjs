// Renders the final layers (both moments, both framings), converts them to WebP and gathers their placement data.
// Serve this folder first (`npm run serve`); CHROMIUM_PATH is passed on to shoot.cjs.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import sharp from 'sharp';

const OUT = 'renders/layers';
const SCALES = { desktop: 1.5, mobile: 2 };
const OVERSCAN = 0.04;

fs.mkdirSync(OUT, { recursive: true });
const jobs = [];
for (const moment of ['aube', 'crepuscule']) {
  for (const [framing, scale] of Object.entries(SCALES)) {
    for (const layer of ['city', 'room', 'desk', 'windows']) {
      jobs.push(`${moment}-${framing}-${layer}:moment=${moment}&framing=${framing}&layer=${layer}&scale=${scale}&overscan=${OVERSCAN}`);
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

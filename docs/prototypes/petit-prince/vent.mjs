// Renders the parts of the planet that the page animates, for the four times of day: the planet without the ribbon of
// the scarf and the rose, the ribbon in the wind (a loop of FRAMES phases) and the rose alone. Then crops them, packs the
// ribbon's frames into one strip, converts everything to WebP and writes where each part goes (pixels of the 1200 px
// render). Serve this folder first (`npm run serve`); CHROMIUM_PATH is passed on to shoot.cjs. Option: --pack only crops
// and packs the frames of a previous run.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import sharp from 'sharp';

const OUT = 'renders/vent';
const FRAMES = 96;
const TODS = { nuit: '', aube: '&tod=aube', jour: '&tod=jour', crepuscule: '&tod=crepuscule' };
const MARGIN = 4;

fs.mkdirSync(OUT, { recursive: true });
const jobs = Object.entries(TODS).flatMap(([tod, q]) => [
  `${tod}-planete:layer=planet${q}&hide=echarpe,rose`,
  `${tod}-echarpe:layer=planet${q}&only=echarpe&frames=${FRAMES}`,
  `${tod}-rose:layer=planet${q}&only=rose`,
]);
if (!process.argv.includes('--pack')) execFileSync('node', ['shoot.cjs', OUT, ...jobs], { stdio: 'inherit' });

// Box of the visible pixels, over all the given images.
async function box(files) {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -1, -1];
  for (const f of files) {
    const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        if (data[(y * info.width + x) * 4 + 3] === 0) continue;
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    }
  }
  // Even sizes, so that the page, at half the render's size, places every frame on whole pixels.
  const left = Math.max(0, x0 - MARGIN) & ~1;
  const top = Math.max(0, y0 - MARGIN) & ~1;
  const even = (n) => n + (n % 2);
  return { left, top, width: even(x1 + 1 + MARGIN - left), height: even(y1 + 1 + MARGIN - top) };
}

const frame = (tod, i) => `${OUT}/${tod}-echarpe-${String(i).padStart(3, '0')}.png`;
const tods = Object.keys(TODS);
const scarf = await box(tods.flatMap((tod) => Array.from({ length: FRAMES }, (_, i) => frame(tod, i))));
const rose = await box(tods.map((tod) => `${OUT}/${tod}-rose.png`));
const webp = { quality: 88, alphaQuality: 92, effort: 6 };
for (const tod of tods) {
  await sharp(`${OUT}/${tod}-planete.png`).webp(webp).toFile(`${OUT}/${tod}-planete.webp`);
  const tiles = await Promise.all(Array.from({ length: FRAMES }, (_, i) => sharp(frame(tod, i)).extract(scarf).png().toBuffer()));
  await sharp({ create: { width: scarf.width, height: scarf.height * FRAMES, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(tiles.map((input, i) => ({ input, left: 0, top: i * scarf.height })))
    .webp(webp)
    .toFile(`${OUT}/${tod}-echarpe.webp`);
  await sharp(`${OUT}/${tod}-rose.png`).extract(rose).webp(webp).toFile(`${OUT}/${tod}-rose.webp`);
}
const pivot = JSON.parse(fs.readFileSync(`${OUT}/nuit-rose.json`, 'utf8')).pivot.map((v) => Math.round(v * 10) / 10);
const placement = { size: 1200, scarf: { ...scarf, frames: FRAMES }, rose: { ...rose, pivot } };
fs.writeFileSync(`${OUT}/placement.json`, JSON.stringify(placement, null, 2));
console.log(JSON.stringify(placement));
for (const f of fs.readdirSync(OUT).filter((f) => f.endsWith('.webp'))) console.log(f, Math.round(fs.statSync(`${OUT}/${f}`).size / 1024) + ' Ko');

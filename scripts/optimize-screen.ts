/**
 * Makes the web versions of what the office's screen shows (office spec §6, main spec §9.4): the originals stay in
 * `.design-assets/screen/`, out of the repository, and the web versions go to `public/images/screen/` (the wallpaper and
 * the pages, loaded on the first hover of a link) and `public/images/taskbar/` (the icons).
 *
 * - `wallpaper.jpg`: Grégoire's photo, cropped to the 16:10 screen, 1280 × 800.
 * - `linkedin`, `github`, `instagram`: full-page captures, brought to the 1280 px Firefox shows them at; LinkedIn's long
 *   page is cut into slices no taller than 4096 px, which every GPU takes as one texture.
 * - `cv.png`: the CV's page (rendered from `public/cv/`'s PDF), brought to its 794 × 1123 px in Firefox.
 * - `logos.png`: one strip of 16 square icons (the taskbar's twelve apps, then the favicons of LinkedIn, GitHub, the
 *   PDF viewer and Instagram), brought to 52 px each: twice their 26 px on the screen.
 * - `recycle-bin.webp`: the Recycle Bin of Windows, 96 px (twice its 48 px).
 *
 * Usage: `pnpm optimize-screen [source]`
 */
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp, { type OutputInfo } from 'sharp';

const source = resolve(process.argv[2] ?? '.design-assets/screen');
const screen = resolve('public/images/screen');
const taskbar = resolve('public/images/taskbar');
const WIDTH = 1280;
const SLICE = 4096;

const find = (name: string): string => {
  const file = existsSync(source) ? readdirSync(source).find((entry) => entry.startsWith(`${name}.`)) : undefined;
  if (!file) {
    console.error(`No ${name}.* in ${source}.`);
    process.exit(1);
  }
  return join(source, file);
};

const report = (name: string, info: OutputInfo): void => {
  console.log(`${name}, ${String(info.width)} × ${String(info.height)} px, ${String(Math.round(info.size / 1024))} KB`);
};

mkdirSync(screen, { recursive: true });
mkdirSync(taskbar, { recursive: true });
for (const file of readdirSync(screen)) rmSync(join(screen, file));

report(
  'wallpaper.webp',
  await sharp(find('wallpaper'))
    .resize({ width: WIDTH, height: 800, fit: 'cover' })
    .webp({ quality: 80 })
    .toFile(join(screen, 'wallpaper.webp')),
);

for (const name of ['linkedin', 'github', 'instagram']) {
  const page = await sharp(find(name)).resize({ width: WIDTH }).toBuffer({ resolveWithObject: true });
  const { height } = page.info;
  const count = Math.ceil(height / SLICE);
  const step = Math.ceil(height / count);
  for (let k = 0; k < count; k += 1) {
    const top = k * step;
    const file = count > 1 ? `${name}-${String(k + 1)}.webp` : `${name}.webp`;
    const info = await sharp(page.data)
      .extract({ left: 0, top, width: WIDTH, height: Math.min(step, height - top) })
      .webp({ quality: 72 })
      .toFile(join(screen, file));
    report(file, info);
  }
}

report('cv.webp', await sharp(find('cv')).resize({ width: 794 }).webp({ quality: 80 }).toFile(join(screen, 'cv.webp')));

report(
  'logos.webp',
  await sharp(find('logos'))
    .resize({ width: 16 * 52, height: 52 })
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(join(taskbar, 'logos.webp')),
);
report(
  'recycle-bin.webp',
  await sharp(find('recycle-bin'))
    .resize({ width: 96 })
    .webp({ quality: 90 })
    .toFile(join(taskbar, 'recycle-bin.webp')),
);

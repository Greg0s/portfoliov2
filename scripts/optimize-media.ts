/**
 * Makes the web versions of the wall pictures (main spec §7.3): the originals stay in `.design-assets/wall/<frame>/`,
 * out of the repository; their display-size WebP versions go to `src/content/wall/<frame>/`, next to their `.yaml`,
 * which is copied too when it sits beside the original. The shorter side is brought down to 900 px (never below the
 * build check's 600 px, never enlarged).
 *
 * Usage: `pnpm optimize-media [source] [target]`
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, parse, resolve } from 'node:path';
import sharp from 'sharp';

const source = resolve(process.argv[2] ?? '.design-assets/wall');
const target = resolve(process.argv[3] ?? 'src/content/wall');
const SHORTER_SIDE = 900;
const IMAGE = /\.(?:avif|jpe?g|png|tiff?|webp)$/i;

if (!existsSync(source)) {
  console.error(`No originals in ${source}: put them in <frame>/ folders there.`);
  process.exit(1);
}

for (const frame of readdirSync(source, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
  const from = join(source, frame.name);
  const to = join(target, frame.name);
  mkdirSync(to, { recursive: true });
  for (const file of readdirSync(from).filter((name) => IMAGE.test(name))) {
    const { name } = parse(file);
    const image = sharp(join(from, file)).rotate();
    const { width, height } = await image.metadata();
    const portrait = height > width;
    const resized = portrait
      ? image.resize({ width: Math.min(width, SHORTER_SIDE) })
      : image.resize({ height: Math.min(height, SHORTER_SIDE) });
    const info = await resized.webp({ quality: 78 }).toFile(join(to, `${name}.webp`));
    const yaml = join(from, `${name}.yaml`);
    if (existsSync(yaml)) copyFileSync(yaml, join(to, `${name}.yaml`));
    console.log(
      `${frame.name}/${file} → ${name}.webp, ${String(info.width)} × ${String(info.height)} px, ${String(Math.round(info.size / 1024))} KB`,
    );
  }
}

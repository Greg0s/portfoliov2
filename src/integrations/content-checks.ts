/**
 * Runs the content checks of src/lib/content-checks.ts when the site builds, and fails the build with every problem
 * found. The collections' schemas check each file on its own; these checks look across files.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AstroIntegration } from 'astro';
import sharp from 'sharp';
import { parse } from 'yaml';
import {
  checkProjectCount,
  checkProjectFiles,
  checkProjectOrder,
  checkWallPictures,
  type WallPicture,
} from '../lib/content-checks';
import { frames } from '../lib/wall';
import { PROJECTS } from '../scene/journey/anchors';

const IMAGE = /\.(?:avif|jpe?g|png|webp)$/i;

function folders(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

export async function findContentErrors(root: string): Promise<string[]> {
  const projectsDir = join(root, 'src/content/projects');
  const projectFolders = folders(projectsDir).map((slug) => ({ slug, files: readdirSync(join(projectsDir, slug)) }));
  const orders = projectFolders
    .filter(({ files }) => files.includes('project.yaml'))
    .map(({ slug }) => {
      const data = parse(readFileSync(join(projectsDir, slug, 'project.yaml'), 'utf8')) as { order?: unknown };
      return { slug, order: typeof data.order === 'number' ? data.order : Number.NaN };
    });

  const wallDir = join(root, 'src/content/wall');
  const pictures: WallPicture[] = [];
  for (const frame of folders(wallDir)) {
    for (const file of readdirSync(join(wallDir, frame)).filter((name) => IMAGE.test(name))) {
      const { width, height } = await sharp(join(wallDir, frame, file)).metadata();
      pictures.push({ frame, file, width, height });
    }
  }

  return [
    ...checkProjectFiles(projectFolders),
    ...checkProjectOrder(orders),
    ...checkProjectCount(orders.length, PROJECTS),
    ...checkWallPictures(pictures, frames),
  ];
}

export default function contentChecks(): AstroIntegration {
  return {
    name: 'content-checks',
    hooks: {
      'astro:build:start': async ({ logger }) => {
        const errors = await findContentErrors(process.cwd());
        if (errors.length > 0) {
          throw new Error(`The content has ${String(errors.length)} problem(s):\n- ${errors.join('\n- ')}`);
        }
        logger.info('Content checks passed.');
      },
    },
  };
}

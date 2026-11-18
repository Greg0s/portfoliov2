/**
 * Gzips the planet's model next to it when the site builds (`models/petit-prince.glb.gz`). GitHub Pages compresses
 * text, never a `.glb`: the model came down at its full 550 KB, the largest download of the opening, which waits for
 * the live planet in the dark. Meshopt's output is made to be compressed again: gzipped, it weighs about 300 KB. The
 * page fetches the `.gz` and unpacks it with `DecompressionStream` (`src/scene/planet/prepare.ts`), the same bytes;
 * the `.glb` stays for browsers without it, the dev server and the office's render scripts.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, constants } from 'node:zlib';
import type { AstroIntegration } from 'astro';

export function gzipModels(dir: string): string[] {
  const models = join(dir, 'models');
  return readdirSync(models)
    .filter((name) => name.endsWith('.glb'))
    .map((name) => {
      const path = join(models, name);
      writeFileSync(`${path}.gz`, gzipSync(readFileSync(path), { level: constants.Z_BEST_COMPRESSION }));
      return `${path}.gz`;
    });
}

export default function compressedModel(): AstroIntegration {
  return {
    name: 'compressed-model',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const written = gzipModels(fileURLToPath(dir));
        logger.info(`${String(written.length)} model(s) gzipped.`);
      },
    },
  };
}

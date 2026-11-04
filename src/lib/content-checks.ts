/**
 * Build-time checks of the content (main spec §7.3), as pure functions over what the build found on disk. Each
 * returns its errors as explicit messages; the build fails if there is any (src/integrations/content-checks.ts).
 */
import { locales } from '../i18n/routes';

export interface ProjectFolder {
  slug: string;
  files: readonly string[];
}

/** Every project folder has its data and one text per language. */
export function checkProjectFiles(folders: readonly ProjectFolder[]): string[] {
  const required = ['project.yaml', ...locales.map((locale) => `${locale}.md`)];
  return folders.flatMap(({ slug, files }) =>
    required
      .filter((file) => !files.includes(file))
      .map((file) => `Project "${slug}" has no ${file} (src/content/projects/${slug}/${file}).`),
  );
}

/** No two projects share an `order`, and the orders run from 1 without a gap. */
export function checkProjectOrder(projects: readonly { slug: string; order: number }[]): string[] {
  const errors: string[] = [];
  const bySlot = new Map<number, string[]>();
  for (const { slug, order } of projects) bySlot.set(order, [...(bySlot.get(order) ?? []), slug]);
  for (const [order, slugs] of bySlot) {
    if (slugs.length > 1)
      errors.push(`Projects ${slugs.map((s) => `"${s}"`).join(' and ')} share order ${String(order)}.`);
  }
  const orders = [...bySlot.keys()].sort((a, b) => a - b);
  orders.forEach((order, index) => {
    if (order !== index + 1) errors.push(`Project orders must run from 1 without a gap: found ${orders.join(', ')}.`);
  });
  return [...new Set(errors)];
}

/** The journey has one anchor and one slot per project (src/scene/journey/anchors.ts): the counts must agree. */
export function checkProjectCount(count: number, expected: number): string[] {
  return count === expected
    ? []
    : [
        `Found ${String(count)} projects, but the journey is built for ${String(expected)}: set PROJECTS in src/scene/journey/anchors.ts.`,
      ];
}

export const MIN_WALL_SIDE = 600;

type Shape = 'portrait' | 'square' | 'landscape' | 'wide';

/** The family of an aspect ratio (width over height). */
export function shapeOf(aspect: number): Shape {
  if (aspect < 0.9) return 'portrait';
  if (aspect <= 1.1) return 'square';
  if (aspect < 1.6) return 'landscape';
  return 'wide';
}

/**
 * Whether a picture may be cropped into a frame: never from portrait to landscape or back, nor from 16:9 to square or
 * back (Grégoire's rule, office spec §3).
 */
export function fitsFrame(imageAspect: number, frameAspect: number): boolean {
  const image = shapeOf(imageAspect);
  const frame = shapeOf(frameAspect);
  const landscape = (shape: Shape): boolean => shape === 'landscape' || shape === 'wide';
  if (image === 'portrait' && landscape(frame)) return false;
  if (landscape(image) && frame === 'portrait') return false;
  if ((image === 'wide' && frame === 'square') || (image === 'square' && frame === 'wide')) return false;
  return true;
}

export interface WallPicture {
  frame: string;
  file: string;
  width: number;
  height: number;
}

/** Every wall picture belongs to a known frame, is at least 600 px on its shorter side and fits its frame's shape. */
export function checkWallPictures(
  pictures: readonly WallPicture[],
  frames: readonly { id: string; aspect: number }[],
): string[] {
  const errors: string[] = [];
  for (const { frame, file, width, height } of pictures) {
    const target = frames.find(({ id }) => id === frame);
    const where = `src/content/wall/${frame}/${file}`;
    if (!target) {
      errors.push(`${where}: no frame is called "${frame}" (frames: ${frames.map(({ id }) => id).join(', ')}).`);
      continue;
    }
    if (Math.min(width, height) < MIN_WALL_SIDE) {
      errors.push(
        `${where} is ${String(width)} × ${String(height)} px: wall pictures need at least ${String(MIN_WALL_SIDE)} px on their shorter side.`,
      );
    }
    if (!fitsFrame(width / height, target.aspect)) {
      errors.push(
        `${where} is ${shapeOf(width / height)} (${String(width)} × ${String(height)} px) but the "${frame}" frame is ${shapeOf(target.aspect)}: a picture never changes orientation.`,
      );
    }
  }
  return errors;
}

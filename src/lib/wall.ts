/**
 * The wall of the office (office spec §3): frames fixed in code, each with its type and aspect, and each drawing one
 * of its own pictures at random. A picture belongs to one frame only and is cropped to its aspect around its focus.
 */
import type { Locale } from '../i18n/routes';

export const frameTypes = ['poster', 'film', 'painting', 'photo', 'album'] as const;
export type FrameType = (typeof frameTypes)[number];

export interface Frame {
  id: string;
  type: FrameType;
  /** Width over height. */
  aspect: number;
  /** On the wall (desktop only) or on the desk (the only one seen on mobile). */
  place: 'wall' | 'desk';
  /** The landscape photo sits behind the contact text, which keeps the mouse: it never shows a label. */
  cartel: boolean;
}

export const frames = [
  { id: 'film', type: 'film', aspect: 16 / 9, place: 'wall', cartel: true },
  { id: 'painting', type: 'painting', aspect: 3 / 2, place: 'wall', cartel: true },
  { id: 'poster', type: 'poster', aspect: 2 / 3, place: 'wall', cartel: true },
  { id: 'photo-portrait', type: 'photo', aspect: 4 / 5, place: 'wall', cartel: true },
  { id: 'photo-landscape', type: 'photo', aspect: 4 / 3, place: 'wall', cartel: false },
  { id: 'album', type: 'album', aspect: 1, place: 'wall', cartel: true },
  { id: 'desk', type: 'photo', aspect: 4 / 5, place: 'desk', cartel: true },
] as const satisfies readonly Frame[];

export type FrameId = (typeof frames)[number]['id'];

/** What the site knows of a picture; everything is optional. */
export interface PictureInfo {
  /** A plain title, or a film's French and English titles. */
  title?: string | { fr: string; en: string } | undefined;
  /** A film's original title, its title on the English site. */
  originalTitle?: string | undefined;
  author?: string | undefined;
  /** Where a photo was taken, such as "Louvre, Paris". */
  place?: string | undefined;
  year?: number | string | undefined;
  /** A credit line the picture requires, such as "NASA, Apollo 8, Bill Anders". */
  credit?: string | undefined;
}

export interface CartelFields {
  /** The first line: the title, or else the author, or else the year. */
  main: string;
  /** Whether `main` is a title (set in the light italic of titles of works). */
  isTitle: boolean;
  /** Author, place and year under a title; what follows the first known of them when there is no title. */
  sub: string | undefined;
  credit: string | undefined;
}

function titleIn(info: PictureInfo, locale: Locale): string | undefined {
  if (typeof info.title === 'string') return info.title;
  if (info.title) return locale === 'fr' ? info.title.fr : (info.originalTitle ?? info.title.en);
  return info.originalTitle;
}

/**
 * What a picture's label says: only what is known, adapted to it (office spec §3). Without a title the author leads,
 * or else the place, or else the year; with nothing known there is no label (`undefined`). French films carry their
 * French title, English ones their original title.
 */
export function cartelFields(info: PictureInfo, locale: Locale): CartelFields | undefined {
  const title = titleIn(info, locale);
  const known = [info.author, info.place, info.year === undefined ? undefined : String(info.year)].filter(
    (part) => part !== undefined,
  );
  const main = title ?? known[0];
  if (main === undefined) return undefined;
  const sub = (title ? known : known.slice(1)).join(', ') || undefined;
  return { main, isTitle: title !== undefined, sub, credit: info.credit };
}

/**
 * Draws one picture per frame. A frame with several pictures never draws the one it showed last; a frame with none is
 * left out. `random` returns a number in [0, 1).
 */
export function draw<P>(
  pools: ReadonlyMap<string, readonly P[]>,
  previous: ReadonlyMap<string, P> = new Map(),
  random: () => number = Math.random,
): Map<string, P> {
  const result = new Map<string, P>();
  for (const [frame, pool] of pools) {
    const last = previous.get(frame);
    const candidates = pool.length > 1 ? pool.filter((picture) => picture !== last) : pool;
    const picture = candidates[Math.floor(random() * candidates.length)];
    if (picture !== undefined) result.set(frame, picture);
  }
  return result;
}

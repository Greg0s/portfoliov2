/**
 * The case studies side by side, in a ring (main spec §4, 2 November 2026): after the last one comes the first again.
 * Which way one lies from another, for the page to slide that way, and each one's neighbours.
 */

export type Side = 'next' | 'previous';

/** The neighbours of the `index`th item: the last one before the first, the first one after the last. */
export function neighbours<T>(ring: readonly T[], index: number): { previous: T; next: T } {
  const count = ring.length;
  const previous = ring[(index - 1 + count) % count];
  const next = ring[(index + 1) % count];
  if (previous === undefined || next === undefined) throw new RangeError(`No item ${String(index)} in the ring.`);
  return { previous, next };
}

/**
 * Which way `to` lies from `from`: the shorter way round the ring (forward on a tie), null when either is not in the
 * ring or both are the same.
 */
export function sideOf<T>(ring: readonly T[], from: T, to: T): Side | null {
  const start = ring.indexOf(from);
  const end = ring.indexOf(to);
  if (start < 0 || end < 0 || start === end) return null;
  const forward = (end - start + ring.length) % ring.length;
  return forward <= ring.length - forward ? 'next' : 'previous';
}

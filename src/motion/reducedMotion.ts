/**
 * "Reduce motion", detected automatically (journey spec §9): no camera move, no floating, no parallax. The opening
 * stays still, the projects are a list with their cartel always shown, the contact follows; cuts and title changes
 * become fades. `?still=1` freezes the time of the journey, for stable screenshots.
 */

const query = '(prefers-reduced-motion: reduce)';

export function prefersReducedMotion(): boolean {
  return window.matchMedia(query).matches;
}

/** Calls `listener` when the visitor turns "reduce motion" on or off; returns a function that stops listening. */
export function onReducedMotionChange(listener: (reduce: boolean) => void): () => void {
  const media = window.matchMedia(query);
  const change = (event: MediaQueryListEvent): void => {
    listener(event.matches);
  };
  media.addEventListener('change', change);
  return () => {
    media.removeEventListener('change', change);
  };
}

/** Whether the URL freezes the journey's time (`?still=1`). */
export function isStill(search = location.search): boolean {
  return new URLSearchParams(search).get('still') === '1';
}

/**
 * Whether the home plays the journey or shows the list (journey spec §9, main spec §5.6). The list is the version
 * without JavaScript, with "reduce motion", for the light version (`?lite=1`) and for a browser without 3D CSS.
 *
 * `applyJourneyMode` is self-contained: the home inlines its source before its content, so that the first paint is
 * already the journey's or the list's.
 */
export function applyJourneyMode(): void {
  const root = document.documentElement;
  const lite = new URLSearchParams(location.search).get('lite') === '1';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const has3d = typeof CSS !== 'undefined' && CSS.supports('transform-style', 'preserve-3d');
  if (!lite && !reduce && has3d) root.dataset.journey = 'on';
  else delete root.dataset.journey;
}

/** Whether the journey plays on this page. */
export function journeyOn(): boolean {
  return document.documentElement.dataset.journey === 'on';
}

/** Whether the URL turns WebGL off (`?gl=0`), to see the fallbacks. */
export function webglAllowed(search: string): boolean {
  return new URLSearchParams(search).get('gl') !== '0';
}

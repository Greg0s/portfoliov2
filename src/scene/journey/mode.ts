/**
 * Whether the home plays the journey or shows the list (journey spec §9, main spec §5.6). The list is the version
 * without JavaScript, with "reduce motion", for the light version (`?lite=1`, or once the device is found too slow
 * during the visit, see `quality.ts`) and for a browser without 3D CSS.
 *
 * `applyJourneyMode` is self-contained: the home inlines its source before its content, so that the first paint is
 * already the journey's or the list's.
 */
export function applyJourneyMode(): void {
  const root = document.documentElement;
  let slow = false;
  try {
    slow = (sessionStorage.getItem('portfolio:slow') ?? '').split(',').includes('lite');
  } catch {
    // Without storage, only the URL decides.
  }
  const lite = new URLSearchParams(location.search).get('lite') === '1' || slow;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const has3d = typeof CSS !== 'undefined' && CSS.supports('transform-style', 'preserve-3d');
  if (!lite && !reduce && has3d) root.dataset.journey = 'on';
  else delete root.dataset.journey;
  // Measurement switches, to weigh on a device what the CSS blurs (`?flou=0`) and blend modes (`?fusion=0`) cost.
  const params = new URLSearchParams(location.search);
  for (const name of ['flou', 'fusion']) {
    if (params.get(name) === '0') root.setAttribute(`data-${name}`, '0');
    else root.removeAttribute(`data-${name}`);
  }
}

/** Whether the journey plays on this page. */
export function journeyOn(): boolean {
  return document.documentElement.dataset.journey === 'on';
}

/** Whether the URL turns WebGL off (`?gl=0`), to see the fallbacks. */
export function webglAllowed(search: string): boolean {
  return new URLSearchParams(search).get('gl') !== '0';
}

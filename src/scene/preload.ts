/**
 * Asks the browser for the planet's fallback as soon as the page's head is read: the screen's width decides which
 * one, so the markup cannot name it. Inlined in the opening, before the first paint.
 */
export function preloadPlanet(dir: string): void {
  const framing = window.innerWidth < 768 ? 'mobile' : 'desktop';
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.fetchPriority = 'high';
  link.href = `${dir}planet-${framing}.webp`;
  document.head.append(link);
}

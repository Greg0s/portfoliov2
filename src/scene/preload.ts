/**
 * Asks the browser for the planet's fallback as soon as the page's head is read: the moment (src/scene/time.ts) and
 * the screen's width decide which one, so the markup cannot name it. Inlined in the opening, before the first paint.
 */
export function preloadPlanet(dir: string): void {
  const forced = new URLSearchParams(location.search).get('heure');
  const moment =
    forced === 'aube' || forced === 'crepuscule' ? forced : new Date().getHours() < 12 ? 'aube' : 'crepuscule';
  const framing = window.innerWidth < 768 ? 'mobile' : 'desktop';
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.fetchPriority = 'high';
  link.href = `${dir}planet-${moment}-${framing}.webp`;
  document.head.append(link);
}

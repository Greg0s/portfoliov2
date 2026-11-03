/**
 * The case studies' dots, on a touch screen (CaseStudy.astro): over a slide (slide.ts), the light leaves the dot of the
 * case study left like a drop of liquid. Its front edge springs toward the dot that comes in, a little past it and back,
 * stretching it thin; its back edge follows later, and the drop gathers into the new dot. Meanwhile the old dot narrows
 * and the new one widens, so that the row ends as the page drew it.
 */

/** The front edge's ease: quick, past the dot and back. */
const springOut = (t: number): number => {
  const c = 1.9;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
};
const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Moves the light from the dot at `from` to the current one, over `duration` ms. */
export function moveDots(from: number, duration: number): void {
  const row = document.querySelector<HTMLElement>('.dots');
  if (!row || getComputedStyle(row).display === 'none') return;
  const dots = Array.from(row.querySelectorAll<HTMLElement>(':scope > span:not(.drop)'));
  const to = dots.findIndex((dot) => dot.classList.contains('current'));
  const left = dots[from];
  const current = dots[to];
  if (!left || !current || from === to) return;

  const wide = current.offsetWidth;
  const narrow = left.offsetWidth;
  const dim = getComputedStyle(left).backgroundColor;
  const light = getComputedStyle(current).backgroundColor;
  const height = current.offsetHeight;
  // The drop carries the light; both dots stay dim under it until it lands.
  const drop = document.createElement('span');
  drop.className = 'drop';
  Object.assign(drop.style, {
    position: 'absolute',
    top: '50%',
    left: '0',
    height: `${String(height)}px`,
    borderRadius: `${String(height / 2)}px`,
    background: light,
    pointerEvents: 'none',
    willChange: 'transform, width',
  });
  row.style.position = 'relative';
  row.append(drop);
  for (const dot of [left, current]) dot.style.backgroundColor = dim;

  const forward = to > from;
  const start = performance.now();
  const frame = (now: number): void => {
    const t = clamp01((now - start) / duration);
    // The dots change width over the whole slide, the row shifting smoothly.
    const grow = easeInOut(t);
    left.style.width = `${String(lerp(wide, narrow, grow))}px`;
    current.style.width = `${String(lerp(narrow, wide, grow))}px`;
    const a = { start: left.offsetLeft, end: left.offsetLeft + left.offsetWidth };
    const b = { start: current.offsetLeft, end: current.offsetLeft + current.offsetWidth };
    // Front edge first, springing; back edge later, gathering.
    const front = springOut(clamp01(t / 0.62));
    const back = easeInOut(clamp01((t - 0.18) / 0.82));
    const edges = forward
      ? { start: lerp(a.start, b.start, back), end: lerp(a.end, b.end, front) }
      : { start: lerp(a.start, b.start, front), end: lerp(a.end, b.end, back) };
    const length = Math.max(height, edges.end - edges.start);
    // Stretched, it thins, as a drop does.
    const thin = 1 - 0.3 * clamp01((length - wide) / (Math.abs(b.start - a.start) + 1));
    drop.style.width = `${String(length)}px`;
    drop.style.transform = `translate(${String(edges.start)}px, -50%) scaleY(${String(thin)})`;
    if (t < 1) {
      requestAnimationFrame(frame);
      return;
    }
    drop.remove();
    for (const dot of [left, current]) dot.style.removeProperty('width');
    for (const dot of [left, current]) dot.style.removeProperty('background-color');
  };
  requestAnimationFrame(frame);
}

/**
 * The case studies' dots, on a touch screen (CaseStudy.astro): going from one case study to another, the light leaves
 * the dot of the case study left like a drop of liquid, gliding in one smooth move to the dot that comes in. Both its
 * edges travel together, the back one only a breath behind, so that it lengthens a little as it goes and rounds up
 * again as it settles. Meanwhile the old dot narrows and the new one widens, so that the row ends as the page drew it.
 *
 * A swipe (swipe.ts) carries the drop with the finger: it goes as far toward the neighbour's dot as the page went toward
 * the neighbour, comes back if the page springs back, and once the finger lets go, the new page's drop goes on from
 * there with its slide (slide.ts). A slide started by a link plays the whole move on its own.
 */

const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
/** Close to the slide's ease once a finger let go (slide.ts, `FROM_SWIPE`). */
const easeOut = (t: number): number => 1 - (1 - t) ** 3;
const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** A drop on its way from one dot to another. */
interface Drop {
  element: HTMLElement;
  left: HTMLElement;
  current: HTMLElement;
  from: number;
  to: number;
  wide: number;
  narrow: number;
  height: number;
  progress: number;
}

function row(): { row: HTMLElement; dots: HTMLElement[] } | null {
  const element = document.querySelector<HTMLElement>('.dots');
  if (!element || getComputedStyle(element).display === 'none') return null;
  return { row: element, dots: Array.from(element.querySelectorAll<HTMLElement>(':scope > span:not(.drop)')) };
}

/** Lays a drop on the dot at `from`, ready to go to the one at `to`; `current` is the dot the page draws wide. */
function lay(from: number, to: number): Drop | null {
  const found = row();
  if (!found || from === to) return null;
  const { dots } = found;
  const left = dots[from];
  const current = dots[to];
  const wide = dots.find((dot) => dot.classList.contains('current'));
  const narrowDot = dots.find((dot) => !dot.classList.contains('current'));
  if (!left || !current || !wide || !narrowDot) return null;
  const dim = getComputedStyle(narrowDot).backgroundColor;
  const light = getComputedStyle(wide).backgroundColor;
  const height = wide.offsetHeight;
  // The drop carries the light; both dots stay dim under it until it lands.
  const element = document.createElement('span');
  element.className = 'drop';
  Object.assign(element.style, {
    position: 'absolute',
    top: '50%',
    left: '0',
    height: `${String(height)}px`,
    borderRadius: `${String(height / 2)}px`,
    background: light,
    pointerEvents: 'none',
    willChange: 'transform, width',
  });
  found.row.style.position = 'relative';
  found.row.append(element);
  for (const dot of [left, current]) dot.style.backgroundColor = dim;
  return {
    element,
    left,
    current,
    from,
    to,
    wide: wide.offsetWidth,
    narrow: narrowDot.offsetWidth,
    height,
    progress: 0,
  };
}

/** Draws the drop `progress` of the way, from 0 (on the dot left) to 1 (on the dot that comes in). */
function draw(drop: Drop, progress: number): void {
  const { left, current, wide, narrow, height } = drop;
  drop.progress = progress;
  // The dots change width along the way, the row shifting smoothly.
  left.style.width = `${String(lerp(wide, narrow, progress))}px`;
  current.style.width = `${String(lerp(narrow, wide, progress))}px`;
  const a = { start: left.offsetLeft, end: left.offsetLeft + left.offsetWidth };
  const b = { start: current.offsetLeft, end: current.offsetLeft + current.offsetWidth };
  // The front edge a breath ahead, the back one a breath behind.
  const front = clamp01(progress / 0.9);
  const back = clamp01((progress - 0.1) / 0.9);
  const edges =
    drop.to > drop.from
      ? { start: lerp(a.start, b.start, back), end: lerp(a.end, b.end, front) }
      : { start: lerp(a.start, b.start, front), end: lerp(a.end, b.end, back) };
  const length = Math.max(height, edges.end - edges.start);
  drop.element.style.width = `${String(length)}px`;
  drop.element.style.transform = `translate(${String(edges.start)}px, -50%)`;
}

function lift(drop: Drop): void {
  drop.element.remove();
  for (const dot of [drop.left, drop.current]) {
    dot.style.removeProperty('width');
    dot.style.removeProperty('background-color');
  }
}

/** Plays the drop from `start` to `end` over `duration` ms, then calls `done`. */
function play(drop: Drop, start: number, end: number, duration: number, ease: (t: number) => number, done: () => void) {
  const began = performance.now();
  const frame = (now: number): void => {
    if (!drop.element.isConnected) return;
    const t = clamp01((now - began) / duration);
    draw(drop, lerp(start, end, ease(t)));
    if (t < 1) requestAnimationFrame(frame);
    else done();
  };
  requestAnimationFrame(frame);
}

/**
 * On the page that comes in, moves the light from the dot at `from` to the current one, over `duration` ms; from
 * `start` of the way when a finger already carried it there.
 */
export function moveDots(from: number, duration: number, start = 0): void {
  const dots = row()?.dots ?? [];
  const drop = lay(
    from,
    dots.findIndex((dot) => dot.classList.contains('current')),
  );
  if (!drop) return;
  draw(drop, start);
  play(drop, start, 1, duration, start === 0 ? easeInOut : easeOut, () => {
    lift(drop);
  });
}

/** The drop a finger carries, on the page it is leaving. */
let held: Drop | null = null;

/** Carries the drop `progress` of the way toward the next dot (`step` 1) or the previous one (`step` -1), round the ring. */
export function dragDots(step: 1 | -1, progress: number): void {
  const dots = row()?.dots ?? [];
  const from = dots.findIndex((dot) => dot.classList.contains('current'));
  if (from < 0) return;
  const to = (from + step + dots.length) % dots.length;
  if (held?.to !== to || !held.element.isConnected) {
    if (held) lift(held);
    held = lay(from, to);
  }
  if (held) draw(held, clamp01(progress));
}

/** How far the finger carried the drop, for the page that comes in; 0 without one. */
export function draggedDots(): number {
  return held?.element.isConnected ? held.progress : 0;
}

/** Brings the drop back to its dot, as the page springs back, over `duration` ms. */
export function settleDots(duration: number): void {
  const drop = held;
  held = null;
  if (!drop) return;
  if (!drop.element.isConnected || drop.progress === 0) {
    lift(drop);
    return;
  }
  play(drop, drop.progress, 0, duration, easeOut, () => {
    lift(drop);
  });
}

/** Forgets the drop of the page left. */
export function dropDots(): void {
  held = null;
}

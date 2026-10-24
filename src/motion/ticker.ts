/**
 * The site's only animation loop (implementation plan §2.2): one `requestAnimationFrame` that runs every subscriber
 * with the time and the time since the last frame, so that the camera, the CSS and the WebGL render move together.
 * It stops while the tab is hidden and when nobody listens.
 */

export type Tick = (time: number, delta: number) => void;

const subscribers = new Set<Tick>();
/** Run before the others: what scrolls the page, so that no style written earlier in the frame forces a layout. */
const firsts = new Set<Tick>();
let frame = 0;
let last = 0;

function loop(now: number): void {
  // A long pause (a hidden tab, a stalled frame) does not make anything jump.
  const delta = last ? Math.min(64, now - last) : 16.7;
  last = now;
  for (const tick of [...firsts, ...subscribers]) tick(now, delta);
  frame = firsts.size + subscribers.size > 0 && !document.hidden ? requestAnimationFrame(loop) : 0;
}

function start(): void {
  if (frame || document.hidden || firsts.size + subscribers.size === 0) return;
  last = 0;
  frame = requestAnimationFrame(loop);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(frame);
    frame = 0;
  } else {
    start();
  }
});

/**
 * Runs `tick` at every frame until the returned function is called. With `first`, it runs before every other tick
 * of the frame: for what scrolls the page, which needs a clean layout.
 */
export function onTick(tick: Tick, { first = false } = {}): () => void {
  const set = first ? firsts : subscribers;
  set.add(tick);
  start();
  return () => {
    set.delete(tick);
    if (firsts.size + subscribers.size === 0) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  };
}

/**
 * The site's only animation loop (implementation plan §2.2): one `requestAnimationFrame` that runs every subscriber
 * with the time and the time since the last frame, so that the camera, the CSS and the WebGL render move together.
 * It stops while the tab is hidden and when nobody listens.
 */

export type Tick = (time: number, delta: number) => void;

const subscribers = new Set<Tick>();
let frame = 0;
let last = 0;

function loop(now: number): void {
  // A long pause (a hidden tab, a stalled frame) does not make anything jump.
  const delta = last ? Math.min(64, now - last) : 16.7;
  last = now;
  for (const tick of [...subscribers]) tick(now, delta);
  frame = subscribers.size > 0 && !document.hidden ? requestAnimationFrame(loop) : 0;
}

function start(): void {
  if (frame || document.hidden || subscribers.size === 0) return;
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

/** Runs `tick` at every frame until the returned function is called. */
export function onTick(tick: Tick): () => void {
  subscribers.add(tick);
  start();
  return () => {
    subscribers.delete(tick);
    if (subscribers.size === 0) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  };
}

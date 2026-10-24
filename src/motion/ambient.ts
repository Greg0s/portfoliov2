/**
 * The ambient clock (decided with Grégoire on 24 October 2026): the weightless motions of the home (the camera's
 * drift, the floats, the stars' twinkle, the wind on the planet) wait until the visitor's first gesture, or a few
 * seconds after the page has loaded. Until then their time stays at 0 and the scene does not redraw at rest, so the
 * page loads on a quiet main thread. The clock then runs from 0, so that nothing jumps when it starts.
 */

/** How long after the page's `load` the ambient motions start on their own, in ms. */
export const AMBIENT_DELAY = 4000;

/** The gestures that start the ambient motions at once (a scroll alone does not: the page scrolls itself). */
const gestures = ['pointermove', 'pointerdown', 'wheel', 'touchstart', 'keydown'] as const;

export interface AmbientClock {
  /** The ambient time at `now`, in ms: 0 until the clock starts. */
  time(now: number): number;
  started(): boolean;
  stop(): void;
}

export function ambientClock(delay = AMBIENT_DELAY): AmbientClock {
  let startedAt = -1;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const start = (): void => {
    if (startedAt >= 0) return;
    startedAt = performance.now();
    unlisten();
  };
  const onLoad = (): void => {
    timer = setTimeout(start, delay);
  };
  function unlisten(): void {
    clearTimeout(timer);
    window.removeEventListener('load', onLoad);
    gestures.forEach((name) => {
      window.removeEventListener(name, start, true);
    });
  }

  gestures.forEach((name) => {
    window.addEventListener(name, start, { capture: true, passive: true });
  });
  if (document.readyState === 'complete') onLoad();
  else window.addEventListener('load', onLoad);

  return {
    time: (now) => (startedAt >= 0 ? Math.max(0, now - startedAt) : 0),
    started: () => startedAt >= 0,
    stop: unlisten,
  };
}

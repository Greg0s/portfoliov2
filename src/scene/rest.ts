/**
 * The page at rest: long work in the scenes (a shader linked, a scene put together) waits for a moment when nothing
 * moves, so that it never holds a frame of a gesture.
 */

/**
 * When the page was last moved (scrolling, wheel, touch or key), kept from `watchMoves()` until the returned stop is
 * called: a page already quiet lets the next step through at once.
 */
export function watchMoves(): { quietFor(): number; stop(): void } {
  let last = -Infinity;
  const moved = (): void => {
    last = performance.now();
  };
  const events = ['scroll', 'wheel', 'touchmove', 'keydown'] as const;
  events.forEach((name) => {
    window.addEventListener(name, moved, { capture: true, passive: true });
  });
  return {
    quietFor: () => performance.now() - last,
    stop: () => {
      events.forEach((name) => {
        window.removeEventListener(name, moved, { capture: true });
      });
    },
  };
}

/** How many animations hold the page busy (`holdStill()`), whatever the patience left. */
let holds = 0;

/**
 * Holds the long work back while an animation that no gesture drives plays (the dive into a case study and back):
 * a step of it would stop the animation for a frame or more. Returns the release.
 */
export function holdStill(): () => void {
  holds += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds -= 1;
  };
}

/**
 * Resolves once the page has been quiet for a quarter of a second, or `patience` ms gone by (none left: at once);
 * never while an animation holds the page.
 */
export function atRest(moves: ReturnType<typeof watchMoves>, patience: number): Promise<void> {
  const start = performance.now();
  return new Promise<void>((resolve) => {
    const check = (): void => {
      if (holds === 0 && (moves.quietFor() >= 250 || performance.now() - start >= patience)) resolve();
      else setTimeout(check, 50);
    };
    check();
  });
}

/** Resolves, in a task of its own, once no animation holds the page (at once if none does). */
export function whenFree(): Promise<void> {
  return new Promise<void>((resolve) => {
    const check = (): void => {
      if (holds === 0) resolve();
      else setTimeout(check, 50);
    };
    check();
  });
}

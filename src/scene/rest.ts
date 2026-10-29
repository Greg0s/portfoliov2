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

/** Resolves once the page has been quiet for a quarter of a second, or `patience` ms gone by. */
export function atRest(moves: ReturnType<typeof watchMoves>, patience: number): Promise<void> {
  const start = performance.now();
  return new Promise<void>((resolve) => {
    const check = (): void => {
      if (moves.quietFor() >= 250 || performance.now() - start >= patience) resolve();
      else setTimeout(check, 50);
    };
    check();
  });
}

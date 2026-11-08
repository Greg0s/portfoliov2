/**
 * The home's scripts: the journey when it plays (see `mode.ts`; the arrival on its opening plays from the page
 * itself, see `src/motion/arrival.ts`). They start on each visit of the home, stop when the client router leaves it,
 * and restart when "reduce motion" changes.
 */
import { applyJourneyMode, journeyOn, webglAllowed } from './mode';
import { isStill, onReducedMotionChange } from '../../motion/reducedMotion';

let stops: ((keep?: boolean) => void)[] = [];
/** Counts the starts, so that a journey still loading when the home stops never starts. */
let generation = 0;

/** Stops the home's scripts; `keep` keeps the journey's scenes for the next visit of the home (a page is left). */
function stop(keep = false): void {
  generation += 1;
  stops.forEach((fn) => {
    fn(keep);
  });
  stops = [];
}

function start(root: HTMLElement): void {
  applyJourneyMode();
  const still = isStill(location.search);
  if (!journeyOn()) {
    // The list, without the journey: the scenes kept from a former visit of the home are let go.
    void import('../keep').then(({ dropKept }) => {
      dropKept();
    });
    return;
  }
  // The journey's code loads with the page, but only runs here.
  const started = generation;
  void import('./journey').then(({ startJourney }) => {
    if (started !== generation || !root.isConnected) return;
    stops.push(
      startJourney(root, {
        still,
        webgl: webglAllowed(location.search),
        onLite: (fragment) => {
          // After this frame: the journey stops, and the page starts again as the list, on the project shown.
          requestAnimationFrame(() => {
            if (started !== generation) return;
            stop();
            start(root);
            if (fragment) document.getElementById(fragment)?.scrollIntoView({ block: 'center', behavior: 'instant' });
          });
        },
      }),
    );
    // The measurement runs, on a real device (`?mesure=1`, `?mesure=rapide`, `?mesure=visite`): loaded only when asked
    // for. The full visit outlives the home: it goes through the case studies and back.
    const mesure = new URLSearchParams(location.search).get('mesure') ?? '';
    if (mesure === 'visite') {
      void import('./visit').then(({ startVisit }) => {
        startVisit();
      });
      return;
    }
    if (!['1', 'rapide'].includes(mesure)) return;
    void import('./measure').then(({ startMeasure }) => {
      if (started === generation && root.isConnected) stops.push(startMeasure(root));
    });
  });
}

export function initHome(): void {
  const root = document.querySelector<HTMLElement>('[data-journey-root]');
  if (!root) return;
  start(root);
  const stopWatching = onReducedMotionChange(() => {
    stop();
    start(root);
  });
  const leave = (): void => {
    stopWatching();
    stop(true);
    document.removeEventListener('astro:before-swap', leave);
  };
  document.addEventListener('astro:before-swap', leave);
}

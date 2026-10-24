/**
 * The home's scripts: the weightless job title, always, and the journey when it plays (see `mode.ts`). They start
 * on each visit of the home, stop when the client router leaves it, and restart when "reduce motion" changes.
 */
import { applyJourneyMode, journeyOn, webglAllowed } from './mode';
import { startJobTitle } from '../../motion/jobTitle';
import { isStill, onReducedMotionChange, prefersReducedMotion } from '../../motion/reducedMotion';

let stops: (() => void)[] = [];
/** Counts the starts, so that a journey still loading when the home stops never starts. */
let generation = 0;

function stop(): void {
  generation += 1;
  stops.forEach((fn) => {
    fn();
  });
  stops = [];
}

function start(root: HTMLElement): void {
  applyJourneyMode();
  const still = isStill(location.search);
  const job = root.querySelector<HTMLElement>('[data-jobs]');
  const words = job?.dataset.jobs?.split('|') ?? [];
  if (job && !still) {
    stops.push(
      startJobTitle(job, words, {
        reduce: prefersReducedMotion(),
        paused: () => document.documentElement.dataset.introFaded === 'true',
      }),
    );
  }
  if (!journeyOn()) return;
  // The journey's code loads with the page, but only runs here.
  const started = generation;
  void import('./journey').then(({ startJourney }) => {
    if (started !== generation || !root.isConnected) return;
    stops.push(startJourney(root, { still, webgl: webglAllowed(location.search) }));
    // The measurement run, on a real device (`?mesure=1`): loaded only when asked for.
    if (new URLSearchParams(location.search).get('mesure') !== '1') return;
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
    stop();
    document.removeEventListener('astro:before-swap', leave);
  };
  document.addEventListener('astro:before-swap', leave);
}

/**
 * The office's step helpers and pure maths, without three.js (`common.ts` passes them on): the layers' preparation,
 * which a phone uses alone, needs nothing else from the live scene.
 */
import { whenFree } from '../rest';

/** When the step under way began: the end of the last pause. */
let stepStart = -1;

/** Starts a step outside a pause: work resumed by a promise, which the next `endStep` or pause names. */
export function startStep(): void {
  stepStart = performance.now();
}

/**
 * Ends the step under way, named `step`: its time on the main thread is kept as a performance measure
 * (`office:<step>`), which the measurement run (`?mesure=1`) reports.
 */
export function endStep(step: string): void {
  if (stepStart >= 0) performance.measure(`office:${step}`, { start: stepStart, end: performance.now() });
  stepStart = -1;
}

/**
 * Waits for the next frame to be drawn, then for a task of its own: long work cut into such steps never holds a frame.
 * An animation holding the page (`holdStill()`, the dive) plays out first. `step` names the work done since the last
 * pause.
 */
export const breathe = (step?: string): Promise<void> => {
  if (step) endStep(step);
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        void whenFree().then(() => {
          stepStart = performance.now();
          resolve();
        });
      });
    });
  });
};

/** No pause: building at once, where nothing else is drawn (the layers' render). */
export const noPause = (): Promise<void> => Promise.resolve();

/** Lets frames through between the parts of a long build; `step` names the part just done. */
export type Pause = (step?: string) => Promise<void>;

/** The prototype's seeded random numbers (mulberry32). */
export function rng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

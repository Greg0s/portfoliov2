/**
 * The steps of the journey (journey spec §4): on each project's stretch, the camera's position follows
 * `f(s) = s + k · sin(2πs) / 2π`, with `s` the progress through the stretch (0 to 1) and `k = 0.75`. The camera slows
 * to 25 % of its mean speed in the middle of the stretch, where the card is sharp, and speeds up to 175 % between two
 * projects, without a jolt.
 */

export const STEP_K = 0.75;

/** The camera's position through a project's stretch, for a progress `s` through it (both from 0 to 1). */
export function step(s: number, k = STEP_K): number {
  return s + (k * Math.sin(2 * Math.PI * s)) / (2 * Math.PI);
}

/** The camera's speed through the stretch, relative to its mean speed: `f'(s) = 1 + k · cos(2πs)`. */
export function stepSpeed(s: number, k = STEP_K): number {
  return 1 + k * Math.cos(2 * Math.PI * s);
}

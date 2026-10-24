/**
 * The journey's anchors and the camera's depth along it (journey spec §4). The journey is 12.5 screens of scroll: the
 * opening and the fading of its text (1 screen), 1.25 screens per project, 1.5 screens for the end. The scroll always
 * stops on an anchor: the opening, each of the 8 projects (its card sharp), the contact.
 */
import { step } from './steps';

/** Screens of scroll, from the opening to the contact. */
export const SCREENS = 12.5;
export const PROJECTS = 8;

const OPENING = 1;
const PER_PROJECT = 1.25;

/** Progress (0 to 1) where the projects' stretch starts and ends, and where the end starts. */
export const PROJECTS_START = OPENING / SCREENS;
export const END_START = (OPENING + PER_PROJECT * PROJECTS) / SCREENS;

/** Progress of each anchor: the opening, the 8 projects in the middle of their stretch, the contact. */
export const anchors: readonly number[] = [
  0,
  ...Array.from({ length: PROJECTS }, (_, i) => (OPENING + PER_PROJECT * i + PER_PROJECT / 2) / SCREENS),
  1,
];

/** The anchor of the project at `index` (0 to 7). */
export function projectAnchor(index: number): number {
  return anchors[index + 1] ?? 0;
}

/** The progress of the last project's anchor, where the end starts its own clock. */
export const LAST_PROJECT = projectAnchor(PROJECTS - 1);

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * The camera's distance from the planet, in perspective units, for a scroll progress `u` (0 to 1). The opening eases
 * from 0 to 1; each project's stretch adds 1 through the steps, its card sharp at depth `1.5 + i`; the end goes from
 * 9 to 29, slowing down onto the contact.
 */
export function cameraDepth(u: number): number {
  const p = Math.max(0, Math.min(1, u));
  if (p < PROJECTS_START) {
    const t = p / PROJECTS_START;
    return 1.6 * t * t - 0.6 * t * t * t;
  }
  if (p < END_START) {
    const x = (p - PROJECTS_START) / ((END_START - PROJECTS_START) / PROJECTS);
    const i = Math.min(PROJECTS - 1, Math.floor(x));
    return 1 + i + step(x - i);
  }
  const t = Math.min(1, (p - END_START) / (1 - END_START));
  return 9 + 20 * (smoothstep(t) + 0.105 * (t * t * t - 2 * t * t + t));
}

/** Progress through the end (0 to 1): the last card leaves, then the office arrives. */
export function endProgress(u: number): number {
  return Math.max(0, Math.min(1, (u - END_START) / (1 - END_START)));
}

/** Depth of the card of the project at `index` when it is sharp. */
export function cardDepth(index: number): number {
  return 1.5 + index;
}

// The end runs on its own clock (journey spec, office spec §5): time through the end, from the last project (0) to
// the contact (1). The last card leaves over its first 12 %, then the office arrives, evenly in time.
const END_SPLIT = 0.904;

/** From scroll progress to time through the end. */
export function endClock(u: number): number {
  const q =
    u <= END_SPLIT
      ? (0.12 * (u - LAST_PROJECT)) / (END_SPLIT - LAST_PROJECT)
      : 0.12 + (0.88 * (u - END_SPLIT)) / (1 - END_SPLIT);
  return Math.max(0, Math.min(1, q));
}

/** From time through the end back to scroll progress. */
export function endProgressAt(q: number): number {
  return q <= 0.12
    ? LAST_PROJECT + ((END_SPLIT - LAST_PROJECT) * q) / 0.12
    : END_SPLIT + ((1 - END_SPLIT) * (q - 0.12)) / 0.88;
}

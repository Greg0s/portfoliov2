/**
 * The journey's anchors and the camera's depth along it (journey spec §4). The journey is 11.25 screens of scroll: the
 * opening and the fading of its text (1 screen), 1.25 screens per project, 1.5 screens for the end. The scroll always
 * stops on an anchor: the opening, each of the 7 projects (its card sharp), the contact.
 *
 * `journeyTrack` builds the same track for any number of stops between the opening and the contact: the constellation
 * proposals (`?constellations=`, desktop) stop once, on the whole sky of projects, with a track of one stop.
 */
import { step } from './steps';

export const PROJECTS = 7;

const OPENING = 1;
const PER_PROJECT = 1.25;
const END = 1.5;

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** A journey from the opening to the contact, through `stops` stops. */
export interface Track {
  stops: number;
  /** Screens of scroll, from the opening to the contact. */
  screens: number;
  /** Progress (0 to 1) where the stops' stretch starts and ends, and where the end starts. */
  stopsStart: number;
  endStart: number;
  /** Progress of each anchor: the opening, the stops in the middle of their stretch, the contact. */
  anchors: readonly number[];
  /** The progress of the last stop's anchor, where the end starts its own clock. */
  lastStop: number;
  /** The camera's distance from the planet, in perspective units, for a scroll progress `u` (0 to 1). */
  cameraDepth(u: number): number;
  /** Progress through the end (0 to 1): the last card leaves, then the office arrives. */
  endProgress(u: number): number;
  /** From scroll progress to time through the end. */
  endClock(u: number): number;
  /** From time through the end back to scroll progress. */
  endProgressAt(q: number): number;
}

/** The journey's track through `stops` stops (7 projects, or 1 sky of constellations). */
export function journeyTrack(stops: number): Track {
  const screens = OPENING + PER_PROJECT * stops + END;
  const stopsStart = OPENING / screens;
  const endStart = (OPENING + PER_PROJECT * stops) / screens;
  const anchors = [
    0,
    ...Array.from({ length: stops }, (_, i) => (OPENING + PER_PROJECT * i + PER_PROJECT / 2) / screens),
    1,
  ];
  const lastStop = anchors[stops] ?? 0;
  // The end runs on its own clock (journey spec, office spec §5): time through the end, from the last stop (0) to the
  // contact (1). The last card leaves over its first 12 % (0.3 screen into the end), then the office arrives, evenly in
  // time.
  const endSplit = endStart + 0.3 / screens;

  return {
    stops,
    screens,
    stopsStart,
    endStart,
    anchors,
    lastStop,
    cameraDepth(u) {
      // The opening eases from 0 to 1; each stop's stretch adds 1 through the steps, its card sharp at depth
      // `1.5 + i`; the end goes 20 further back, slowing down onto the contact.
      const p = Math.max(0, Math.min(1, u));
      if (p < stopsStart) {
        const t = p / stopsStart;
        return 1.6 * t * t - 0.6 * t * t * t;
      }
      if (p < endStart) {
        const x = (p - stopsStart) / ((endStart - stopsStart) / stops);
        const i = Math.min(stops - 1, Math.floor(x));
        return 1 + i + step(x - i);
      }
      const t = Math.min(1, (p - endStart) / (1 - endStart));
      return 1 + stops + 20 * (smoothstep(t) + 0.105 * (t * t * t - 2 * t * t + t));
    },
    endProgress(u) {
      return Math.max(0, Math.min(1, (u - endStart) / (1 - endStart)));
    },
    endClock(u) {
      const q =
        u <= endSplit
          ? (0.12 * (u - lastStop)) / (endSplit - lastStop)
          : 0.12 + (0.88 * (u - endSplit)) / (1 - endSplit);
      return Math.max(0, Math.min(1, q));
    },
    endProgressAt(q) {
      return q <= 0.12
        ? lastStop + ((endSplit - lastStop) * q) / 0.12
        : endSplit + ((1 - endSplit) * (q - 0.12)) / 0.88;
    },
  };
}

/** The journey through the projects, one by one. */
export const projectsTrack = journeyTrack(PROJECTS);

/** Screens of scroll, from the opening to the contact. */
export const SCREENS = projectsTrack.screens;

/** Progress (0 to 1) where the projects' stretch starts and ends, and where the end starts. */
export const PROJECTS_START = projectsTrack.stopsStart;
export const END_START = projectsTrack.endStart;

/** Progress of each anchor: the opening, the projects in the middle of their stretch, the contact. */
export const anchors: readonly number[] = projectsTrack.anchors;

/** The anchor of the project at `index` (0 to `PROJECTS - 1`). */
export function projectAnchor(index: number): number {
  return anchors[index + 1] ?? 0;
}

/** The progress of the last project's anchor, where the end starts its own clock. */
export const LAST_PROJECT = projectsTrack.lastStop;

/**
 * The camera's distance from the planet, in perspective units, for a scroll progress `u` (0 to 1). The opening eases
 * from 0 to 1; each project's stretch adds 1 through the steps, its card sharp at depth `1.5 + i`; the end goes 20
 * further back, slowing down onto the contact.
 */
export const cameraDepth = (u: number): number => projectsTrack.cameraDepth(u);

/** Progress through the end (0 to 1): the last card leaves, then the office arrives. */
export const endProgress = (u: number): number => projectsTrack.endProgress(u);

/** Depth of the card of the project at `index` when it is sharp. */
export function cardDepth(index: number): number {
  return 1.5 + index;
}

/** From scroll progress to time through the end. */
export const endClock = (u: number): number => projectsTrack.endClock(u);

/** From time through the end back to scroll progress. */
export const endProgressAt = (q: number): number => projectsTrack.endProgressAt(q);

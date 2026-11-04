/**
 * The journey's anchors and the camera's depth along it (journey spec §4). The journey is 3.75 screens of scroll: the
 * opening and the fading of its text (1 screen), the ring of projects (1.25 screens, its anchor in the middle), 1.5
 * screens for the end. The scroll always stops on an anchor: the opening, the ring of projects, the contact.
 *
 * `journeyTrack` builds the same journey for any number of stops between the opening and the contact; the site has
 * one, the ring (see `src/scene/showcase/`).
 */
import { step } from './steps';

/** The projects on the ring; the content checks hold the projects' folders to it. */
export const PROJECTS = 7;

const OPENING = 1;
const PER_STOP = 1.25;
const END = 1.5;

/** The camera's depth at the first stop, where the ring is sharp. */
export const RING_DEPTH = 1.5;

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** A journey from the opening to the contact, through a number of stops. */
export interface Track {
  stops: number;
  /** Screens of scroll, from the opening to the contact. */
  screens: number;
  /** Progress (0 to 1) where the stops' stretch starts, and where the end starts. */
  stopsStart: number;
  endStart: number;
  /** Progress of each anchor: the opening, each stop in the middle of its stretch, the contact. */
  anchors: readonly number[];
  /** The progress of the last stop's anchor, where the end starts its own clock. */
  lastStop: number;
  /**
   * The camera's distance from the planet, in perspective units, for a scroll progress `u` (0 to 1). From the opening
   * to the first stop, it draws back evenly with the scroll, to depth 1.5 (the glide eases the move); each stop's
   * stretch then adds 1 through the steps, sharp at depth `1.5 + i`; the end goes 20 further back, slowing down onto
   * the contact.
   */
  cameraDepth: (u: number) => number;
  /** Progress through the end (0 to 1): the last stop leaves, then the office arrives. */
  endProgress: (u: number) => number;
  /** From scroll progress to time through the end. */
  endClock: (u: number) => number;
  /** From time through the end back to scroll progress. */
  endProgressAt: (q: number) => number;
}

/** The journey through `stops` stops. */
export function journeyTrack(stops: number): Track {
  const screens = OPENING + PER_STOP * stops + END;
  const stopsStart = OPENING / screens;
  const endStart = (OPENING + PER_STOP * stops) / screens;
  const anchors = [0, ...Array.from({ length: stops }, (_, i) => (OPENING + PER_STOP * i + PER_STOP / 2) / screens), 1];
  const first = anchors[1] ?? stopsStart;
  const lastStop = anchors[stops] ?? 0;
  // The end runs on its own clock (journey spec, office spec §5): time through the end, from the last stop (0) to the
  // contact (1). The last stop leaves over its first 12 % (0.3 screen into the end), then the office arrives, evenly
  // in time.
  const endSplit = endStart + 0.3 / screens;
  return {
    stops,
    screens,
    stopsStart,
    endStart,
    anchors,
    lastStop,
    cameraDepth: (u) => {
      const p = Math.max(0, Math.min(1, u));
      if (p < first) return (RING_DEPTH * p) / first;
      if (p < endStart) {
        const x = (p - stopsStart) / ((endStart - stopsStart) / stops);
        const i = Math.min(stops - 1, Math.floor(x));
        return 1 + i + step(x - i);
      }
      const t = Math.min(1, (p - endStart) / (1 - endStart));
      return 1 + stops + 20 * (smoothstep(t) + 0.105 * (t * t * t - 2 * t * t + t));
    },
    endProgress: (u) => Math.max(0, Math.min(1, (u - endStart) / (1 - endStart))),
    endClock: (u) => {
      const q =
        u <= endSplit
          ? (0.12 * (u - lastStop)) / (endSplit - lastStop)
          : 0.12 + (0.88 * (u - endSplit)) / (1 - endSplit);
      return Math.max(0, Math.min(1, q));
    },
    endProgressAt: (q) =>
      q <= 0.12 ? lastStop + ((endSplit - lastStop) * q) / 0.12 : endSplit + ((1 - endSplit) * (q - 0.12)) / 0.88,
  };
}

/** The site's journey: the opening, the ring of projects, the contact. */
export const journey = journeyTrack(1);

/** Screens of scroll, from the opening to the contact. */
export const SCREENS = journey.screens;
/** Progress of each anchor: the opening, the ring, the contact. */
export const anchors: readonly number[] = journey.anchors;
/** The progress of the ring's anchor. */
export const RING = journey.lastStop;
export const { cameraDepth, endProgress, endClock, endProgressAt } = journey;

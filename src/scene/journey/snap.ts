/**
 * Anchor to anchor (journey spec §4): a gesture (wheel, trackpad with its inertia, finger, keys) leads to the next or
 * the previous anchor, and the scroll never rests between two. The browser does most of it with mandatory scroll
 * snapping on the anchors; these functions take over where it cannot (keys, a scroll left between two anchors) and
 * glide from one anchor to another without ever blocking the native scroll.
 */

/** An anchor counts as reached within this many px. */
export const ON_ANCHOR = 2;

/** The scroll positions of the anchors, in px, for a screen `screen` px high and a journey of `screens` screens. */
export function anchorPositions(anchors: readonly number[], screens: number, screen: number): number[] {
  return anchors.map((u) => Math.round(u * screens * screen));
}

/** The index of the anchor at `position`, or -1 if the scroll is between two. */
export function anchorAt(position: number, positions: readonly number[]): number {
  return positions.findIndex((anchor) => Math.abs(anchor - position) <= ON_ANCHOR);
}

/** The index of the anchor nearest `position`. */
export function nearestAnchor(position: number, positions: readonly number[]): number {
  let best = 0;
  positions.forEach((anchor, i) => {
    if (Math.abs(anchor - position) < Math.abs((positions[best] ?? 0) - position)) best = i;
  });
  return best;
}

/**
 * Where a scroll left at `position` comes to rest: on its anchor if it is on one, else on the next anchor in the
 * direction of the last gesture (1 down, -1 up), or the nearest without a direction.
 */
export function settleAnchor(position: number, positions: readonly number[], direction: number): number {
  const on = anchorAt(position, positions);
  if (on >= 0) return on;
  if (direction > 0) {
    const next = positions.findIndex((anchor) => anchor > position);
    return next >= 0 ? next : positions.length - 1;
  }
  if (direction < 0) {
    for (let i = positions.length - 1; i >= 0; i -= 1) if ((positions[i] ?? 0) < position) return i;
    return 0;
  }
  return nearestAnchor(position, positions);
}

/** The anchor one step from `position` in `direction` (1 down, -1 up), for the keys. */
export function stepAnchor(position: number, positions: readonly number[], direction: number): number {
  const on = anchorAt(position, positions);
  if (on < 0) return settleAnchor(position, positions, direction);
  return Math.max(0, Math.min(positions.length - 1, on + Math.sign(direction)));
}

/** How long a glide over `distance` px lasts, in ms. */
export function glideDuration(distance: number): number {
  return Math.min(1800, 700 + Math.abs(distance) * 0.12);
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Tells the wheel's gestures apart: a mouse notch, or a swipe on a trackpad with its long tail of inertia, is one
 * gesture, and leads one anchor further. A new gesture starts after a pause, when the direction changes, or when the
 * wheel speeds up again in the middle of a tail of inertia. Returns, for each wheel event, the direction of the
 * gesture it starts (1 down, -1 up), or 0 when it continues the current one.
 */
export function wheelGestures(): (deltaY: number, time: number) => number {
  let lastTime = -Infinity;
  let lastDirection = 0;
  let lastSize = 0;
  let gestureStart = -Infinity;
  return (deltaY, time) => {
    if (deltaY === 0) return 0;
    const direction = Math.sign(deltaY);
    const size = Math.abs(deltaY);
    const pause = time - lastTime > 180;
    const turn = direction !== lastDirection;
    // Inertia only slows down: a wheel speeding up again, well after the gesture started, is a new swipe.
    const again = time - gestureStart > 600 && size > 12 && size > lastSize * 1.6;
    lastTime = time;
    lastDirection = direction;
    lastSize = size;
    if (!pause && !turn && !again) return 0;
    gestureStart = time;
    return direction;
  };
}

/**
 * A glide's easing from a moving start: it leaves at the speed the finger had (`startSlope`, in units of the
 * glide's mean speed, at most 3 to never overshoot) and slows down onto the anchor. At 0, the ease in and out of the
 * other glides is close.
 */
export function easeFrom(startSlope: number): (t: number) => number {
  const m = Math.max(0, Math.min(3, startSlope));
  if (m === 0) return easeInOutCubic;
  return (t) => m * (t * t * t - 2 * t * t + t) + 3 * t * t - 2 * t * t * t;
}

/**
 * The magnet between the anchors (journey spec §4): the view follows the wheel, the trackpad or the finger as far as
 * it goes, one anchor at most, then the magnet takes it to an anchor once the gesture ends. `?scroll=1` (soft),
 * `?scroll=2` (medium) and `?scroll=3` (firm, the default) tune it; `?scroll=0` brings back the former all-or-nothing gesture.
 */
export interface Magnet {
  /** Whether the view follows the gesture; false: one gesture, one anchor, as before. */
  follows: boolean;
  /** The share of the way to the next anchor past which the magnet leads there rather than back. */
  pass: number;
  /** A finger faster than this, in px/ms, leads to the next anchor whatever the distance (`FLICK_MIN` px at least). */
  flick: number;
  /** How long the wheel stays still, in ms, before the magnet takes over. */
  settle: number;
  /** The magnet's glides last this many times their usual duration. */
  pace: number;
}

/** The default magnet, the firm one (Grégoire's choice of 11 November 2026). */
export const MAGNET: Magnet = { follows: true, pass: 0.22, flick: 0.3, settle: 90, pace: 0.8 };

export const MAGNETS: Readonly<Record<string, Magnet>> = {
  '0': { follows: false, pass: 0, flick: 0, settle: 0, pace: 1 },
  '1': { follows: true, pass: 0.35, flick: 0.5, settle: 240, pace: 1.25 },
  '2': { follows: true, pass: 0.3, flick: 0.4, settle: 160, pace: 1 },
  '3': MAGNET,
};

/** The magnet the URL asks for (`?scroll=0` to `3`), the default one otherwise. */
export function magnetOf(search: string): Magnet {
  const asked = new URLSearchParams(search).get('scroll') ?? '';
  return MAGNETS[asked] ?? MAGNET;
}

/** A flick shorter than this, in px, is a tap. */
export const FLICK_MIN = 24;

/**
 * Where the magnet takes a gesture that started on the anchor `from` and left the view at `position`: the next anchor
 * in the gesture's direction if the view went past `magnet.pass` of the way there, if the gesture was a mouse notch
 * (`notch`, which always leads one anchor further), or if it ended fast that way (`speed`, px/ms, positive down); else
 * back to `from`. Never further than the next anchor.
 */
export function magnetAnchor(
  position: number,
  positions: readonly number[],
  from: number,
  speed: number,
  notch: boolean,
  magnet: Magnet,
): number {
  const start = positions[from];
  if (start === undefined) return nearestAnchor(position, positions);
  const moved = position - start;
  if (Math.abs(moved) <= ON_ANCHOR) return from;
  const way = Math.sign(moved);
  const next = Math.max(0, Math.min(positions.length - 1, from + way));
  const end = positions[next];
  if (next === from || end === undefined) return from;
  const share = Math.abs(moved) / Math.max(1, Math.abs(end - start));
  const fast = speed * way >= magnet.flick && Math.abs(moved) >= FLICK_MIN;
  return notch || share >= magnet.pass || fast ? next : from;
}

/** The anchors on either side of `position`, as indexes: the one it is on, and its neighbours. */
export function bracket(position: number, positions: readonly number[]): [number, number] {
  const on = anchorAt(position, positions);
  if (on >= 0) return [Math.max(0, on - 1), Math.min(positions.length - 1, on + 1)];
  let below = 0;
  positions.forEach((anchor, i) => {
    if (anchor < position) below = i;
  });
  return [below, Math.min(positions.length - 1, below + 1)];
}

/**
 * Whether a wheel event starting a gesture comes from a mouse's notched wheel rather than a trackpad: lines or pages
 * rather than pixels, or a first step as large as a notch (a trackpad starts with a few px).
 */
export function isNotch(deltaY: number, deltaMode: number): boolean {
  return deltaMode !== 0 || Math.abs(deltaY) >= 50;
}

/** A wheel event's move in px (`deltaMode` 1 counts lines, 2 pages). */
export function wheelPixels(deltaY: number, deltaMode: number, screen: number): number {
  if (deltaMode === 1) return deltaY * 40;
  if (deltaMode === 2) return deltaY * screen;
  return deltaY;
}

/**
 * An even glide: it speeds up over the first `ramp` of its time, cruises, and slows down over the last `ramp` (at
 * most half). The arrival at the office keeps this pace, 0.3 s to speed up and to slow down.
 */
export function easeRamp(ramp: number): (t: number) => number {
  const r = Math.max(0.001, Math.min(0.5, ramp));
  const top = 1 / (1 - r);
  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    if (t < r) return (top * t * t) / (2 * r);
    if (t > 1 - r) return 1 - (top * (1 - t) * (1 - t)) / (2 * r);
    return top * (t - r / 2);
  };
}

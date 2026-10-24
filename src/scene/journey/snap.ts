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

/**
 * The ring of projects (Grégoire, 3 and 4 November 2026): the projects no longer pass one by one, each on its own
 * stretch of scroll, but share one stop of the journey. They ride a ring around the Little Prince's planet, among
 * small stellar bodies; one project is in front (the first of the list when the visitor arrives), and the arrows, a
 * swipe or a click on a card beside it turn the ring by one section.
 *
 * Its geometry is a pure function of the selection `s`, a number that eases from one project to the next: where each
 * card stands on the ring, how it turns, how sharp it is.
 */
import type { View } from '../journey/layout';

/** How a card stands on the ring, in the journey's terms: px from the vanishing point at the focus plane, depth. */
export interface Pose {
  x: number;
  y: number;
  /** Depth in front of the ring's centre, in perspective units (negative: behind it). */
  z: number;
  rotateY: number;
  rotateZ: number;
  /** The card's own scale, on top of what its depth gives it. */
  scale: number;
  opacity: number;
  /** Blur, in px, before the perspective scales it. */
  blur: number;
}

export interface Ring {
  /** The ring's centre, the planet's, in px from the vanishing point. */
  cx: number;
  cy: number;
  /** Its half-width and half-height on the focus plane, in px, and its depth, in perspective units. */
  rx: number;
  ry: number;
  rz: number;
  /** The planet's diameter on screen, in px, at the stop. */
  planet: number;
  /** The width of a card, in px, before its depth scales it. */
  card: number;
}

/**
 * The ring for a screen. On desktop (drawn for 1440 × 900), the card in front sits just under the planet, its cartel
 * beside it; on a phone (drawn for 390 × 844), the card in front is 78 % of the width, its cartel under it.
 */
export function ringFor(view: View): Ring {
  if (view.mobile) {
    const w = view.width;
    const rz = 0.25;
    return {
      cx: 0,
      cy: -0.02 * view.height,
      rx: 0.72 * w,
      ry: 0.145 * view.height,
      rz,
      planet: 0.4 * w,
      card: 0.78 * w * (1 - rz),
    };
  }
  const sx = view.width / 1440;
  const sy = view.height / 900;
  return { cx: 0, cy: -112 * sy, rx: 600 * sx, ry: 186 * sy, rz: 0.32, planet: 272 * sy, card: 0.26 * view.width };
}

/** A point of the ring at angle `theta` (0: its front, in front of the planet), `r` its share of the radius. */
export function ringPoint(ring: Ring, theta: number, r = 1): { x: number; y: number; z: number } {
  return {
    x: ring.cx + ring.rx * r * Math.sin(theta),
    y: ring.cy + ring.ry * r * Math.cos(theta),
    z: ring.rz * r * Math.cos(theta),
  };
}

/** Card `i`'s offset from the selection `s`, wrapped into [−n/2, n/2): 0 in front, 1 the next one. */
export function offset(i: number, s: number, n: number): number {
  const o = i - s;
  return ((((o + n / 2) % n) + n) % n) - n / 2;
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The pose of card `i` of `n`, for the selection `s`. */
export function ringPose(i: number, s: number, n: number, view: View): Pose {
  const ring = ringFor(view);
  const theta = (2 * Math.PI * offset(i, s, n)) / n;
  const a = Math.abs(theta);
  const near = Math.exp(-((a / 0.5) ** 2));
  return {
    ...ringPoint(ring, theta),
    rotateY: -Math.sin(theta) * (view.mobile ? 22 : 28),
    rotateZ: -Math.sin(theta) * 5,
    scale: 0.5 + 0.5 * near,
    opacity: Math.exp(-((a / 0.68) ** 2)) * (1 - smooth(1.5, 2.1, a)),
    blur: 12 * (1 - near),
  };
}

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

/** On a phone, the gap between the card in front and its cartel, under it, in px. */
export const CARTEL_GAP = 22;

/** The ring's centre on a phone as drawn for 390 × 844, in px from the vanishing point. */
const mobileCentre = (view: View): number => -0.02 * view.height;

/**
 * The ring for a screen. On desktop (drawn for 1440 × 900), the card in front sits just under the planet, its cartel
 * beside it; on a phone (drawn for 390 × 844), the card in front is 78 % of the width, its cartel under it. A phone
 * shorter than that may have the ring raised and scaled down (`view.ring`, see `fitRing`).
 */
export function ringFor(view: View): Ring {
  if (view.mobile) {
    const w = view.width;
    const rz = 0.25;
    const f = view.ring?.scale ?? 1;
    const lift = view.ring?.lift ?? 0;
    return {
      cx: 0,
      // Raised all of a piece: the planet, at the centre, by `lift`, and the card in front, nearer the camera, by as
      // much on screen, its ring stretched for it by the share of the lift its depth would add.
      cy: mobileCentre(view) - lift,
      rx: 0.72 * w,
      ry: 0.145 * view.height * f + rz * lift,
      rz,
      planet: 0.4 * w * f,
      card: 0.78 * w * (1 - rz) * f,
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

/** The ring of a phone fitted to its screen; `clears` is the index, in `RingRoom.bottoms`, of the limit it keeps. */
export interface RingFit {
  lift: number;
  scale: number;
  clears: number;
}

/** What the ring of a phone must fit between, in px from the top of the screen. */
export interface RingRoom {
  /** The highest the planet may reach: under the header. */
  top: number;
  /** The lowest the cartel may reach, in order of preference: above the loading pause's pill, above the arrows. */
  bottoms: readonly number[];
  /** The height, in px, of the tallest cartel laid out `width` px wide. */
  cartel: (width: number) => number;
}

/** How far the planet, with the Little Prince and the fox on it, reaches above its centre, in planet diameters. */
const PLANET_REACH = 0.5;
/** How far the card in front floats down, with the camera's sway, in px: the cartel follows it. */
const FLOAT = 12;
/** The smallest scale the ring may be drawn at, on the smallest phones; to clear the loading pause's pill too. */
const SMALLEST = 0.72;
const SMALLEST_FOR_PILL = 0.88;

/**
 * Fits the ring of a phone to its screen (Grégoire, 11 November 2026): on a phone shorter than 390 × 844, the cartel
 * of the card in front would pass under the arrows. The ring then rises all of a piece into the sky under the header
 * and, only once the planet reaches the header, is drawn smaller, until the tallest cartel ends above the loading
 * pause's pill (down to 88 %), or else above the arrows (down to 72 %; the text then fades out under the pill while it
 * shows). On a phone tall enough, the ring stays as drawn. Null for desktop.
 */
export function fitRing(view: View, room: RingRoom): RingFit | null {
  if (!view.mobile) return null;
  const top = view.vpY + mobileCentre(view);
  /** The least lift that ends the cartel at `bottom`, the ring drawn at `f`; and whether the planet clears the header. */
  const place = (f: number, bottom: number): { lift: number; fits: boolean } => {
    const ring = ringFor({ ...view, ring: { lift: 0, scale: f } });
    const k = 1 / (1 - ring.rz);
    const height = room.cartel(ring.card * k);
    // The card's lower edge on screen, as drawn, then where it must end: above the cartel and the gap. The cartel,
    // nearer the camera, is drawn smaller in proportion, so it shows where it is placed, at its size (`journey.ts`).
    const drawn = view.vpY + (ring.cy + ring.ry) * k + ((ring.card * 9) / 32) * k;
    const lift = Math.max(0, drawn - (bottom - FLOAT - height - CARTEL_GAP));
    return { lift, fits: top - lift - PLANET_REACH * ring.planet >= room.top };
  };
  for (const [i, bottom] of room.bottoms.entries()) {
    const smallest = i < room.bottoms.length - 1 ? SMALLEST_FOR_PILL : SMALLEST;
    for (let f = 1; f >= smallest - 1e-9; f -= 0.02) {
      const { lift, fits } = place(f, bottom);
      if (fits) return { lift, scale: f, clears: i };
    }
  }
  const last = room.bottoms.length - 1;
  const bottom = room.bottoms[last];
  return bottom === undefined ? null : { lift: place(SMALLEST, bottom).lift, scale: SMALLEST, clears: last };
}

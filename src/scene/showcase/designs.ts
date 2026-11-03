/**
 * The showcase proposals (Grégoire, 3 November 2026): on desktop, the projects no longer pass one by one, each on its
 * own stretch of scroll, but share one stop of the journey. One project is in front (the first of the list when the
 * visitor arrives), and a click brings the next one, or the previous one. Each proposal is a way to arrange them:
 *
 * 1. The ring, its cartel with the card: the projects ride a ring around the Little Prince's planet, among small
 *    stellar bodies; each click turns the ring by one section.
 * 2. The ring, its cartel fixed on screen: the same ring, moved to the right, the cartel and a counter on the left.
 * 3. From asteroid to asteroid: like the Little Prince visiting asteroids 325 to 330, each project has its own
 *    asteroid along a trajectory that leads into the distance; each click travels to the next one.
 * 4. The pile: the projects stacked in depth, the front one sharp, the others blurred behind it; each click sends
 *    the front one past the camera and brings the next into focus.
 * 5. The astronomer's telescope: the projects scattered over the sky, a lens frames one; each click sweeps the
 *    telescope across the sky to the next one.
 *
 * Every arrangement is a pure function of the selection `s`, a number that eases from one project to the next: the
 * pose of each card (where it is, how it turns, how sharp it is) and what the sky draws around it.
 */
import type { View } from '../journey/layout';

/** How a card stands in the showcase, in the journey's terms: px from the vanishing point at the focus plane, depth. */
export interface Pose {
  x: number;
  y: number;
  /** Depth in front of the showcase's plane, in perspective units (negative: behind it). */
  z: number;
  rotateY: number;
  rotateZ: number;
  /** The card's own scale, on top of what its depth gives it. */
  scale: number;
  opacity: number;
  /** Blur, in px, before the perspective scales it. */
  blur: number;
}

export type Sky = 'ring' | 'path' | 'lens' | 'none';

export interface Design {
  id: number;
  /** Its short name, for the page and the captures. */
  name: string;
  /** The card's width, as a share of the screen's width. */
  cardWidth: number;
  /** Where the cartel of the project in front sits: beside or under its card, or at a fixed place on screen. */
  cartel: 'right' | 'below' | 'fixed';
  /** The fixed cartel's place: its left edge and its middle, as shares of the screen. */
  fixedCartel?: { x: number; y: number };
  /** A big counter ("02 / 08") at the top left. */
  counter: boolean;
  /** The arrows' place: under the fixed cartel, or centred at the bottom of the screen. */
  arrows: 'cartel' | 'bottom';
  /** The Little Prince's planet, held sharp at the centre of the ring: its centre (px from the vanishing point, at
   * 1440 × 900) and its diameter on screen. Null: it recedes as in the journey. */
  planet: { x: number; y: number; diameter: number } | null;
  /** Whether the journey's small worlds give way to the showcase's own sky. */
  ownSky: boolean;
  sky: Sky;
  /** The pose of card `i` of `n`, for the selection `s`. */
  pose(i: number, s: number, n: number, view: View): Pose;
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Card `i`'s offset from the selection, wrapped into [`from`, `from + n`). */
export function offset(i: number, s: number, n: number, from = -n / 2): number {
  const o = i - s;
  return ((((o - from) % n) + n) % n) + from;
}

// ---------- The ring ----------

export interface Ring {
  /** The ring's centre, the planet's, in px from the vanishing point (at the screen's scale). */
  cx: number;
  cy: number;
  /** Its half-width and half-height on the focus plane, in px, and its depth, in perspective units. */
  rx: number;
  ry: number;
  rz: number;
}

/** The ring of a proposal, for a screen. */
export function ringFor(id: number, view: View): Ring {
  const sx = view.width / 1440;
  const sy = view.height / 900;
  return id === 2
    ? { cx: 190 * sx, cy: -96 * sy, rx: 440 * sx, ry: 176 * sy, rz: 0.32 }
    : { cx: 0, cy: -112 * sy, rx: 600 * sx, ry: 186 * sy, rz: 0.32 };
}

/** A point of the ring at angle `theta` (0: its front, in front of the planet), `r` its share of the radius. */
export function ringPoint(ring: Ring, theta: number, r = 1): { x: number; y: number; z: number } {
  return {
    x: ring.cx + ring.rx * r * Math.sin(theta),
    y: ring.cy + ring.ry * r * Math.cos(theta),
    z: ring.rz * r * Math.cos(theta),
  };
}

function ringPose(id: number) {
  return (i: number, s: number, n: number, view: View): Pose => {
    const ring = ringFor(id, view);
    const theta = (2 * Math.PI * offset(i, s, n)) / n;
    const a = Math.abs(theta);
    const point = ringPoint(ring, theta);
    const near = Math.exp(-((a / 0.5) ** 2));
    return {
      ...point,
      rotateY: -Math.sin(theta) * 28,
      rotateZ: -Math.sin(theta) * 5,
      scale: 0.5 + 0.5 * near,
      opacity: Math.exp(-((a / 0.68) ** 2)) * (1 - smooth(1.5, 2.1, a)),
      blur: 12 * (1 - near),
    };
  };
}

// ---------- From asteroid to asteroid ----------

/** Where card `o` steps away from the front one sits along the trajectory, at the screen's scale. */
export function pathPoint(o: number, view: View): { x: number; y: number; z: number } {
  const w = view.width;
  const h = view.height;
  if (o >= 0) {
    const f = 1 - Math.exp(-0.9 * o);
    return { x: -0.15 * w + 0.72 * w * f, y: -0.07 * h - 0.4 * h * f, z: -0.62 * o };
  }
  return { x: -0.15 * w + 0.6 * w * o, y: -0.07 * h - 0.36 * h * o, z: -0.4 * o };
}

function pathPose(i: number, s: number, n: number, view: View): Pose {
  const o = offset(i, s, n, -2);
  const point = pathPoint(o, view);
  return {
    ...point,
    rotateY: o >= 0 ? -10 - 6 * Math.min(1, o) : -10 + 8 * o,
    rotateZ: o >= 0 ? -2 * Math.min(1, o) : 3 * o,
    scale: 1,
    opacity: o >= 0 ? Math.exp(-0.45 * o) * (1 - smooth(3.2, 4.2, o)) : 1 - smooth(0, 0.75, -o),
    blur: o >= 0 ? 3.5 * Math.min(o, 3) : 6 * smooth(0, 0.8, -o),
  };
}

// ---------- The pile ----------

/** Where the cards behind the front one wait, in shares of the screen (x, y), at depth `-0.38 · k`. */
const PILE: readonly (readonly [number, number, number])[] = [
  [0.16, 0.02, 0],
  [0.36, -0.3, 3],
  [-0.04, 0.34, -4],
  [0.44, 0.27, 2],
  [-0.1, -0.33, -2],
  [0.5, -0.06, 4],
  [0.06, -0.12, -3],
  [0.26, 0.4, 1],
];

function pilePose(i: number, s: number, n: number, view: View): Pose {
  const o = offset(i, s, n, -1);
  const w = view.width;
  const h = view.height;
  if (o < 0) {
    // The front card leaves past the camera, to the left, fading out.
    const k = -o;
    const [x, y] = PILE[0] ?? [0, 0];
    return {
      x: (x - 0.28 * k) * w,
      y: (y + 0.06 * k) * h,
      z: 0.6 * k,
      rotateY: -8 + 14 * k,
      rotateZ: -2 * k,
      scale: 1,
      opacity: 1 - smooth(0, 0.7, k),
      blur: 8 * smooth(0, 0.8, k),
    };
  }
  const k = Math.floor(o);
  const f = o - k;
  const a = PILE[Math.min(k, PILE.length - 1)] ?? [0, 0, 0];
  const b = PILE[Math.min(k + 1, PILE.length - 1)] ?? a;
  const mix = (p: number, q: number): number => p + (q - p) * f;
  return {
    x: mix(a[0], b[0]) * w,
    y: mix(a[1], b[1]) * h,
    z: -0.38 * o,
    rotateY: -8 * (1 - smooth(0, 1, o)),
    rotateZ: mix(a[2], b[2]),
    scale: 1,
    opacity: o < 1 ? 1 - 0.45 * o : 0.55 * Math.exp(-0.28 * (o - 1)),
    blur: o < 1 ? 14 * o : 14 + 3 * (o - 1),
  };
}

// ---------- The telescope ----------

/** The lens: its centre, in px from the vanishing point, and its radius, at the screen's scale. */
export function lensFor(view: View): { x: number; y: number; r: number } {
  return { x: -0.13 * view.width, y: 0.01 * view.height, r: 0.32 * view.height };
}

/** Where each project sits on the telescope's sky, in shares of the screen: a loop, so that the last leads to the first. */
const SKY_PLACES: readonly (readonly [number, number])[] = [
  [0, 0],
  [0.6, -0.34],
  [1.12, 0.12],
  [0.74, 0.66],
  [0.08, 0.86],
  [-0.56, 0.6],
  [-0.8, -0.02],
  [-0.46, -0.52],
];

/** Where the telescope points on its sky for the selection `s`: from one project's place to the next one's. */
export function telescopeAim(s: number, n: number, view: View): { x: number; y: number } {
  const k = Math.floor(s);
  const f = s - k;
  const a = SKY_PLACES[(((k % n) + n) % n) % SKY_PLACES.length] ?? [0, 0];
  const b = SKY_PLACES[((((k + 1) % n) + n) % n) % SKY_PLACES.length] ?? a;
  return { x: (a[0] + (b[0] - a[0]) * f) * view.width, y: (a[1] + (b[1] - a[1]) * f) * view.height };
}

function lensPose(i: number, s: number, n: number, view: View): Pose {
  const lens = lensFor(view);
  const aim = telescopeAim(s, n, view);
  const place = SKY_PLACES[i % SKY_PLACES.length] ?? [0, 0];
  const x = lens.x + place[0] * view.width - aim.x;
  const y = lens.y + place[1] * view.height - aim.y;
  const d = Math.hypot(x - lens.x, y - lens.y) / lens.r;
  return {
    x,
    y,
    z: -0.25 * smooth(0.4, 1.6, d),
    rotateY: 0,
    rotateZ: 0,
    scale: 1,
    opacity: 1 - 0.78 * smooth(0.45, 1.3, d),
    blur: 10 * smooth(0.3, 1.2, d),
  };
}

export const designs: readonly Design[] = [
  {
    id: 1,
    name: 'L’anneau, cartel avec la carte',
    cardWidth: 0.26,
    cartel: 'right',
    counter: false,
    arrows: 'bottom',
    planet: { x: 0, y: -112, diameter: 272 },
    ownSky: true,
    sky: 'ring',
    pose: ringPose(1),
  },
  {
    id: 2,
    name: 'L’anneau, cartel fixe',
    cardWidth: 0.25,
    cartel: 'fixed',
    fixedCartel: { x: 0.0445, y: 0.6 },
    counter: true,
    arrows: 'cartel',
    planet: { x: 190, y: -96, diameter: 250 },
    ownSky: true,
    sky: 'ring',
    pose: ringPose(2),
  },
  {
    id: 3,
    name: 'D’astéroïde en astéroïde',
    cardWidth: 0.33,
    cartel: 'below',
    counter: false,
    arrows: 'bottom',
    planet: null,
    ownSky: true,
    sky: 'path',
    pose: pathPose,
  },
  {
    id: 4,
    name: 'La pile',
    cardWidth: 0.36,
    cartel: 'fixed',
    fixedCartel: { x: 0.0445, y: 0.6 },
    counter: true,
    arrows: 'cartel',
    planet: null,
    ownSky: false,
    sky: 'none',
    pose: pilePose,
  },
  {
    id: 5,
    name: 'La lunette de l’astronome',
    cardWidth: 0.33,
    cartel: 'fixed',
    fixedCartel: { x: 0.6, y: 0.5 },
    counter: false,
    arrows: 'cartel',
    planet: null,
    ownSky: true,
    sky: 'lens',
    pose: lensPose,
  },
];

/** The proposal `id`, if there is one. */
export function designOf(id: number | null): Design | null {
  return designs.find((design) => design.id === id) ?? null;
}

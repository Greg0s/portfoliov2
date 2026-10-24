/**
 * The journey's camera (journey spec §4 and §5). The camera only moves back: at depth `D`, an object placed at depth
 * `z` is `z − D` perspective units in front of the focus plane, which scales it by `1 / (1 − (z − D))` and decides its
 * blur and opacity (sharp within ±10 %, blurred up to 12 px, fading down to about 0.25 as it recedes).
 *
 * One projection serves the CSS and WebGL: `projectCss` is what the browser does with the cards' transforms, and
 * `camera3d.ts` is the same camera for Three.js, so that the stars, the planet and the cards share one space. This
 * module stays free of Three.js, which the page loads later.
 */
import type { CardPlace, Star, View, World } from './layout';

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Cards never come closer than this in front of the focus plane: 3.6 times their sharp size. */
const NEAREST = 0.72;

/** Within this distance of the focus plane, the card is the sharp one; a little more keeps it (hysteresis). */
const FOCUS = 0.1;
const FOCUS_KEEP = 0.13;

/** The card in focus at depth `D`, or -1 between two cards; `current` is the card in focus until now. */
export function focusedCard(cards: readonly CardPlace[], depth: number, current = -1): number {
  const kept = cards[current];
  if (kept && Math.abs(kept.z - depth) < FOCUS_KEEP) return current;
  let focus = -1;
  for (const card of cards) {
    if (Math.abs(card.z - depth) < FOCUS) focus = card.index;
  }
  return focus;
}

export interface CardLook {
  /** Depth in front of the focus plane, in perspective units (negative: behind it). */
  depth: number;
  scale: number;
  opacity: number;
  /** Blur applied to the card before the perspective scales it, in px. */
  blur: number;
}

/** How a card looks with the camera at depth `D`. */
export function cardLook(card: CardPlace, cameraDepth: number): CardLook {
  const relative = card.z - cameraDepth;
  const depth = Math.min(relative, NEAREST);
  const scale = 1 / (1 - depth);
  let opacity = relative > 0 ? 1 - smoothstep(0.36, NEAREST, relative) : 1 - 0.75 * smoothstep(0.12, 1.3, -relative);
  opacity *= 1 - smoothstep(7, 14, -relative);
  const blur = Math.min(40, (12 * smoothstep(0.1, 0.8, Math.abs(relative))) / scale);
  return { depth, scale, opacity, blur };
}

export interface CartelPlace {
  /** Anchor point of the cartel, in px from the top left of the screen. */
  x: number;
  y: number;
  width: number;
}

/**
 * Where a card's cartel sits (journey spec §5): on desktop, beside the card's inner edge, on the centre's side, at
 * most 300 px wide; on mobile, under the card, as wide as the card.
 */
export function cartelPlace(card: CardPlace, look: CardLook, view: View): CartelPlace {
  const { scale, depth } = look;
  if (view.mobile) {
    return {
      x: view.vpX + (card.x - card.width / 2) * scale,
      y: view.vpY + (card.y + card.height / 2) * scale + 18,
      width: card.width * scale,
    };
  }
  const angle = (Math.abs(card.rotateY) * Math.PI) / 180;
  // The card's inner edge, turned toward the centre, is a little further away than its middle.
  const innerScale = 1 / (1 - depth + ((card.width / 2) * Math.sin(angle)) / view.perspective);
  const halfWidth = (card.width / 2) * Math.cos(angle);
  const inner = (card.onLeft ? card.x + halfWidth : card.x - halfWidth) * innerScale;
  return { x: view.vpX + inner + (card.onLeft ? 36 : -36), y: view.vpY + card.y * scale, width: 300 };
}

export interface PlanetLook {
  /** Scale of the planet against its size on the opening. */
  scale: number;
  blur: number;
  opacity: number;
  decorOpacity: number;
  haloOpacity: number;
  /** The point of light the planet becomes. */
  glowOpacity: number;
}

/** The planet recedes to a point of light, toward the vanishing point (journey spec §4). `sky` is the moment's. */
export function planetLook(cameraDepth: number, sky: number, arrival: number): PlanetLook {
  const scale = Math.pow(1 + cameraDepth, -1.3);
  return {
    scale,
    // The same depth of field as the cards: sharp on the opening, blurred as soon as it recedes.
    blur: 12 * smoothstep(0.1, 0.8, Math.abs(1 - 1 / scale)),
    opacity: 1 - 0.9 * smoothstep(0.03, 0.012, scale),
    decorOpacity: 0.6 * sky * smoothstep(0.07, 0.3, scale),
    haloOpacity: smoothstep(0.04, 0.25, scale),
    glowOpacity: smoothstep(0.06, 0.02, scale) * (1 - smoothstep(0, 0.08, arrival)),
  };
}

/** The opening's text stays sharp while the planet starts receding, then fades out, rising a few px. */
export function introFade(cameraDepth: number): number {
  return smoothstep(0.55, 1.1, cameraDepth);
}

/** Scale of the far stars: they barely move. */
export function farStarsScale(cameraDepth: number): number {
  return Math.pow(1 + cameraDepth, -0.14);
}

/** Opacity of a near star, before the moment's dimming. */
export function nearStarOpacity(star: Star, cameraDepth: number): number {
  const relative = star.z - cameraDepth;
  if (relative >= NEAREST || relative <= -2.8) return 0;
  return star.alpha * (1 - smoothstep(0.45, NEAREST, relative)) * (1 - smoothstep(1.4, 2.8, -relative));
}

export interface WorldLook {
  depth: number;
  opacity: number;
  blur: number;
}

/** A small world comes from behind, crosses the focus plane and recedes toward the planet, blurred out of focus. */
export function worldLook(world: World, cameraDepth: number): WorldLook {
  const relative = world.z - cameraDepth;
  const opacity =
    relative < 0.7 && relative > -3.6
      ? world.alpha * (1 - smoothstep(0.35, 0.7, relative)) * (1 - smoothstep(2, 3.6, -relative))
      : 0;
  const scale = 1 / (1 - Math.min(relative, 0.7));
  const blur = (relative > 0 ? 5 * smoothstep(0.15, 0.6, relative) : 1.2 * smoothstep(0.3, 1.5, -relative)) / scale;
  return { depth: relative, opacity, blur };
}

/** The camera's slight drift and its tilt toward the mouse, the same for every layer. */
export interface Sway {
  /** Drift, in px and degrees (around the screen's normal). */
  dx: number;
  dy: number;
  roll: number;
  /** Tilt toward the mouse, in degrees (CSS rotateX, rotateY). */
  tiltX: number;
  tiltY: number;
}

export const still: Sway = { dx: 0, dy: 0, roll: 0, tiltX: 0, tiltY: 0 };

/** The CSS transform of an object at (`x`, `y`) px from the vanishing point and `z` perspective units forward. */
export function cssTransform(x: number, y: number, z: number, view: View, sway: Sway): string {
  return (
    `translate(${sway.dx.toFixed(2)}px, ${sway.dy.toFixed(2)}px) rotate(${sway.roll.toFixed(3)}deg) ` +
    `rotateX(${sway.tiltX.toFixed(3)}deg) rotateY(${sway.tiltY.toFixed(3)}deg) ` +
    `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${(z * view.perspective).toFixed(2)}px)`
  );
}

/** The swayed position of a point (px from the vanishing point, z in px toward the viewer), in CSS axes. */
function swayed(x: number, y: number, z: number, sway: Sway): [number, number, number] {
  const rad = Math.PI / 180;
  // rotateY, then rotateX, then the roll, then the drift: the order of `cssTransform`, read from the right.
  const cy = Math.cos(sway.tiltY * rad);
  const sy = Math.sin(sway.tiltY * rad);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  const cx = Math.cos(sway.tiltX * rad);
  const sx = Math.sin(sway.tiltX * rad);
  const y2 = y * cx - z1 * sx;
  const z2 = y * sx + z1 * cx;
  const cr = Math.cos(sway.roll * rad);
  const sr = Math.sin(sway.roll * rad);
  return [x1 * cr - y2 * sr + sway.dx, x1 * sr + y2 * cr + sway.dy, z2];
}

/**
 * Where the browser draws a point placed with `cssTransform`: in px from the top left of the screen, with the scale
 * the perspective gives it there.
 */
export function projectCss(
  x: number,
  y: number,
  z: number,
  view: View,
  sway: Sway = still,
): { x: number; y: number; scale: number } {
  const [px, py, pz] = swayed(x, y, z * view.perspective, sway);
  const scale = view.perspective / (view.perspective - pz);
  return { x: view.vpX + px * scale, y: view.vpY + py * scale, scale };
}

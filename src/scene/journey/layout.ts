/**
 * The journey's scene for a screen (journey spec §4 and §5): the view (vanishing point, perspective), the cards
 * where they are sharp, the far and near stars, and the small worlds. The mockup's scene is drawn for 1440 × 900 on
 * desktop and 390 × 844 on mobile; on other screens its positions scale with the screen, except what the opening
 * places in pixels (the vanishing point on mobile, the cards' vertical offsets on mobile).
 *
 * The stars and the small worlds come from the mockup's seeded random sequence, in its order, so that the site draws
 * the same sky.
 */
import { cardDepth, PROJECTS } from './anchors';
import { MOBILE_CARD_WIDTH, mobileSlotAt, slotAt } from '../slots';

/** Below this width, the journey has its mobile framing (the same breakpoint as the CSS). */
export const MOBILE_BELOW = 768;

const DESKTOP = { width: 1440, height: 900, perspective: 1000 } as const;
const MOBILE = { width: 390, height: 844, perspective: 700, vpY: 248 } as const;

export interface View {
  width: number;
  height: number;
  mobile: boolean;
  /** The vanishing point, where the planet recedes, in px from the top left of the screen. */
  vpX: number;
  vpY: number;
  /** The CSS perspective, in px: an object at depth `z` (in perspective units) sits `z · perspective` px away. */
  perspective: number;
}

export interface CardPlace {
  index: number;
  /** Depth where the card is sharp. */
  z: number;
  /** Centre of the card when it is sharp, in px from the vanishing point. */
  x: number;
  y: number;
  width: number;
  height: number;
  rotateY: number;
  rotateZ: number;
  onLeft: boolean;
  floatDuration: number;
  floatDelay: number;
}

export interface Star {
  /** Far stars barely move; near stars sit along the camera's path and stream toward the planet. */
  near: boolean;
  /** Far: px from the vanishing point. Near: px at the focus plane. */
  x: number;
  y: number;
  /** Near stars only: depth along the path. */
  z: number;
  size: number;
  alpha: number;
  big: boolean;
  /** Far stars twinkle (ms); the first ones stay until the contact, the others fade during the end. */
  twinkleDuration: number;
  twinkleDelay: number;
  keep: boolean;
}

export type WorldKind = 'orb' | 'moon' | 'ring' | 'tilt' | 'star';

export interface World {
  kind: WorldKind;
  x: number;
  y: number;
  z: number;
  /** Diameter of the disc, in px at the focus plane. */
  size: number;
  alpha: number;
  ringRotation: number;
  lineRotation: number;
  floatDuration: number;
  floatDelay: number;
}

export interface Scene {
  view: View;
  cards: CardPlace[];
  stars: Star[];
  worlds: World[];
}

/** The mockup's random sequence (mulberry32), seeded per framing. */
export function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The view for a screen of `width` × `height` px. */
export function viewFor(width: number, height: number): View {
  const mobile = width < MOBILE_BELOW;
  return mobile
    ? {
        width,
        height,
        mobile,
        vpX: width / 2,
        vpY: MOBILE.vpY,
        perspective: (MOBILE.perspective * width) / MOBILE.width,
      }
    : {
        width,
        height,
        mobile,
        vpX: width / 2,
        vpY: height / 2,
        perspective: (DESKTOP.perspective * width) / DESKTOP.width,
      };
}

// The small worlds of the mockup, at the focus plane of its framing: x, y (px from the vanishing point), depth, disc
// diameter, kind. They sit between the projects, away from the cards and their cartels.
const DESKTOP_WORLDS: readonly (readonly [number, number, number, number, WorldKind])[] = [
  [-198, 630, 0.7, 12, 'orb'],
  [848, 304, 0.9, 20, 'orb'],
  [180, -420, 1.0, 16, 'moon'],
  [560, -300, 1.15, 24, 'ring'],
  [348, 372, 1.3, 14, 'star'],
  [488, -24, 1.7, 18, 'tilt'],
  [-430, 330, 1.85, 14, 'star'],
  [-560, -320, 2.2, 18, 'orb'],
  [520, 330, 2.85, 30, 'tilt'],
  [700, -140, 3.2, 16, 'moon'],
  [-380, 340, 3.85, 12, 'star'],
  [-560, 300, 4.2, 22, 'ring'],
  [480, -330, 4.85, 16, 'orb'],
  [560, 320, 5.2, 26, 'tilt'],
  [-440, -330, 5.85, 12, 'star'],
  [-720, 160, 6.2, 20, 'ring'],
  [500, 340, 6.85, 16, 'moon'],
  [560, -300, 7.2, 18, 'orb'],
  [-420, 330, 7.85, 12, 'star'],
  [-560, 320, 8.2, 24, 'ring'],
  [420, -330, 8.9, 14, 'star'],
];

const MOBILE_WORLDS: readonly (readonly [number, number, number, number, WorldKind])[] = [
  [209, 561, 0.95, 12, 'orb'],
  [-167, -142, 1.05, 11, 'moon'],
  [110, -120, 1.15, 16, 'ring'],
  [-162, 543, 1.3, 9, 'star'],
  [-120, 420, 1.85, 10, 'star'],
  [-110, -130, 2.2, 13, 'orb'],
  [120, 440, 2.85, 18, 'tilt'],
  [115, -125, 3.2, 12, 'moon'],
  [-120, 430, 3.85, 9, 'star'],
  [-110, 380, 4.2, 15, 'ring'],
  [115, -130, 5.2, 12, 'orb'],
  [130, 420, 5.85, 16, 'tilt'],
  [-115, -125, 6.2, 13, 'ring'],
  [110, 410, 7.2, 11, 'moon'],
  [-120, -120, 7.85, 9, 'star'],
  [120, 430, 8.2, 14, 'orb'],
];

/** The number of small worlds per framing: 21 on desktop, 16 on mobile. */
export const worldCount = { desktop: DESKTOP_WORLDS.length, mobile: MOBILE_WORLDS.length } as const;

/** The whole scene for a screen. */
export function sceneFor(width: number, height: number): Scene {
  const view = viewFor(width, height);
  const { mobile } = view;
  const rand = seeded(mobile ? 29 : 7);
  // Horizontal and vertical scales from the mockup's framing to this screen.
  const sx = width / (mobile ? MOBILE.width : DESKTOP.width);
  const sy = height / (mobile ? MOBILE.height : DESKTOP.height);

  const cards: CardPlace[] = Array.from({ length: PROJECTS }, (_, index) => {
    const floatDuration = Math.round(8000 + (2500 * ((index * 3) % 8)) / 7);
    const floatDelay = -1700 * index;
    if (mobile) {
      const slot = mobileSlotAt(index);
      const cardWidth = (MOBILE_CARD_WIDTH / 100) * width;
      return {
        index,
        z: cardDepth(index),
        x: (slot.x / 100) * width,
        y: slot.y,
        width: cardWidth,
        height: (cardWidth * 9) / 16,
        rotateY: slot.rotateY,
        rotateZ: slot.rotateZ,
        onLeft: slot.x < 0,
        floatDuration,
        floatDelay,
      };
    }
    const slot = slotAt(index);
    const cardWidth = (slot.width / 100) * width;
    return {
      index,
      z: cardDepth(index),
      x: (slot.x / 100) * width,
      y: (slot.y / 100) * height,
      width: cardWidth,
      height: (cardWidth * 9) / 16,
      rotateY: slot.rotateY,
      rotateZ: slot.rotateZ,
      onLeft: slot.x < 0,
      floatDuration,
      floatDelay,
    };
  });

  const stars: Star[] = [];
  // Far stars: a backdrop that barely moves; the first ones stay until the end.
  const farCount = mobile ? 50 : 90;
  const keepCount = mobile ? 16 : 30;
  for (let k = 0; k < farCount; k += 1) {
    const big = rand() < 0.12;
    const size = big ? 2.2 + rand() * 1.2 : 1 + rand() * 1.1;
    const x = (rand() * 2 - 1) * width * 0.85;
    const y = -view.vpY * 1.7 + rand() * height * 1.7;
    const alpha = 0.35 + rand() * 0.6;
    const twinkleDuration = Math.round(2500 + rand() * 4500);
    const twinkleDelay = -Math.round(rand() * 7000);
    stars.push({ near: false, x, y, z: 0, size, alpha, big, twinkleDuration, twinkleDelay, keep: k < keepCount });
  }
  // Near stars, spread along the camera's path: they come from behind and stream toward the planet.
  const nearCount = mobile ? 36 : 56;
  for (let k = 0; k < nearCount; k += 1) {
    const z = 0.4 + ((k + rand()) / nearCount) * 10;
    const big = rand() < 0.18;
    const size = big ? 3.5 + rand() * 2.5 : 1.4 + rand() * 1.2;
    const x = (rand() * 2 - 1) * (mobile ? 600 : 1700) * sx;
    const y = (mobile ? -700 + rand() * 2000 : (rand() * 2 - 1) * 1050) * sy;
    const alpha = 0.4 + rand() * 0.5;
    stars.push({ near: true, x, y, z, size, alpha, big, twinkleDuration: 0, twinkleDelay: 0, keep: true });
  }

  const worlds: World[] = (mobile ? MOBILE_WORLDS : DESKTOP_WORLDS).map(([x, y, z, size, kind]) => {
    const alpha = 0.5 + rand() * 0.25;
    const ringRotation = -8 - rand() * 14;
    const lineRotation = -30 - rand() * 15;
    const floatDuration = Math.round(9000 + rand() * 7000);
    const floatDelay = -Math.round(rand() * 9000);
    return {
      kind,
      x: x * sx,
      y: mobile ? y : y * sy,
      z,
      size: size * sx,
      alpha,
      ringRotation,
      lineRotation,
      floatDuration,
      floatDelay,
    };
  });

  return { view, cards, stars, worlds };
}

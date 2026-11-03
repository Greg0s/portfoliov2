/**
 * The constellation proposals, as data: where each project sits in the sky (in px from the vanishing point, at the focus
 * plane of a 1440 × 900 screen, and its depth in perspective units around the sky's), the faint stars that complete
 * each constellation, the paths its lines follow, and how a project shows.
 *
 * The two constellations (Grégoire, 2 November 2026): personal projects (Lyrix, What we play?, SNCF Wrapped) and
 * professional ones (Siemens, Perfmanager, Obaine). On 3 November he kept three proposals and asked for changes: the
 * planetarium around the Little Prince's planet, and the chart and the focus with the projects' own cards.
 */

export type Group = 'perso' | 'pro';

export const GROUP_OF: Readonly<Record<string, Group>> = {
  lyrix: 'perso',
  'what-we-play': 'perso',
  'sncf-wrapped': 'perso',
  siemens: 'pro',
  perfmanager: 'pro',
  obaine: 'pro',
};

/** The sky's depth: the camera rests there, as it does on the first project's card. */
export const SKY_DEPTH = 1.5;

/** A project in the sky. */
export interface BodySpec {
  slug: string;
  x: number;
  y: number;
  /** Depth from the sky's, in perspective units (positive: nearer). */
  dz: number;
  /** Radius of its planet, in px at the focus plane (the planetarium). */
  r: number;
}

/** A faint star that only completes a constellation's drawing. */
export interface MinorSpec {
  x: number;
  y: number;
  dz: number;
  size: number;
  group: Group;
}

/** A point of a constellation's path: a project (its slug) or a faint star (its index). */
export type PointRef = string | number;

export interface PathSpec {
  group: Group;
  points: PointRef[];
}

/** A constellation's name, written in the sky: where (px, depth), and its turn (degrees, in the screen and in depth). */
export interface NameSpec {
  group: Group;
  x: number;
  y: number;
  dz: number;
  angle: number;
  turn: number;
}

export type Look = 'planets' | 'chart' | 'focus';

/** How the projects' own cards behave in the sky (the chart and the focus). */
export interface CardsSpec {
  /** The card's width at rest and when it shows, in % of the screen's. */
  rest: number;
  shown: number;
  /** How far toward the middle a card moves when it shows (0 to 1), and the depth it comes forward to. */
  pull: number;
  front: number;
  /** The cards hold each other by the constellations' threads, and push each other aside as they grow. */
  linked: boolean;
}

export interface SkyDesign {
  variant: number;
  look: Look;
  bodies: BodySpec[];
  minors: MinorSpec[];
  paths: PathSpec[];
  /** The projects as their own cards (the chart and the focus); without, as planets with a preview in the middle. */
  cards?: CardsSpec;
  /** The preview's width (the planetarium), in % of the screen's. */
  previewWidth: number;
  /** The legend at the bottom of the screen, which draws a constellation on a click. */
  legend: boolean;
  /** Each constellation in its own light (warm for the personal projects, night blue for the professional ones). */
  tinted: boolean;
  /** The constellations' names: on the chart, always written; in space (the planetarium), only while one shows. */
  names?: NameSpec[];
  namesIn: 'chart' | 'space';
  /** The Little Prince's planet in the middle of the sky, sharp: its width, in px on a 1440 px wide screen. */
  planet?: number;
}

/**
 * 1. The planetarium: Grégoire's idea, each project a small planet with its picture and a ring, around the Little
 * Prince's planet; one light for both constellations, whose names show in space while one of their projects shows.
 */
const planets: SkyDesign = {
  variant: 1,
  look: 'planets',
  bodies: [
    { slug: 'lyrix', x: -455, y: -175, dz: 0.1, r: 40 },
    { slug: 'what-we-play', x: -330, y: 70, dz: -0.2, r: 38 },
    { slug: 'sncf-wrapped', x: -545, y: 235, dz: 0.2, r: 32 },
    { slug: 'siemens', x: 345, y: -210, dz: -0.12, r: 38 },
    { slug: 'perfmanager', x: 555, y: 5, dz: 0.16, r: 38 },
    { slug: 'obaine', x: 375, y: 225, dz: -0.24, r: 40 },
  ],
  minors: [
    { x: -330, y: -300, dz: -0.05, size: 2.2, group: 'perso' },
    { x: -620, y: -40, dz: 0.05, size: 2, group: 'perso' },
    { x: 560, y: -285, dz: -0.1, size: 2.2, group: 'pro' },
    { x: 610, y: 300, dz: 0.05, size: 2, group: 'pro' },
  ],
  paths: [
    { group: 'perso', points: [0, 'lyrix', 1, 'sncf-wrapped', 'what-we-play', 'lyrix'] },
    { group: 'pro', points: [2, 'siemens', 'perfmanager', 'obaine', 3] },
  ],
  previewWidth: 34,
  legend: false,
  tinted: false,
  names: [
    { group: 'perso', x: -500, y: 335, dz: -0.05, angle: -2, turn: 16 },
    { group: 'pro', x: 505, y: -330, dz: -0.08, angle: 2, turn: -16 },
  ],
  namesIn: 'space',
  planet: 300,
};

/**
 * 2. The star chart: the projects' cards over a planisphere, held together by their constellations' threads; a card
 * that shows grows and comes a little toward the middle, pushing the others aside, which pull their threads along.
 */
const chart: SkyDesign = {
  variant: 2,
  look: 'chart',
  bodies: [
    { slug: 'lyrix', x: -470, y: -140, dz: 0.06, r: 0 },
    { slug: 'what-we-play', x: -190, y: -250, dz: -0.08, r: 0 },
    { slug: 'sncf-wrapped', x: -330, y: 90, dz: 0.1, r: 0 },
    { slug: 'siemens', x: 185, y: 135, dz: -0.06, r: 0 },
    { slug: 'perfmanager', x: 450, y: -110, dz: 0.08, r: 0 },
    { slug: 'obaine', x: 520, y: 215, dz: -0.1, r: 0 },
  ],
  minors: [
    { x: -600, y: 40, dz: 0, size: 2.4, group: 'perso' },
    { x: -560, y: 260, dz: 0.05, size: 2, group: 'perso' },
    { x: -60, y: -110, dz: -0.05, size: 2.2, group: 'perso' },
    { x: 290, y: -270, dz: -0.1, size: 2.2, group: 'pro' },
    { x: 630, y: 5, dz: 0.05, size: 2, group: 'pro' },
    { x: 330, y: 320, dz: 0, size: 2.4, group: 'pro' },
  ],
  paths: [
    { group: 'perso', points: [1, 0, 'lyrix', 'what-we-play', 2, 'sncf-wrapped', 0] },
    { group: 'pro', points: [3, 'perfmanager', 4, 'obaine', 5, 'siemens', 'perfmanager'] },
  ],
  cards: { rest: 13, shown: 24, pull: 0.25, front: 0.3, linked: true },
  previewWidth: 30,
  legend: false,
  tinted: false,
  names: [
    { group: 'perso', x: -390, y: -340, dz: 0, angle: -6, turn: 0 },
    { group: 'pro', x: 395, y: 345, dz: 0, angle: 4, turn: 0 },
  ],
  namesIn: 'chart',
};

/**
 * 3. The focus: the projects' cards at very different depths, out of focus but the ones on the focus plane; a card
 * that shows grows, comes to the middle and takes the focus, the rest blurring away.
 */
const focus: SkyDesign = {
  variant: 3,
  look: 'focus',
  bodies: [
    { slug: 'lyrix', x: -470, y: -170, dz: 0.28, r: 0 },
    { slug: 'what-we-play', x: -220, y: 130, dz: -0.34, r: 0 },
    { slug: 'sncf-wrapped', x: -585, y: 205, dz: -0.04, r: 0 },
    { slug: 'siemens', x: 250, y: -215, dz: -0.24, r: 0 },
    { slug: 'perfmanager', x: 500, y: 15, dz: 0.2, r: 0 },
    { slug: 'obaine', x: 305, y: 235, dz: 0.06, r: 0 },
  ],
  minors: [],
  paths: [
    { group: 'perso', points: ['lyrix', 'sncf-wrapped', 'what-we-play', 'lyrix'] },
    { group: 'pro', points: ['siemens', 'perfmanager', 'obaine', 'siemens'] },
  ],
  cards: { rest: 13, shown: 30, pull: 0.72, front: 0.4, linked: false },
  previewWidth: 32,
  legend: true,
  tinted: true,
  namesIn: 'chart',
};

export const designs: readonly SkyDesign[] = [planets, chart, focus];

/** The design of proposal `variant` (1 to 3). */
export function designFor(variant: number): SkyDesign {
  return designs[variant - 1] ?? planets;
}

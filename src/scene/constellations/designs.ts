/**
 * The five constellation proposals, as data: where each project sits in the sky (in px from the vanishing point, at
 * the focus plane of a 1440 × 900 screen, and its depth in perspective units around the sky's), the faint stars that
 * complete each constellation, the paths its lines follow, and how the preview of a project shows.
 *
 * The two constellations (Grégoire, 2 November 2026): personal projects (Lyrix, What we play?, SNCF Wrapped) and
 * professional ones (Siemens, Perfmanager, Obaine).
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
  /** Radius of its body, in px at the focus plane. */
  r: number;
  /** Its letter in its constellation, as on a star chart (α, β, γ). */
  letter?: string;
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

/** Two orbital systems (proposal 4): each group's sun, and its projects on their orbits. */
export interface SystemSpec {
  group: Group;
  x: number;
  y: number;
  /** The orbits' tilt toward the camera (degrees around x) and their roll (degrees around z). */
  tilt: number;
  roll: number;
}

export interface OrbitSpec {
  slug: string;
  radius: number;
  /** One turn, in ms. */
  period: number;
  phase: number;
}

export type Look = 'planets' | 'chart' | 'focus' | 'systems' | 'figures';

export interface SkyDesign {
  variant: number;
  look: Look;
  bodies: BodySpec[];
  minors: MinorSpec[];
  paths: PathSpec[];
  /**
   * Where the preview shows: in the middle of the screen, beside the project's star, growing out of it, or over the
   * other half of the sky.
   */
  preview: 'center' | 'beside' | 'bloom' | 'opposite';
  /** The preview's width, in % of the screen's. */
  previewWidth: number;
  /** The legend at the bottom of the screen, which draws a constellation on a click. */
  legend: boolean;
  /** Each constellation's name, where it is written (px, degrees), for the chart and the figures. */
  names?: { group: Group; x: number; y: number; angle: number }[];
  systems?: SystemSpec[];
  orbits?: OrbitSpec[];
}

/** 1. The planetarium: Grégoire's idea, each project a small planet with its picture and a ring of its group's light. */
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
  preview: 'center',
  previewWidth: 34,
  legend: true,
};

/** 2. The star chart: white stars with their names, as on an old atlas, over a planisphere. */
const chart: SkyDesign = {
  variant: 2,
  look: 'chart',
  bodies: [
    { slug: 'lyrix', x: -470, y: -150, dz: 0.08, r: 7, letter: 'α' },
    { slug: 'what-we-play', x: -215, y: -245, dz: -0.12, r: 6, letter: 'β' },
    { slug: 'sncf-wrapped', x: -330, y: 70, dz: 0.16, r: 5.5, letter: 'γ' },
    { slug: 'siemens', x: 175, y: 120, dz: -0.08, r: 6, letter: 'β' },
    { slug: 'perfmanager', x: 440, y: -95, dz: 0.12, r: 7, letter: 'α' },
    { slug: 'obaine', x: 545, y: 210, dz: -0.18, r: 5.5, letter: 'γ' },
  ],
  minors: [
    { x: -600, y: 40, dz: 0, size: 2.4, group: 'perso' },
    { x: -560, y: 245, dz: 0.05, size: 2, group: 'perso' },
    { x: -80, y: -120, dz: -0.05, size: 2.2, group: 'perso' },
    { x: 300, y: -250, dz: -0.1, size: 2.2, group: 'pro' },
    { x: 610, y: -10, dz: 0.05, size: 2, group: 'pro' },
    { x: 320, y: 300, dz: 0, size: 2.4, group: 'pro' },
  ],
  paths: [
    { group: 'perso', points: [1, 0, 'lyrix', 'what-we-play', 2, 'sncf-wrapped', 0] },
    { group: 'pro', points: [3, 'perfmanager', 4, 'obaine', 5, 'siemens', 'perfmanager'] },
  ],
  preview: 'beside',
  previewWidth: 30,
  legend: false,
  names: [
    { group: 'perso', x: -390, y: -330, angle: -6 },
    { group: 'pro', x: 395, y: 330, angle: 4 },
  ],
};

/** 3. The focus: lights at very different depths, out of focus; the camera focuses on the one under the mouse. */
const focus: SkyDesign = {
  variant: 3,
  look: 'focus',
  bodies: [
    { slug: 'lyrix', x: -470, y: -180, dz: 0.3, r: 7 },
    { slug: 'what-we-play', x: -230, y: 120, dz: -0.36, r: 7 },
    { slug: 'sncf-wrapped', x: -580, y: 200, dz: -0.04, r: 7 },
    { slug: 'siemens', x: 260, y: -215, dz: -0.26, r: 7 },
    { slug: 'perfmanager', x: 545, y: 10, dz: 0.22, r: 7 },
    { slug: 'obaine', x: 320, y: 225, dz: 0.06, r: 7 },
  ],
  minors: [],
  paths: [
    { group: 'perso', points: ['lyrix', 'sncf-wrapped', 'what-we-play', 'lyrix'] },
    { group: 'pro', points: ['siemens', 'perfmanager', 'obaine', 'siemens'] },
  ],
  preview: 'bloom',
  previewWidth: 32,
  legend: true,
};

/** 4. The two systems: each group a small solar system, its projects orbiting its sun. */
const systems: SkyDesign = {
  variant: 4,
  look: 'systems',
  bodies: [
    { slug: 'lyrix', x: 0, y: 0, dz: 0, r: 30 },
    { slug: 'what-we-play', x: 0, y: 0, dz: 0, r: 28 },
    { slug: 'sncf-wrapped', x: 0, y: 0, dz: 0, r: 27 },
    { slug: 'siemens', x: 0, y: 0, dz: 0, r: 28 },
    { slug: 'perfmanager', x: 0, y: 0, dz: 0, r: 30 },
    { slug: 'obaine', x: 0, y: 0, dz: 0, r: 27 },
  ],
  minors: [],
  paths: [],
  preview: 'opposite',
  previewWidth: 36,
  legend: false,
  systems: [
    { group: 'perso', x: -370, y: 20, tilt: 66, roll: -8 },
    { group: 'pro', x: 370, y: 20, tilt: 66, roll: 8 },
  ],
  orbits: [
    { slug: 'lyrix', radius: 105, period: 52000, phase: 0.15 },
    { slug: 'what-we-play', radius: 165, period: 78000, phase: 0.62 },
    { slug: 'sncf-wrapped', radius: 228, period: 110000, phase: 0.36 },
    { slug: 'siemens', radius: 105, period: 56000, phase: 0.8 },
    { slug: 'perfmanager', radius: 165, period: 82000, phase: 0.3 },
    { slug: 'obaine', radius: 228, period: 104000, phase: 0.05 },
  ],
};

/**
 * 5. The figures: the constellations draw two figures of the book, as old atlases did: the fox (personal projects,
 * the ones he tamed) and the rose (professional ones, the ones he is responsible for).
 */
const figures: SkyDesign = {
  variant: 5,
  look: 'figures',
  bodies: [
    // The fox, lying, its head to the left: Lyrix on its head, What we play? at the tip of its tail, SNCF Wrapped on its
    // front paw.
    { slug: 'lyrix', x: -585, y: -165, dz: 0.1, r: 7, letter: 'α' },
    { slug: 'what-we-play', x: -20, y: -235, dz: -0.12, r: 6, letter: 'β' },
    { slug: 'sncf-wrapped', x: -545, y: 145, dz: 0.08, r: 5.5, letter: 'γ' },
    // The rose under its globe: Obaine in its heart, Siemens on a leaf, Perfmanager at the foot of the globe.
    { slug: 'obaine', x: 395, y: -195, dz: 0.08, r: 7, letter: 'α' },
    { slug: 'siemens', x: 290, y: 15, dz: 0.02, r: 6, letter: 'β' },
    { slug: 'perfmanager', x: 400, y: 240, dz: -0.04, r: 6, letter: 'γ' },
  ],
  minors: [
    // The fox (0 to 14).
    { x: -625, y: -238, dz: 0.12, size: 2.3, group: 'perso' }, // 0 left ear
    { x: -545, y: -245, dz: 0.11, size: 2.3, group: 'perso' }, // 1 right ear
    { x: -690, y: -120, dz: 0.12, size: 2.1, group: 'perso' }, // 2 snout
    { x: -605, y: -95, dz: 0.1, size: 1.8, group: 'perso' }, // 3 jaw
    { x: -515, y: -135, dz: 0.08, size: 1.9, group: 'perso' }, // 4 nape
    { x: -395, y: -100, dz: 0.04, size: 2.2, group: 'perso' }, // 5 shoulder
    { x: -255, y: -85, dz: 0, size: 2, group: 'perso' }, // 6 back
    { x: -150, y: -50, dz: -0.04, size: 2.4, group: 'perso' }, // 7 hip
    { x: -70, y: -120, dz: -0.08, size: 2, group: 'perso' }, // 8 tail, rising
    { x: -115, y: -185, dz: -0.1, size: 1.8, group: 'perso' }, // 9 tail, inner side
    { x: -525, y: 15, dz: 0.08, size: 2, group: 'perso' }, // 10 chest
    { x: -245, y: 40, dz: 0, size: 2, group: 'perso' }, // 11 belly
    { x: -205, y: 150, dz: 0, size: 2.2, group: 'perso' }, // 12 hind paw
    { x: -40, y: -175, dz: -0.1, size: 1.6, group: 'perso' }, // 13 tail, outer side
    { x: -590, y: -150, dz: 0.11, size: 1.4, group: 'perso' }, // 14 (unused)
    // The rose (15 to 30).
    { x: 335, y: -255, dz: 0.09, size: 2.2, group: 'pro' }, // 15 left petal
    { x: 395, y: -292, dz: 0.09, size: 2.4, group: 'pro' }, // 16 top petal
    { x: 462, y: -258, dz: 0.09, size: 2.2, group: 'pro' }, // 17 right petal
    { x: 452, y: -165, dz: 0.08, size: 1.9, group: 'pro' }, // 18 right of the cup
    { x: 340, y: -162, dz: 0.08, size: 1.9, group: 'pro' }, // 19 left of the cup
    { x: 396, y: -122, dz: 0.07, size: 2, group: 'pro' }, // 20 base of the flower
    { x: 397, y: -10, dz: 0.04, size: 1.7, group: 'pro' }, // 21 stem, under the leaves
    { x: 400, y: 112, dz: 0.01, size: 1.7, group: 'pro' }, // 22 stem, low
    { x: 505, y: 45, dz: 0.03, size: 2, group: 'pro' }, // 23 right leaf
    { x: 240, y: 240, dz: -0.06, size: 1.6, group: 'pro' }, // 24 globe, foot left
    { x: 222, y: 40, dz: -0.06, size: 1.7, group: 'pro' }, // 25 globe, left
    { x: 262, y: -190, dz: -0.06, size: 1.7, group: 'pro' }, // 26 globe, shoulder left
    { x: 397, y: -345, dz: -0.06, size: 2, group: 'pro' }, // 27 globe, top
    { x: 532, y: -190, dz: -0.06, size: 1.7, group: 'pro' }, // 28 globe, shoulder right
    { x: 572, y: 40, dz: -0.06, size: 1.7, group: 'pro' }, // 29 globe, right
    { x: 555, y: 240, dz: -0.06, size: 1.6, group: 'pro' }, // 30 globe, foot right
  ],
  paths: [
    // The fox: its head, its back and its tail, its throat, its belly and its paws.
    { group: 'perso', points: [2, 0, 1, 4, 5, 6, 7, 8, 13, 'what-we-play', 9, 7] },
    { group: 'perso', points: [2, 3, 10, 'sncf-wrapped'] },
    { group: 'perso', points: [10, 11, 12] },
    { group: 'perso', points: [11, 7] },
    { group: 'perso', points: [0, 'lyrix', 1] },
    // The rose: its flower, its stem and leaves, then its globe.
    { group: 'pro', points: [20, 19, 15, 16, 17, 18, 20] },
    { group: 'pro', points: [16, 'obaine', 20] },
    { group: 'pro', points: [20, 21, 22, 'perfmanager'] },
    { group: 'pro', points: [21, 'siemens', 22] },
    { group: 'pro', points: [21, 23, 22] },
    { group: 'pro', points: ['perfmanager', 24, 25, 26, 27, 28, 29, 30, 'perfmanager'] },
  ],
  preview: 'beside',
  previewWidth: 30,
  legend: false,
  names: [
    { group: 'perso', x: -350, y: -300, angle: -3 },
    { group: 'pro', x: 610, y: -330, angle: 0 },
  ],
};

export const designs: readonly SkyDesign[] = [planets, chart, focus, systems, figures];

/** The design of proposal `variant` (1 to 5). */
export function designFor(variant: number): SkyDesign {
  return designs[variant - 1] ?? planets;
}

/**
 * The office's two moments (office spec §4 and §8): the sky from the top of the frame down to the horizon, the glow of
 * the sun behind the hills, the town's and the room's lights. At dusk the sun, a disc a little larger than life
 * (`sunDisc`, degrees), sets behind the hills in a dip between two of them, where the sky glows.
 */
import type { Moment } from '../time';

type Light = readonly [string, number];

export interface OfficeMoment {
  sky: readonly string[];
  glow: { azimuth: number; color: string; strength: number };
  sunDisc?: { elevation: number; size: number };
  city: {
    hemi: readonly [string, string, number];
    sun: Light;
    fill: Light;
    lit: number;
    litGlow: number;
    lamps: number;
    fog: string;
    hills: string;
  };
  room: {
    hemi: readonly [string, string, number];
    window: Light;
    bounce: Light;
    lamp: Light;
    screen: Light;
    exposure: number;
  };
}

export const MOMENTS: Record<Moment, OfficeMoment> = {
  aube: {
    sky: ['#101834', '#27366a', '#6c68a0', '#cb94a2', '#eec29f'],
    glow: { azimuth: -15, color: '#ffe4b8', strength: 0.5 },
    city: {
      hemi: ['#8f9bd2', '#2a2734', 1.2],
      sun: ['#ffc6a6', 0.5],
      fill: ['#a3b2ea', 0.45],
      lit: 0.12,
      litGlow: 0.85,
      lamps: 2.2,
      fog: '#c9a3b3',
      hills: '#6f6f9c',
    },
    room: {
      hemi: ['#8c92c6', '#2a2430', 0.4],
      window: ['#c8b8ea', 3.4],
      bounce: ['#bdb9dc', 1.2],
      lamp: ['#ffb46a', 7],
      screen: ['#ffb07a', 0.8],
      exposure: 1,
    },
  },
  crepuscule: {
    sky: ['#121538', '#3b3172', '#a2567b', '#e7845a', '#f8b26b'],
    glow: { azimuth: -9.5, color: '#ffd38c', strength: 0.7 },
    sunDisc: { elevation: 2.05, size: 2.4 },
    city: {
      hemi: ['#b391b6', '#2d1d23', 1.1],
      sun: ['#ff9a5a', 0.85],
      fill: ['#ab9cdb', 0.38],
      lit: 0.38,
      litGlow: 1.2,
      lamps: 3.5,
      fog: '#e09a7c',
      hills: '#9b6377',
    },
    room: {
      hemi: ['#a67f99', '#2c1e1c', 0.4],
      window: ['#ffa47c', 4.1],
      bounce: ['#dcb9a8', 1.2],
      lamp: ['#ffae60', 8],
      screen: ['#ffa868', 0.9],
      exposure: 1,
    },
  },
};

/**
 * The office's frame (office spec §3 and §5): the picture is composed for a frame of 1440 × 900 px on desktop and
 * 390 × 844 px on phones, and scaled to cover the contact section, as the still image is. Everything laid over the
 * scene in HTML (the sky, the screen, the pictures, the text) is placed in the frame's pixels, as in the mockup.
 */
import type { Framing } from './framings';

export interface FrameSpec {
  w: number;
  h: number;
  /** Where the arrival's camera move is aimed, the vanishing point of the room and the desk. */
  axis: [number, number];
  /** How far the town (`tilt`) and the sky (`tiltSky`) sit lower at the start of the arrival. */
  tilt: number;
  tiltSky: number;
  /** The planet B 612, where the journey leaves it once the sky has risen. */
  planet: [number, number];
  /** Where the sky's stars are scattered. */
  sky: { x0: number; x1: number; y0: number; y1: number };
  /** The shooting star now and then, and the welcome one: start, length, travel. */
  shoot: { x: number; y: number; w: number; dx: number; dy: number };
  welcome: { x: number; y: number; w: number; dx: number; dy: number };
  /** The moon at dawn: centre and diameter. */
  moon: [number, number, number];
  /** How far each depth slides when the head follows the mouse, at the edge of the frame (x, y). */
  par: { far: [number, number]; city: [number, number]; room: [number, number]; desk: [number, number] };
  /** The flare's width and the number of stars in the light-speed jump. */
  flare: number;
  jumpStars: number;
  /** The seed of the sky's stars, clouds and jump. */
  seed: number;
}

export const FRAMES: Record<Framing, FrameSpec> = {
  desktop: {
    w: 1440,
    h: 900,
    axis: [720, 450],
    tilt: 560,
    tiltSky: 336,
    planet: [705, 114],
    sky: { x0: 460, x1: 1400, y0: 70, y1: 200 },
    shoot: { x: 1290, y: 60, w: 150, dx: -300, dy: 155 },
    welcome: { x: 1330, y: 78, w: 230, dx: -350, dy: 128 },
    moon: [1290, 165, 20],
    par: { far: [2, 1.2], city: [4, 2.4], room: [8, 4.5], desk: [13, 7] },
    flare: 1300,
    jumpStars: 200,
    seed: 17,
  },
  mobile: {
    w: 390,
    h: 844,
    axis: [195, 300],
    tilt: 480,
    tiltSky: 39,
    planet: [195, 209],
    sky: { x0: 20, x1: 370, y0: 228, y1: 330 },
    shoot: { x: 378, y: 232, w: 56, dx: -76, dy: 18 },
    welcome: { x: 392, y: 210, w: 84, dx: -136, dy: 30 },
    moon: [352, 246, 14],
    par: { far: [0, 0], city: [0, 0], room: [0, 0], desk: [0, 0] },
    flare: 520,
    jumpStars: 120,
    seed: 61,
  },
};

/** The framing of a viewport: the phone's under 768 px, as the still image's. */
export function framingOf(width: number): Framing {
  return width < 768 ? 'mobile' : 'desktop';
}

export interface Fit {
  /** Scale from frame px to CSS px, and where the frame's top-left corner lands in the section. */
  k: number;
  x: number;
  y: number;
}

/** The frame scaled to cover a `width` × `height` section, centred. */
export function coverFit(spec: Pick<FrameSpec, 'w' | 'h'>, width: number, height: number): Fit {
  const k = Math.max(width / spec.w, height / spec.h);
  return { k, x: (width - spec.w * k) / 2, y: (height - spec.h * k) / 2 };
}

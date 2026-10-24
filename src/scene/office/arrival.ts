/**
 * The arrival at the office (office spec §5), as a function of its progress `e` (0 to 1, 3.5 s on the journey's end
 * clock): the light-speed jump while the stars stretch into streaks, then the sky rising from the horizon, the camera
 * tilted up toward it coming down onto the town, and backing through the window to the seat while the room unfolds
 * around it; the contact's text comes last. With reduced motion, the office simply fades in. Every value follows the
 * mockup (`Bureau.dc.html`).
 */
import { smoothstep as sm } from './common';
import type { FrameSpec } from './frame';

/** How far the camera starts in front of the seat, in metres: out by the window, beyond the wall. */
export const ARRIVAL_DEPTH = 1.75;

/** The jump's speed through it: it gathers, holds, then drops before the sky appears. */
export function jumpSpeed(x: number): number {
  return Math.pow(sm(0.03, 0.11, x), 1.8) * (1 - Math.pow(sm(0.22, 0.29, x), 0.6));
}

export interface ArrivalState {
  /** The arrival after the jump, 0 to 1. */
  ep: number;
  /** How much lower the town (through the camera's tilt) and the sky still sit, in frame px. */
  tiltY: number;
  tiltSkyY: number;
  /** How far the sky is revealed from the horizon up, and its own opacity. */
  reveal: number;
  skyOp: number;
  /** The stars, clouds and moon of the sky; the town; the glow behind the hills. */
  skyLifeOp: number;
  cityOp: number;
  glowK: number;
  /** The camera in front of its seat, in metres along its axis (negative: toward the window). */
  camZ: number;
  /** The contact's text. */
  textK: number;
  /** The whole office, with reduced motion only. */
  fadeOp: number;
  jump: {
    on: boolean;
    /** Speed now, and the depth travelled since the start. */
    v: number;
    travel: number;
    opacity: number;
    burst: number;
    shake: [number, number];
  };
}

export function arrivalState(
  e: number,
  frame: Pick<FrameSpec, 'tilt' | 'tiltSky'>,
  calm: boolean,
  mobile: boolean,
): ArrivalState {
  const ep = calm ? e : Math.max(0, (e - 0.32) / 0.68);
  const down = 1 - sm(0.05, 0.6, ep);
  const p = calm ? 1 : sm(0.32, 1, ep);
  const jumping = !calm && e < 0.32;
  const v = jumping ? jumpSpeed(e) : 0;
  let travel = 0;
  if (jumping) for (let i = 0; i < 24; i += 1) travel += (jumpSpeed(((i + 0.5) / 24) * e) * e) / 24;
  const shake = (mobile ? 1.2 : 1.8) * v;
  return {
    ep,
    tiltY: calm ? 0 : down * frame.tilt,
    tiltSkyY: calm ? 0 : down * frame.tiltSky,
    reveal: calm ? 1 : sm(0, 0.45, ep),
    skyOp: calm ? 1 : sm(0, 0.06, ep),
    skyLifeOp: calm ? 1 : sm(0, 0.2, ep),
    cityOp: calm ? 1 : sm(0, 0.12, ep),
    glowK: calm ? 1 : sm(0, 0.15, ep),
    camZ: -ARRIVAL_DEPTH * Math.pow(1 - p, 3),
    textK: sm(0.82, 1, ep),
    fadeOp: calm ? sm(0.2, 0.8, e) : 1,
    jump: {
      on: jumping,
      v,
      travel,
      opacity: sm(0, 0.03, e) * (1 - sm(0.27, 0.31, e)),
      burst: jumping ? sm(0.095, 0.12, e) * (1 - sm(0.12, 0.17, e)) : 0,
      shake: [Math.sin(e * 260) * shake, Math.cos(e * 205) * shake * 0.7],
    },
  };
}

/**
 * How visible a plane `z` metres in front of the seat is while the camera is at `camZ`: as in the mockup, the room
 * and the desk fade in once the camera has backed far enough from their planes that they no longer fill the view.
 */
export function layerFade(camZ: number, z: number): number {
  const d = camZ - z;
  if (d <= 0.02) return 0;
  return 1 - sm(6, 14, Math.min(14, -z / d));
}

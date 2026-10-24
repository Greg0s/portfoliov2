/**
 * The office's two framings (office spec §3): the eyes of someone seated at the desk, wide enough to see the desk and
 * the window. Angles are in degrees; the pitch is positive when looking up. On mobile the eye stands a little higher
 * and to the right: the sky of the window at the top for the contact, the screen, the rose and the pencil cup to the
 * right, the town to the left of the screen.
 */
import { PerspectiveCamera } from 'three';
import { DEG } from './common';

export type Framing = 'desktop' | 'mobile';

export interface FramingSpec {
  /** The frame the scene was composed for, in CSS px. */
  w: number;
  h: number;
  fov: number;
  pos: readonly [number, number, number];
  pitch: number;
  yaw: number;
}

export const FRAMINGS: Record<Framing, FramingSpec> = {
  desktop: { w: 1440, h: 900, fov: 62, pos: [0, 1.2, 0], pitch: -3, yaw: 0 },
  mobile: { w: 390, h: 844, fov: 80, pos: [0.1, 1.4, 0.35], pitch: 7, yaw: -13 },
};

/** The camera of a framing; `overscan` widens the field by a margin on every side (the layers' 4 %). */
export function makeCamera(framing: Framing, overscan = 0): PerspectiveCamera {
  const f = FRAMINGS[framing];
  const fov = (2 * Math.atan(Math.tan((f.fov * DEG) / 2) * (1 + 2 * overscan))) / DEG;
  const camera = new PerspectiveCamera(fov, f.w / f.h, 0.03, 12000);
  camera.position.set(...f.pos);
  camera.rotation.order = 'YXZ';
  camera.rotation.set(f.pitch * DEG, f.yaw * DEG, 0);
  camera.updateMatrixWorld();
  return camera;
}

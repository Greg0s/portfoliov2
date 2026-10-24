/**
 * Where things land in the picture (office spec §3): the screen's and the pictures' corners, the window, the lamp's
 * bulb, the horizon, the glow and the setting sun, in pixels of a frame of the given size. The HTML laid over the
 * office (the screen, the pictures, the sky) follows them; the fallback layers keep them in `placement.json`.
 */
import { Vector3, type Camera, type Object3D, type PerspectiveCamera } from 'three';
import { DEG, ROOM, SCREEN } from './common';
import type { Office } from './office';
import type { PictureData } from './room';

export type Point = [number, number];
export type Quad = [Point, Point, Point, Point];

const round = (v: number): number => Number(v.toFixed(2));

/** Projects points of the scene into pixels of a frame of the given size. */
export function toPixels(points: Vector3[], camera: Camera, w: number, h: number): Point[] {
  return points.map((p) => {
    const v = p.clone().project(camera);
    return [round(((v.x + 1) / 2) * w), round(((1 - v.y) / 2) * h)];
  });
}

const quadOf = (points: Point[]): Quad => {
  const [a = [0, 0], b = [0, 0], c = [0, 0], d = [0, 0]] = points;
  return [a, b, c, d];
};

/** The four corners of the screen (top-left, top-right, bottom-right, bottom-left), in world space. */
export function screenCorners(monitor: Object3D): Vector3[] {
  const screen = monitor.getObjectByName('screen');
  if (!screen) return [];
  screen.updateMatrixWorld(true);
  const x = SCREEN.w / 2;
  const y = SCREEN.h / 2;
  return (
    [
      [-x, y],
      [x, y],
      [x, -y],
      [-x, -y],
    ] as const
  ).map(([cx, cy]) => new Vector3(cx, cy, 0).applyMatrix4(screen.matrixWorld));
}

export interface PictureCorners {
  id: string;
  type: string;
  ratio: number;
  corners: Vector3[];
}

/** The four corners of each picture's face, in world space, with its type: the wall's and the one on the desk. */
export function pictureCorners(root: Object3D): PictureCorners[] {
  const out: PictureCorners[] = [];
  root.updateMatrixWorld(true);
  root.traverse((node) => {
    if (!node.name.startsWith('picture-')) return;
    const { w, h, d, type } = node.userData as PictureData;
    const corners = (
      [
        [-w / 2, h / 2],
        [w / 2, h / 2],
        [w / 2, -h / 2],
        [-w / 2, -h / 2],
      ] as const
    ).map(([cx, cy]) => new Vector3(cx, cy, d / 2).applyMatrix4(node.matrixWorld));
    out.push({ id: node.name.slice(8), type, ratio: Number((w / h).toFixed(4)), corners });
  });
  return out;
}

export interface Placement {
  horizon: number;
  glow: Point;
  screen: Quad;
  window: Quad;
  bulb: Point;
  /** The setting sun's centre and radius (dusk only). */
  sun: [number, number, number] | null;
  pictures: { id: string; type: string; ratio: number; corners: Quad }[];
  camera: { fov: number; position: number[]; rotation: [number, number] };
}

/** World points that do not move with the camera, gathered once; `placement` projects them. */
export interface Anchors {
  screen: Vector3[];
  window: Vector3[];
  bulb: Vector3;
  sun: { centre: Vector3; rim: Vector3 } | null;
  pictures: PictureCorners[];
  glowAzimuth: number;
}

export function anchorsOf(office: Office): Anchors {
  const { win, wallZ } = ROOM;
  const bulb = new Vector3();
  office.desk.lamp.getObjectByName('bulb')?.getWorldPosition(bulb);
  const sunMesh = office.city.sun;
  let sun: Anchors['sun'] = null;
  if (sunMesh) {
    sunMesh.updateMatrixWorld(true);
    const radius = Number(sunMesh.userData.radius);
    sun = {
      centre: sunMesh.getWorldPosition(new Vector3()),
      rim: new Vector3(0, radius, 0).applyMatrix4(sunMesh.matrixWorld),
    };
  }
  return {
    screen: screenCorners(office.desk.monitor),
    window: [
      new Vector3(win.x0, win.y1, wallZ),
      new Vector3(win.x1, win.y1, wallZ),
      new Vector3(win.x1, win.y0, wallZ),
      new Vector3(win.x0, win.y0, wallZ),
    ],
    bulb,
    sun,
    pictures: pictureCorners(office.scene),
    glowAzimuth: office.moment.glow.azimuth * DEG,
  };
}

export function placement(office: Office | Anchors, camera: PerspectiveCamera, w: number, h: number): Placement {
  const a = 'scene' in office ? anchorsOf(office) : office;
  const px = (points: Vector3[]): Point[] => toPixels(points, camera, w, h);
  const far = (az: number): Vector3 =>
    new Vector3(Math.sin(az) * 1e5, camera.position.y, camera.position.z - Math.cos(az) * 1e5);
  let sun: Placement['sun'] = null;
  if (a.sun) {
    const [[x, y] = [0, 0], [rx, ry] = [0, 0]] = px([a.sun.centre, a.sun.rim]);
    sun = [x, y, round(Math.hypot(rx - x, ry - y))];
  }
  return {
    horizon: px([far(0)])[0]?.[1] ?? 0,
    glow: px([far(a.glowAzimuth)])[0] ?? [0, 0],
    screen: quadOf(px(a.screen)),
    window: quadOf(px(a.window)),
    bulb: px([a.bulb])[0] ?? [0, 0],
    sun,
    pictures: a.pictures.map((p) => ({ id: p.id, type: p.type, ratio: p.ratio, corners: quadOf(px(p.corners)) })),
    camera: {
      fov: camera.fov,
      position: camera.position.toArray(),
      rotation: [camera.rotation.x, camera.rotation.y],
    },
  };
}

/**
 * The room (office spec §3): the wall in one piece with its wide window, the slim white frame and the sill, and the
 * pictures stuck on the wall, whose faces are white so that the HTML pictures laid over them take the room's light.
 */
import {
  ExtrudeGeometry,
  Group,
  Mesh,
  Path,
  Shape,
  Vector2,
  Vector3,
  type Material,
  type PerspectiveCamera,
} from 'three';
import { box, LAYERS, onLayer, ROOM, std } from './common';
import { makeCamera } from './framings';

/** The point of the front wall seen at a given fraction of the desktop frame. */
function wallPoint(camera: PerspectiveCamera, fx: number, fy: number): Vector3 {
  const p = new Vector3(fx * 2 - 1, 1 - fy * 2, 0.5).unproject(camera);
  const dir = p.sub(camera.position).normalize();
  return camera.position.clone().addScaledVector(dir, (ROOM.wallZ - camera.position.z) / dir.z);
}

/** What a picture's face carries, for the HTML laid over it. */
export interface PictureData {
  type: string;
  w: number;
  h: number;
  d: number;
}

/**
 * The pictures stuck straight onto the wall with blu-tack (nothing shows), filling the wall left of the window. `at`
 * is the top-left corner as a fraction of the desktop frame, `w` the width of the picture in metres, `ratio` its width
 * over its height. Posters and covers are printed to the edge; photos and film stills have a thin white border,
 * paintings a wide one, as art prints.
 */
const FRAMES = [
  { id: 'film', type: 'film', kind: 'print', at: [-0.0347, 0.0178], w: 0.36, ratio: 16 / 9 },
  { id: 'painting', type: 'painting', kind: 'art', at: [0.1424, 0.0178], w: 0.29, ratio: 3 / 2 },
  { id: 'poster', type: 'poster', kind: 'poster', at: [-0.0208, 0.1889], w: 0.417, ratio: 2 / 3 },
  { id: 'photo-portrait', type: 'photo', kind: 'print', at: [0.1819, 0.1911], w: 0.195, ratio: 4 / 5 },
  { id: 'photo-landscape', type: 'photo', kind: 'print', at: [0.1819, 0.3911], w: 0.21, ratio: 4 / 3 },
  { id: 'album', type: 'album', kind: 'poster', at: [0.1819, 0.5322], w: 0.224, ratio: 1 },
] as const;
const BORDER = { poster: 0, print: 0.007, art: 0.022 } as const;

export function buildRoom(): Group {
  const { wallZ, wallT, win, height } = ROOM;
  const g = new Group();
  const plaster = std(0xe6ddcf, 0.95);
  // The wall in one piece, so that no seam lets the sky through, and the ceiling (seen on mobile).
  const outline = new Shape([
    new Vector2(-3.4, 0),
    new Vector2(3.4, 0),
    new Vector2(3.4, height),
    new Vector2(-3.4, height),
  ]);
  outline.holes.push(
    new Path([
      new Vector2(win.x0, win.y0),
      new Vector2(win.x0, win.y1),
      new Vector2(win.x1, win.y1),
      new Vector2(win.x1, win.y0),
    ]),
  );
  const wall = new Mesh(new ExtrudeGeometry(outline, { depth: wallT, bevelEnabled: false }), plaster);
  wall.position.z = wallZ - wallT;
  g.add(wall);
  g.add(box(6.8, 0.05, 3, std(0xb9b0a4, 0.95), 0, height + 0.025, wallZ + 1.5));

  // A wide single pane that runs out of the frame on the right, in a slim white frame set against the inner face of
  // the wall. There is no glass to render.
  const joinery = std(0xf2f0eb, 0.45);
  const fz = wallZ - 0.04;
  const W = win.x1 - win.x0;
  const H = win.y1 - win.y0;
  const cx = (win.x0 + win.x1) / 2;
  const cy = (win.y0 + win.y1) / 2;
  const fw = 0.045;
  const ring = (inset: number, width: number, depth: number, z: number, material: Material): void => {
    g.add(box(width, H - 2 * inset, depth, material, win.x0 + inset + width / 2, cy, z, 0.004));
    g.add(box(width, H - 2 * inset, depth, material, win.x1 - inset - width / 2, cy, z, 0.004));
    g.add(box(W - 2 * inset, width, depth, material, cx, win.y1 - inset - width / 2, z, 0.004));
    g.add(box(W - 2 * inset, width, depth, material, cx, win.y0 + inset + width / 2, z, 0.004));
  };
  ring(0, fw, 0.06, fz, joinery);
  ring(fw - 0.004, 0.026, 0.045, fz + 0.022, joinery);

  // A slim stone sill under the frame.
  g.add(box(W + 0.06, 0.022, 0.05, std(0xcfc6b8, 0.7), cx, win.y0 - 0.011, wallZ + 0.012, 0.004));

  const camera = makeCamera('desktop');
  const paper = std(0xf3efe7, 0.9);
  const blank = std(0xffffff, 0.9);
  FRAMES.forEach((f, i) => {
    const a = wallPoint(camera, f.at[0], f.at[1]);
    const iw = f.w;
    const ih = f.w / f.ratio;
    const bd = BORDER[f.kind];
    const sw = iw + 2 * bd;
    const sh = ih + 2 * bd;
    const x = a.x + sw / 2;
    const y = a.y - sh / 2;
    const tilt = (i % 2 ? 1 : -1) * (f.kind === 'poster' ? 0.006 : 0.012);
    if (bd) {
      const sheet = box(sw, sh, 0.0015, paper, x, y, wallZ + 0.002);
      sheet.rotation.z = tilt;
      g.add(sheet);
    }
    const picture = box(iw, ih, 0.0015, blank, x, y, wallZ + (bd ? 0.0032 : 0.002));
    picture.rotation.z = tilt;
    picture.name = `picture-${f.id}`;
    const data: PictureData = { type: f.type, w: iw, h: ih, d: 0.0015 };
    picture.userData = data;
    g.add(picture);
  });
  return onLayer(g, LAYERS.room);
}

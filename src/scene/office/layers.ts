/**
 * The office's layers (office spec §6, plan step 7): the fallback of the live office, as the mockup drew it. The
 * town, the room and the desk are pictures rendered from the site's own scene (`scripts/render-office-layers.ts`),
 * moved in CSS: the town zooms and shifts as the live town does, the room and the desk grow about the frame's axis as
 * the camera backs to the seat, and every layer slides with the head by its depth. It needs no WebGL: it takes over
 * when the live office is too slow, or when WebGL is missing. It is placed in the frame's pixels, as the sky is.
 */
import { FADE_PLANES, layerFade, type ArrivalState } from './arrival';
import type { Placement, Point, Quad } from './corners';
import type { Fit, FrameSpec } from './frame';
import type { Framing } from './framings';
import type { Drawn, Head, OfficeScene, PictureSource } from './live';
import type { Moment } from '../time';
import { quadMatrix } from '../../lib/quad';

/** What `placement.json` holds for a moment and a framing: where things land in the layers' pictures. */
interface LayerMeta extends Placement {
  /** The pictures' size in px of the frame (the frame and its margin), and their pixel ratio. */
  w: number;
  h: number;
  scale: number;
}

export interface LayersOptions {
  moment: Moment;
  framing: Framing;
  frame: FrameSpec;
  /** The folder of the layers and of `placement.json`. */
  base: string;
}

/** The layer at depth `z`'s scale when the camera is at `camZ` (it grows as the camera nears it), as the mockup's. */
function layerScale(camZ: number, z: number): number {
  const d = camZ - z;
  return d <= 0.02 ? 14 : Math.min(14, -z / d);
}

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  parent?: HTMLElement,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  parent?.append(node);
  return node;
};
const px = (v: number): string => `${v.toFixed(1)}px`;

/** A picture fully decoded, so that it never shows half drawn. */
async function picture(src: string, parent: HTMLElement): Promise<HTMLImageElement> {
  const image = el('img', 'office-layer-image', parent);
  image.alt = '';
  image.decoding = 'async';
  image.src = src;
  // WebKit may refuse to decode a large picture ahead of time: it is then decoded when first drawn.
  await image.decode().catch(async () => {
    if (!image.complete)
      await new Promise((resolve) => {
        image.addEventListener('load', resolve, { once: true });
      });
  });
  return image;
}

export async function createLayersOffice(options: LayersOptions): Promise<OfficeScene> {
  const { frame, framing, moment, base } = options;
  const response = await fetch(`${base}/placement.json`);
  if (!response.ok) throw new Error(`office layers: placement ${String(response.status)}`);
  const all = (await response.json()) as Record<string, LayerMeta>;
  const meta = all[`${moment}-${framing}`];
  if (!meta) throw new Error(`office layers: no placement for ${moment}-${framing}`);

  // The pictures have a margin around the frame: in the frame's pixels, they start this far up and left.
  const mx = (meta.w - frame.w) / 2;
  const my = (meta.h - frame.h) / 2;
  const toFrame = ([x, y]: Point): Point => [x - mx, y - my];
  const toQuad = (quad: Quad): Quad => quad.map(toFrame) as unknown as Quad;
  const rest: Placement = {
    ...meta,
    horizon: meta.horizon - my,
    glow: toFrame(meta.glow),
    screen: toQuad(meta.screen),
    window: toQuad(meta.window),
    bulb: toFrame(meta.bulb),
    sun: meta.sun && [meta.sun[0] - mx, meta.sun[1] - my, meta.sun[2]],
    pictures: meta.pictures.map((p) => ({ ...p, corners: toQuad(p.corners) })),
  };

  const root = el('div', 'office-frame office-layers');
  Object.assign(root.style, { width: px(frame.w), height: px(frame.h) });
  const layer = (name: string): HTMLElement => {
    const node = el('div', `office-layer office-layers-${name}`, root);
    node.setAttribute('aria-hidden', 'true');
    return node;
  };
  const city = layer('city');
  const room = layer('room');
  const desk = layer('desk');
  const src = (name: string): string => `${base}/${moment}-${framing}-${name}.webp`;
  const images = await Promise.all([
    picture(src('city'), city),
    picture(src('room'), room),
    picture(src('desk'), desk),
  ]);
  images.forEach((image) => {
    Object.assign(image.style, { left: px(-mx), top: px(-my), width: px(meta.w), height: px(meta.h) });
  });

  // The halos, in screen blending over their layer: the setting sun's in the town, the lamp's on the wall.
  if (rest.sun) {
    const [x, y, r] = rest.sun;
    const halo = el('div', 'office-round office-sun-halo', city);
    Object.assign(halo.style, { left: px(x - r * 7), top: px(y - r * 7), width: px(r * 14), height: px(r * 14) });
  }
  const lampD = 340;
  const lamp = el('div', 'office-round office-lamp-halo', desk);
  Object.assign(lamp.style, {
    left: px(rest.bulb[0] - lampD / 2),
    top: px(rest.bulb[1] - lampD / 2),
    width: px(lampD),
    height: px(lampD),
  });

  // The pictures, on the white faces of their frames, which multiply them as paper would take the light.
  const faces = new Map<string, { image: HTMLImageElement; ratio: number }>();
  for (const face of rest.pictures) {
    const image = el('img', 'office-layer-picture', face.id === 'desk' ? desk : room);
    image.alt = '';
    image.decoding = 'async';
    // Laid out at twice its height on the wall, then squeezed onto it: the browser draws a picture in a 3D transform
    // at its laid out size, so one laid out smaller than shown, as the tall poster was at 200 px, shows its pixels.
    const [tl, tr, br, bl] = face.corners;
    const h = Math.round(
      2 * Math.max(Math.hypot(bl[0] - tl[0], bl[1] - tl[1]), Math.hypot(br[0] - tr[0], br[1] - tr[1])),
    );
    const w = Math.round(h * face.ratio);
    Object.assign(image.style, { width: px(w), height: px(h), transform: quadMatrix(w, h, face.corners) });
    image.hidden = true;
    faces.set(face.id, { image, ratio: face.ratio });
  }

  const axis = frame.axis;
  const ox = framing === 'mobile' ? axis[0] : rest.glow[0];
  const oy = rest.horizon;
  city.style.transformOrigin = `${px(ox)} ${px(oy)}`;
  room.style.transformOrigin = `${px(axis[0])} ${px(axis[1])}`;
  desk.style.transformOrigin = `${px(axis[0])} ${px(axis[1])}`;

  return {
    element: root,
    rest,
    draw(state: ArrivalState, head: Head): Drawn {
      const s = 4.67 / (state.camZ + 4.67);
      const par = frame.par;
      city.style.transform = `translate(${px(-head.x * par.city[0])}, ${px(state.tiltY - head.y * par.city[1])}) scale(${s.toFixed(5)})`;
      const opacity = { room: layerFade(state.camZ, FADE_PLANES.room), desk: layerFade(state.camZ, FADE_PLANES.desk) };
      const sRoom = layerScale(state.camZ, -1.2);
      const sDesk = layerScale(state.camZ, -0.85);
      room.style.transform = `translate(${px(-head.x * par.room[0])}, ${px(-head.y * par.room[1])}) scale(${sRoom.toFixed(5)})`;
      room.style.opacity = opacity.room.toFixed(3);
      room.style.visibility = opacity.room > 0.002 ? 'visible' : 'hidden';
      desk.style.transform = `translate(${px(-head.x * par.desk[0])}, ${px(-head.y * par.desk[1])}) scale(${sDesk.toFixed(5)})`;
      desk.style.opacity = opacity.desk.toFixed(3);
      desk.style.visibility = opacity.desk > 0.002 ? 'visible' : 'hidden';
      // The screen goes where the desk takes it.
      const onDesk = ([x, y]: Point): Point => [
        axis[0] + sDesk * (x - axis[0]) - head.x * par.desk[0],
        axis[1] + sDesk * (y - axis[1]) - head.y * par.desk[1],
      ];
      const placement: Placement = { ...rest, screen: rest.screen.map(onDesk) as unknown as Quad };
      return { placement, screenShown: opacity.desk > 0.002, opacity, sun: null };
    },
    resize(_width: number, _height: number, fit: Fit) {
      root.style.transform = `translate(${px(fit.x)}, ${px(fit.y)}) scale(${fit.k.toFixed(5)})`;
    },
    setPictures(pictures: ReadonlyMap<string, PictureSource>, loaded: () => void) {
      for (const [id, source] of pictures) {
        const face = faces.get(id);
        if (!face) continue;
        face.image.src = source.src;
        face.image.style.objectPosition = `${String(source.focus[0])}% ${String(source.focus[1])}%`;
        face.image.hidden = false;
        face.image.addEventListener('load', loaded, { once: true });
      }
    },
    dispose() {
      root.remove();
    },
  };
}

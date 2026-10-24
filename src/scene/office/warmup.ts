/**
 * Preparing the live office (plan step 7), from the middle of the journey on, or at once on `#contact`: the town is
 * built in the geometry worker while the rose comes from the planet's model, then the scene is assembled, its shaders
 * compiled without blocking the page, its textures and shadow maps uploaded by one draw, out of sight. What the HTML
 * needs (the screen's picture and the pictures) comes from the contact section's data attributes. Its layers, the
 * fallback, are prepared the same way: their pictures loaded and decoded before they show.
 */
import { loadPlanetModel } from '../planet/load';
import { drawsInSoftware } from '../quality';
import type { Moment } from '../time';
import { runGeometry } from '../workers/client';
import { breathe } from './common';
import { FRAMES, framingOf } from './frame';
import { createLayersOffice } from './layers';
import { createLiveOffice, type OfficeScene } from './live';
import { createOfficeView, type OfficeView } from './view';
import type { Cartel, WallPicture } from './wall';

/** Thrown when the device draws WebGL in software: the office stays an image. */
export class SlowOffice extends Error {}

export interface OfficeOptions {
  modelUrl: string;
  moment: Moment;
  still: boolean;
  /** Prepare it even on a software renderer (`?office=live`). */
  forced: boolean;
}

interface PictureData {
  src: string;
  focus?: string;
  cartel?: Cartel;
}

const focusOf = (focus: string | undefined): [number, number] => {
  const [x = 50, y = 50] = (focus ?? '50% 50%').split(' ').map((part) => parseFloat(part));
  return [x, y];
};

export async function prepareOffice(
  section: HTMLElement,
  host: HTMLElement,
  options: OfficeOptions,
): Promise<OfficeView> {
  if (!options.forced && drawsInSoftware()) throw new SlowOffice();
  const framing = framingOf(section.clientWidth);
  const [reply, model] = await Promise.all([runGeometry({ kind: 'town' }), loadPlanetModel(options.modelUrl)]);
  const live = await createLiveOffice({
    moment: options.moment,
    framing,
    frame: FRAMES[framing],
    town: reply.town,
    rose: model.rose,
  });
  return viewOf(section, host, live, options);
}

/** The layers instead of the live scene: no WebGL, the same arrival in CSS. */
export async function prepareLayers(
  section: HTMLElement,
  host: HTMLElement,
  options: Pick<OfficeOptions, 'moment' | 'still'>,
): Promise<OfficeView> {
  const framing = framingOf(section.clientWidth);
  const layers = await createLayersOffice({
    moment: options.moment,
    framing,
    frame: FRAMES[framing],
    base: host.dataset.layers ?? '',
  });
  return viewOf(section, host, layers, options);
}

async function viewOf(
  section: HTMLElement,
  host: HTMLElement,
  scene: OfficeScene,
  options: Pick<OfficeOptions, 'moment' | 'still'>,
): Promise<OfficeView> {
  // In a task of its own: a promise (a picture's decoding, a shader's compiling) can settle during a frame, and laying
  // the view in the page reads its size, which would force a layout in the middle of that frame.
  await new Promise((resolve) => setTimeout(resolve));
  const framing = framingOf(section.clientWidth);
  const pools = new Map<string, WallPicture[]>(
    Object.entries(JSON.parse(host.dataset.pictures ?? '{}') as Record<string, PictureData[]>).map(([frame, pool]) => [
      frame,
      pool.map((picture) => ({ src: picture.src, focus: focusOf(picture.focus), cartel: picture.cartel ?? null })),
    ]),
  );
  const view = createOfficeView(host, scene, {
    moment: options.moment,
    framing,
    still: options.still,
    screen: host.querySelector<HTMLTemplateElement>('template[data-screen-template]'),
    links: host.closest('section') ?? section,
    locale: document.documentElement.lang,
    pools,
    planetName: 'B 612',
  });
  // One draw at rest, out of sight: textures, shadow maps and buffers go to the GPU now, not on the way in; each draw
  // in a task of its own, between two frames.
  await breathe();
  view.update(1, performance.now(), 16);
  await breathe();
  view.update(0, performance.now(), 16);
  await breathe();
  // The page's style and layout settled now, in this task: left for the next frame, the journey's first read there
  // (the glide's scroll) would have to do it in the middle of that frame.
  section.getBoundingClientRect();
  return view;
}

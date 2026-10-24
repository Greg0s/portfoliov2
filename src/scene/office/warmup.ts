/**
 * Preparing the live office (plan step 7), from the middle of the journey on, or at once on `#contact`: the town is
 * built in the geometry worker while the rose comes from the planet's model, then the scene is assembled, its shaders
 * compiled without blocking the page, its textures and shadow maps uploaded by one draw, out of sight. What the HTML
 * needs (the screen's picture and the pictures) comes from the contact section's data attributes.
 */
import { draw as drawPictures } from '../../lib/wall';
import { loadPlanetModel } from '../planet/load';
import { drawsInSoftware } from '../quality';
import type { Moment } from '../time';
import { runGeometry } from '../workers/client';
import { FRAMES, framingOf } from './frame';
import { createLiveOffice, type PictureSource } from './live';
import { createOfficeView, type OfficeView } from './view';

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
  const pools = new Map<string, PictureData[]>(
    Object.entries(JSON.parse(host.dataset.pictures ?? '{}') as Record<string, PictureData[]>),
  );
  const pictures = new Map<string, PictureSource>(
    [...drawPictures(pools)].map(([frame, picture]) => [frame, { src: picture.src, focus: focusOf(picture.focus) }]),
  );
  const view = createOfficeView(host, live, {
    moment: options.moment,
    framing,
    still: options.still,
    screen: host.dataset.screen ?? '',
    pictures,
    planetName: 'B 612',
  });
  // One draw at rest, out of sight: textures, shadow maps and buffers go to the GPU now, not on the way in.
  view.update(1, performance.now(), 16);
  view.update(0, performance.now(), 16);
  return view;
}

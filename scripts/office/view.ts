/**
 * Shows the live office at a given point of its arrival, for comparisons with the mockup and checks of the arrival
 * frame by frame. Query: moment, scene (live or layers). `__show(e, hx, hy)` draws the arrival at `e` (0 to 1), the head
 * leaning by (hx, hy).
 */
import '../../src/styles/office.css';
import { createLayersOffice } from '../../src/scene/office/layers';
import { createLiveOffice, type OfficeScene } from '../../src/scene/office/live';
import { FRAMES, framingOf } from '../../src/scene/office/frame';
import { createOfficeView } from '../../src/scene/office/view';
import { buildTownGeometry } from '../../src/scene/office/town';
import { loadPlanetModel } from '../../src/scene/planet/load';
import type { Moment } from '../../src/scene/time';

declare global {
  interface Window {
    __ready?: boolean;
    __error?: string;
    __show?: (e: number, hx?: number, hy?: number) => void;
  }
}

const q = new URLSearchParams(location.search);
const moment = (q.get('moment') ?? 'crepuscule') as Moment;

async function main(): Promise<void> {
  const host = document.querySelector<HTMLElement>('.office');
  if (!host) return;
  const framing = framingOf(host.clientWidth);
  const live: OfficeScene =
    q.get('scene') === 'layers'
      ? await createLayersOffice({ moment, framing, frame: FRAMES[framing], base: '/images/office/layers' })
      : await createLiveOffice({
          moment,
          framing,
          frame: FRAMES[framing],
          town: buildTownGeometry(),
          rose: (await loadPlanetModel('/models/petit-prince.glb')).rose,
        });
  const view = createOfficeView(host, live, {
    moment,
    framing,
    still: true,
    screen: null,
    links: document,
    locale: 'fr',
    pools: new Map(),
    planetName: 'B 612',
  });
  window.__show = (e, hx = 0, hy = 0) => {
    view.setHead(hx, hy);
    view.update(e, performance.now(), 16);
  };
  window.__ready = true;
}

main().catch((error: unknown) => {
  window.__error = String(error);
  window.__ready = true;
});

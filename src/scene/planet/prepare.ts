/**
 * What the live planet needs before Three.js: its model's bytes and its relief. The journey asks for both as soon as it
 * knows the device has a GPU, so that they download and build while Three.js and the planet's code still load, rather
 * than one after the other: the arrival waits for the planet in the dark (Grégoire, 16 November 2026). Without
 * Three.js in it, this module rides with the journey's own code.
 */
import { startPlanetRelief, type PlanetRelief, type ReplyTo } from '../workers/client';
import type { Calm } from '../workers/relief';

/** The model's bytes, downloaded once per page: the planet put together again after the office reads them again. */
let model: { url: string; data: Promise<ArrayBuffer> } | null = null;

export function modelData(url: string): Promise<ArrayBuffer> {
  if (model?.url !== url) {
    const data = fetch(url).then((response) => {
      if (!response.ok) throw new Error(`The planet model answered ${String(response.status)}.`);
      return response.arrayBuffer();
    });
    const asked = { url, data };
    model = asked;
    // A failed download is tried again by the next planet.
    data.catch(() => {
      if (model === asked) model = null;
    });
  }
  return model.data;
}

/** The relief's detail: the planet's icosphere, finer on a computer, and the hair's. */
const detailOf = (mobile: boolean): { detail: number; hairDetail: number } => ({
  detail: mobile ? 72 : 110,
  hairDetail: 64,
});
const keyOf = (mobile: boolean): string => {
  const { detail, hairDetail } = detailOf(mobile);
  return `${String(detail)}/${String(hairDetail)}`;
};

/** The relief, built once per visit and kept for a planet built again after the office. */
const reliefs = new Map<string, Promise<ReplyTo<'planet'>>>();
/** A relief whose surface is building, waiting for the model's calm places. */
let started: { key: string; relief: PlanetRelief } | null = null;

/** Starts building the relief's surface, unless it is built or under way. */
export function startRelief(mobile: boolean): void {
  const key = keyOf(mobile);
  if (reliefs.has(key) || started?.key === key) return;
  started?.relief.cancel();
  const { detail, hairDetail } = detailOf(mobile);
  started = { key, relief: startPlanetRelief(detail, hairDetail) };
}

/** The relief, shaped by the model's calm places: the one started ahead, or built now. */
export function reliefFor(mobile: boolean, calm: Calm[]): Promise<ReplyTo<'planet'>> {
  const key = keyOf(mobile);
  let relief = reliefs.get(key);
  if (!relief) {
    startRelief(mobile);
    relief = (started as { relief: PlanetRelief }).relief.shape(calm);
    started = null;
    reliefs.set(key, relief);
    relief.catch(() => reliefs.delete(key));
  }
  return relief;
}

/** Lets a relief started ahead go: the planet was given up before it needed it. */
export function cancelRelief(): void {
  started?.relief.cancel();
  started = null;
}

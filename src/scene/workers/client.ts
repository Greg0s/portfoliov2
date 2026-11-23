/**
 * Runs the planet's requests in a fresh worker, ending once it has replied: its relief, without Three.js, small enough
 * to download beside the model. (The office's town is built at build time now, in its layers.)
 */
import type { PlanetReply, PlanetRequest } from './planet.worker';
import type { Calm } from './relief';

type GeometryReply = PlanetReply;
export type ReplyTo<K extends GeometryReply['kind']> = Extract<GeometryReply, { kind: K }>;

function listen<R>(worker: Worker): Promise<R> {
  return new Promise<R>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<R>) => {
      resolve(event.data);
      worker.terminate();
    };
    worker.onerror = (event) => {
      reject(new Error(event.message));
      worker.terminate();
    };
  });
}

/** A planet's relief under way: its surface builds at once, its shape once the model's calm places are known. */
export interface PlanetRelief {
  shape(calm: Calm[]): Promise<PlanetReply>;
  /** Lets the worker go, the planet given up before its shape. */
  cancel(): void;
}

export function startPlanetRelief(detail: number, hairDetail: number): PlanetRelief {
  const worker = new Worker(new URL('./planet.worker.ts', import.meta.url), { type: 'module' });
  const reply = listen<PlanetReply>(worker);
  const heights: PlanetRequest = { kind: 'planet-heights', detail, hairDetail };
  worker.postMessage(heights);
  return {
    shape(calm) {
      const request: PlanetRequest = { kind: 'planet-shape', calm };
      worker.postMessage(request);
      return reply;
    },
    cancel() {
      worker.terminate();
    },
  };
}

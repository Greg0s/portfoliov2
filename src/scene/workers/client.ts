/** Runs requests in a fresh geometry worker, which ends once it has replied. */
import type { GeometryReply, GeometryRequest } from './geometry.worker';
import type { Calm } from './relief';

export type ReplyTo<K extends GeometryReply['kind']> = Extract<GeometryReply, { kind: K }>;

function geometryWorker<K extends GeometryReply['kind']>(): {
  worker: Worker;
  reply: Promise<ReplyTo<K>>;
} {
  const worker = new Worker(new URL('./geometry.worker.ts', import.meta.url), { type: 'module' });
  const reply = new Promise<ReplyTo<K>>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<ReplyTo<K>>) => {
      resolve(event.data);
      worker.terminate();
    };
    worker.onerror = (event) => {
      reject(new Error(event.message));
      worker.terminate();
    };
  });
  return { worker, reply };
}

/** Builds the office's town. */
export function runTown(): Promise<ReplyTo<'town'>> {
  const { worker, reply } = geometryWorker<'town'>();
  const request: GeometryRequest = { kind: 'town' };
  worker.postMessage(request);
  return reply;
}

/** A planet's relief under way: its surface builds at once, its shape once the model's calm places are known. */
export interface PlanetRelief {
  shape(calm: Calm[]): Promise<ReplyTo<'planet'>>;
  /** Lets the worker go, the planet given up before its shape. */
  cancel(): void;
}

export function startPlanetRelief(detail: number, hairDetail: number): PlanetRelief {
  const { worker, reply } = geometryWorker<'planet'>();
  const heights: GeometryRequest = { kind: 'planet-heights', detail, hairDetail };
  worker.postMessage(heights);
  return {
    shape(calm) {
      const request: GeometryRequest = { kind: 'planet-shape', calm };
      worker.postMessage(request);
      return reply;
    },
    cancel() {
      worker.terminate();
    },
  };
}

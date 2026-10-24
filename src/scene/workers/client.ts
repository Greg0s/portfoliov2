/** Runs one request in a fresh geometry worker, which ends once it has replied. */
import type { GeometryReply, GeometryRequest } from './geometry.worker';

export type ReplyTo<K extends GeometryRequest['kind']> = Extract<GeometryReply, { kind: K }>;

export function runGeometry<K extends GeometryRequest['kind']>(
  request: Extract<GeometryRequest, { kind: K }>,
): Promise<ReplyTo<K>> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./geometry.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<ReplyTo<K>>) => {
      resolve(event.data);
      worker.terminate();
    };
    worker.onerror = (event) => {
      reject(new Error(event.message));
      worker.terminate();
    };
    worker.postMessage(request);
  });
}

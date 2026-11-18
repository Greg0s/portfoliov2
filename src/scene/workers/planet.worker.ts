/**
 * The planet's worker (implementation plan §2.4): builds the planet's relief and the hair off the main thread, and
 * sends them back as transferable arrays. Without Three.js (`relief.ts`), it downloads in a moment beside the model.
 *
 * The planet comes in two requests: `planet-heights` builds the surface and the hair as soon as the live planet is
 * asked for, while its model downloads; `planet-shape` brings the calm places the model gives and gets the planet back.
 */
import { crumpledBall, planetHeights, shapePlanet, type Arrays, type Calm, type PlanetHeights } from './relief';

export type PlanetRequest =
  { kind: 'planet-heights'; detail: number; hairDetail: number } | { kind: 'planet-shape'; calm: Calm[] };

export interface PlanetReply {
  kind: 'planet';
  planet: Arrays;
  hair: Arrays;
}

const transfers = (arrays: Arrays): ArrayBuffer[] => [
  arrays.position.buffer as ArrayBuffer,
  arrays.normal.buffer as ArrayBuffer,
  arrays.index.buffer as ArrayBuffer,
];

/** The planet's surface and hair, built ahead of its shape. */
let built: { heights: PlanetHeights; hair: Arrays } | null = null;

self.onmessage = (event: MessageEvent<PlanetRequest>) => {
  const request = event.data;
  if (request.kind === 'planet-heights') {
    built = { heights: planetHeights(request.detail), hair: crumpledBall(request.hairDetail) };
    return;
  }
  // Messages come in order: the heights asked for first are built by now.
  if (!built) throw new Error('The planet was shaped before its heights were asked for.');
  const planet = shapePlanet(built.heights, request.calm);
  const hair = built.hair;
  built = null;
  const reply: PlanetReply = { kind: 'planet', planet, hair };
  self.postMessage(reply, { transfer: [...transfers(planet), ...transfers(hair)] });
};

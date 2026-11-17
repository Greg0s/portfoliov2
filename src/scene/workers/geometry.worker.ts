/**
 * The geometry worker (implementation plan §2.4): builds the planet's relief and the hair and the office's town off
 * the main thread, and sends them back as transferable arrays.
 *
 * The planet comes in two requests: `planet-heights` builds the surface and the hair as soon as the live planet is
 * asked for, while its model downloads; `planet-shape` brings the calm places the model gives and gets the planet back.
 */
import { crumpledBall, planetHeights, shapePlanet, type Arrays, type Calm, type PlanetHeights } from './relief';
import { buildTownGeometry, packedBuffers, TOWN_PARTS, type TownGeometry } from '../office/town';

export type GeometryRequest =
  | { kind: 'planet-heights'; detail: number; hairDetail: number }
  | { kind: 'planet-shape'; calm: Calm[] }
  | { kind: 'town' };

export type GeometryReply =
  | {
      kind: 'planet';
      planet: Arrays;
      hair: Arrays;
    }
  | { kind: 'town'; town: TownGeometry };

const transfers = (arrays: Arrays): ArrayBuffer[] => [
  arrays.position.buffer as ArrayBuffer,
  arrays.normal.buffer as ArrayBuffer,
  arrays.index.buffer as ArrayBuffer,
];

/** The planet's surface and hair, built ahead of its shape. */
let built: { heights: PlanetHeights; hair: Arrays } | null = null;

self.onmessage = (event: MessageEvent<GeometryRequest>) => {
  const request = event.data;
  if (request.kind === 'town') {
    const town = buildTownGeometry();
    const reply: GeometryReply = { kind: 'town', town };
    self.postMessage(reply, { transfer: TOWN_PARTS.flatMap((part) => packedBuffers(town.parts[part])) });
    return;
  }
  if (request.kind === 'planet-heights') {
    built = { heights: planetHeights(request.detail), hair: crumpledBall(request.hairDetail) };
    return;
  }
  // Messages come in order: the heights asked for first are built by now.
  if (!built) throw new Error('The planet was shaped before its heights were asked for.');
  const planet = shapePlanet(built.heights, request.calm);
  const hair = built.hair;
  built = null;
  const reply: GeometryReply = { kind: 'planet', planet, hair };
  self.postMessage(reply, { transfer: [...transfers(planet), ...transfers(hair)] });
};

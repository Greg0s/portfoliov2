/**
 * The geometry worker (implementation plan §2.4): builds the planet's relief and the hair (1 to 1.9 s on a Pixel 9)
 * and the office's town off the main thread, and sends them back as transferable arrays.
 */
import { craterPlanet, crumpledBall, type Arrays, type Calm } from './relief';
import { buildTownGeometry, packedBuffers, TOWN_PARTS, type TownGeometry } from '../office/town';

export type GeometryRequest =
  | {
      kind: 'planet';
      detail: number;
      hairDetail: number;
      calm: Calm[];
    }
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

self.onmessage = (event: MessageEvent<GeometryRequest>) => {
  const request = event.data;
  if (request.kind === 'town') {
    const town = buildTownGeometry();
    const reply: GeometryReply = { kind: 'town', town };
    self.postMessage(reply, { transfer: TOWN_PARTS.flatMap((part) => packedBuffers(town.parts[part])) });
    return;
  }
  const planet = craterPlanet(request.detail, request.calm);
  const hair = crumpledBall(request.hairDetail);
  const reply: GeometryReply = { kind: 'planet', planet, hair };
  self.postMessage(reply, { transfer: [...transfers(planet), ...transfers(hair)] });
};

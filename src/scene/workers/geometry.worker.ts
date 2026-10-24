/**
 * The geometry worker (implementation plan §2.4): builds the planet's relief and the hair off the main thread (1 to
 * 1.9 s on a Pixel 9) and sends them back as transferable arrays. The office's town joins it with the live office.
 */
import { craterPlanet, crumpledBall, type Arrays, type Calm } from './relief';

export interface GeometryRequest {
  kind: 'planet';
  detail: number;
  hairDetail: number;
  calm: Calm[];
}

export interface GeometryReply {
  kind: 'planet';
  planet: Arrays;
  hair: Arrays;
}

const transfers = (arrays: Arrays): ArrayBuffer[] => [
  arrays.position.buffer as ArrayBuffer,
  arrays.normal.buffer as ArrayBuffer,
  arrays.index.buffer as ArrayBuffer,
];

self.onmessage = (event: MessageEvent<GeometryRequest>) => {
  const request = event.data;
  const planet = craterPlanet(request.detail, request.calm);
  const hair = crumpledBall(request.hairDetail);
  const reply: GeometryReply = { kind: 'planet', planet, hair };
  self.postMessage(reply, { transfer: [...transfers(planet), ...transfers(hair)] });
};

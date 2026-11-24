/**
 * The town's worker (implementation plan §2.4): builds the office's town off the main thread, with Three.js's
 * geometries, and sends it back as transferable arrays.
 */
import { buildTownGeometry, packedBuffers, TOWN_PARTS, type TownGeometry } from '../office/town';

export interface TownReply {
  kind: 'town';
  town: TownGeometry;
}

self.onmessage = () => {
  const town = buildTownGeometry();
  const reply: TownReply = { kind: 'town', town };
  self.postMessage(reply, { transfer: TOWN_PARTS.flatMap((part) => packedBuffers(town.parts[part])) });
};

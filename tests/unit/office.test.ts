import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { arrivalState, layerFade } from '../../src/scene/office/arrival';
import { FRAMES } from '../../src/scene/office/frame';
import { buildTownGeometry, TOWN_PARTS, type TownGeometry } from '../../src/scene/office/town';
import { squareToQuad, type Quad } from '../../src/lib/quad';

const hash = (town: TownGeometry): string => {
  const sha = createHash('sha256');
  for (const part of TOWN_PARTS) {
    const geometry = town.parts[part];
    for (const attribute of Object.values(geometry.attributes)) sha.update(new Uint8Array(attribute.array.buffer));
    if (geometry.index) sha.update(new Uint8Array(geometry.index.buffer));
  }
  return sha.digest('hex');
};

describe('the town', () => {
  it('is the same town from one build to the next', () => {
    expect(hash(buildTownGeometry())).toBe(hash(buildTownGeometry()));
  });
});

describe('the quad', () => {
  it('maps the unit square onto the four corners', () => {
    const quad: Quad = [
      [980, 272],
      [1579, 252],
      [1559, 612],
      [976, 595],
    ];
    const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0, g = 0, h = 0] = squareToQuad(quad);
    const map = (u: number, v: number): [number, number] => {
      const w = g * u + h * v + 1;
      return [(a * u + b * v + c) / w, (d * u + e * v + f) / w];
    };
    [map(0, 0), map(1, 0), map(1, 1), map(0, 1)].forEach(([x, y], i) => {
      expect(x).toBeCloseTo(quad[i]?.[0] ?? NaN, 6);
      expect(y).toBeCloseTo(quad[i]?.[1] ?? NaN, 6);
    });
  });
});

describe('the arrival', () => {
  const frame = FRAMES.desktop;

  it('starts in the jump, out by the window, and ends seated with the text shown', () => {
    const start = arrivalState(0.1, frame, false, false);
    expect(start.jump.on).toBe(true);
    expect(start.cityOp).toBe(0);
    expect(start.camZ).toBeCloseTo(-1.75);
    const end = arrivalState(1, frame, false, false);
    expect(end.jump.on).toBe(false);
    expect(end.camZ).toBeCloseTo(0, 9);
    expect(end.tiltY).toBe(0);
    expect(end.textK).toBe(1);
  });

  it('backs the camera to the seat without ever going forward', () => {
    let previous = -Infinity;
    for (let e = 0; e <= 1; e += 0.01) {
      const { camZ } = arrivalState(e, frame, false, false);
      expect(camZ).toBeGreaterThanOrEqual(previous);
      previous = camZ;
    }
  });

  it('fades the room and the desk in as the camera leaves their planes', () => {
    expect(layerFade(-1.75, -1.2)).toBe(0);
    expect(layerFade(-0.9, -0.85)).toBe(0);
    expect(layerFade(0, -1.2)).toBe(1);
    expect(layerFade(0, -0.85)).toBe(1);
  });

  it('with reduced motion, has no jump and no move', () => {
    const calm = arrivalState(0.5, frame, true, false);
    expect(calm.jump.on).toBe(false);
    expect(calm.camZ).toBeCloseTo(0, 9);
    expect(calm.fadeOp).toBeGreaterThan(0);
  });
});

describe('the layers', () => {
  const placement = JSON.parse(readFileSync('public/images/office/layers/placement.json', 'utf8')) as Record<
    string,
    { w: number; h: number; sun: number[] | null; screen: number[][] }
  >;

  it('are placed for every moment and framing', () => {
    for (const moment of ['aube', 'crepuscule']) {
      for (const framing of ['desktop', 'mobile'] as const) {
        const meta = placement[`${moment}-${framing}`];
        expect(meta).toBeDefined();
        if (!meta) continue;
        // The frame and its margin of 4 % on each side.
        expect(meta.w).toBe(Math.round(FRAMES[framing].w * 1.08));
        expect(meta.h).toBe(Math.round(FRAMES[framing].h * 1.08));
        expect(meta.screen).toHaveLength(4);
        // The setting sun only at dusk.
        expect(meta.sun === null).toBe(moment === 'aube');
      }
    }
  });
});

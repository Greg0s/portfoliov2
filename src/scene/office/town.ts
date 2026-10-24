/**
 * The town seen through the window (office spec §3), as pure geometry: the geometry worker builds it off the main
 * thread and sends it back as arrays. The flat is near the top of a hill, 80 m above the town. A river crosses the view
 * diagonally, from the bottom of the window toward the right; beyond it the town, gently rolling, recedes to hills on
 * several planes (Lyon, loosely). Every random draw comes from one rng(2024) sequence, in the prototype's order, so the
 * town is the one of the layers.
 */
import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  Matrix4,
  SphereGeometry,
  Vector2,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { colorize, DEG, rng, smoothstep } from './common';

export const CITY = {
  land: -80,
  water: -86.5,
  hill: { top: -21, flat: 18, foot: 150 },
  river: { from: [-40, -330], to: [600, -1300], half: 45 },
} as const;

/** The river's frame on the ground: u runs along it, v across it, positive on the far bank. */
const R0 = new Vector2(...CITY.river.from);
export const ALONG = new Vector2(...CITY.river.to).sub(R0).normalize();
export const ACROSS = new Vector2(ALONG.y, -ALONG.x);
if (ACROSS.dot(R0) < 0) ACROSS.negate();
export const HALF = CITY.river.half;
export const RIVER_TURN = Math.atan2(-ALONG.y, ALONG.x);
export const at = (u: number, v: number): Vector2 => R0.clone().addScaledVector(ALONG, u).addScaledVector(ACROSS, v);
export const acrossOf = (p: Vector2): number => p.clone().sub(R0).dot(ACROSS);
/** A point of the ground at an azimuth (degrees, positive to the right) and a distance from the camera. */
export const polar = (az: number, d: number): Vector2 => new Vector2(Math.sin(az * DEG) * d, -Math.cos(az * DEG) * d);

/** Height of the ground on our hill, by distance from the camera. */
export function hillY(d: number): number {
  const { top, flat, foot } = CITY.hill;
  return d <= flat ? top : d >= foot ? CITY.land : top + ((d - flat) / (foot - flat)) * (CITY.land - top);
}

const FACADES = [0xece0c8, 0xe6c79c, 0xe9bba4, 0xdccbb5, 0xd2bb9f, 0xf1e5d0, 0xe3d2b0, 0xd9b48f];
const TILES = [0xa06a58, 0x94614f, 0xaa7563, 0x8b5b4c, 0xa2705d];
const OLD_FACADES = [
  0xefdcbc, 0xe8c393, 0xe2a77f, 0xd99c84, 0xf1e3c8, 0xd8b088, 0xeacca2, 0xcf9673, 0xe6d2b0, 0xdcb59a, 0xe9b98d,
  0xd7a07a,
];
const HOUSE_FACADES = [0xf0e6d4, 0xe8d6b8, 0xeedcc4, 0xe2c8a6, 0xf2e9dc];
const BLOCK_FACADES = [0xe6ddd0, 0xd8d2c8, 0xe0d4c0, 0xcfc8bd, 0xe9e2d6];
const OLD_TILES = [0xa8644e, 0x96553f, 0xb0725a, 0x8c5141, 0x9e6a58, 0x7f4a3d, 0xb47a5f];
const ZINC = [0x7b828c, 0x6d747e, 0x858b93];

type Triple = [number, number, number];

/** A roof over a w × d footprint: hipped (a ridge along the longer side) or gabled (vertical triangular ends). */
function pitchedRoof(w: number, d: number, h: number, gable = false): BufferGeometry {
  const long = w >= d;
  const a = long ? w : d;
  const b = long ? d : w;
  const r = gable ? a / 2 : Math.max(0, (a - b) / 2);
  const P = (u: number, y: number, v: number): Triple => (long ? [u, y, v] : [v, y, u]);
  const c = [P(-a / 2, 0, -b / 2), P(a / 2, 0, -b / 2), P(a / 2, 0, b / 2), P(-a / 2, 0, b / 2)] as const;
  const r0 = P(-r, h, 0);
  const r1 = P(r, h, 0);
  const tris: [Triple, Triple, Triple][] = [
    [c[0], r0, r1],
    [c[0], r1, c[1]],
    [c[2], r1, r0],
    [c[2], r0, c[3]],
    [c[1], r1, c[2]],
    [c[3], r0, c[0]],
  ];
  const pos: number[] = [];
  // Swapping the axes mirrors the shape, so the winding is reversed to keep the faces pointing out.
  for (const [t0, t1, t2] of tris) pos.push(...t0, ...(long ? t1 : t2), ...(long ? t2 : t1));
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** Triangles turned so that each faces away from a point inside the solid. */
function outward(tris: [Triple, Triple, Triple][], inside: Vector3): BufferGeometry {
  const pos: number[] = [];
  const A = new Vector3();
  const B = new Vector3();
  const C = new Vector3();
  const n = new Vector3();
  const m = new Vector3();
  for (const [a, b, c] of tris) {
    A.fromArray(a);
    B.fromArray(b);
    C.fromArray(c);
    n.subVectors(B, A).cross(m.subVectors(C, A));
    const out = n.dot(A.add(B).add(C).divideScalar(3).sub(inside)) >= 0;
    pos.push(...a, ...(out ? b : c), ...(out ? c : b));
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** A mansard: steep slopes all around up to a flat top. */
function mansardRoof(w: number, d: number, h: number): BufferGeometry {
  const i = h * 0.38;
  const b: Triple[] = [
    [-w / 2, 0, -d / 2],
    [w / 2, 0, -d / 2],
    [w / 2, 0, d / 2],
    [-w / 2, 0, d / 2],
  ];
  const t = b.map(([x, , z]): Triple => [x - Math.sign(x) * i, h, z - Math.sign(z) * i]);
  const corner = (list: Triple[], k: number): Triple => list[k % 4] ?? [0, 0, 0];
  const tris: [Triple, Triple, Triple][] = [];
  for (let k = 0; k < 4; k += 1) {
    tris.push([corner(b, k), corner(b, k + 1), corner(t, k + 1)], [corner(b, k), corner(t, k + 1), corner(t, k)]);
  }
  tris.push([corner(t, 0), corner(t, 1), corner(t, 2)], [corner(t, 0), corner(t, 2), corner(t, 3)]);
  return outward(tris, new Vector3(0, h / 2, 0));
}

function bareRoof(g: BufferGeometry): BufferGeometry {
  const n = g.toNonIndexed();
  n.deleteAttribute('uv');
  return n;
}

function flatRoof(w: number, d: number): BufferGeometry {
  return bareRoof(new BoxGeometry(w + 0.3, 0.7, d + 0.3).translate(0, 0.35, 0));
}

type Roof = 'hip' | 'gable' | 'mansard' | 'flat';

interface Parts {
  walls: BufferGeometry[];
  roofs: BufferGeometry[];
  chimneys: BufferGeometry[];
  blocks: BufferGeometry[];
}

interface Building {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  y0: number;
  turn?: number;
  roof?: Roof;
  rh?: number | undefined;
  color?: number;
  tiles?: number;
  chimneys?: boolean;
  dormers?: number;
  into?: 'walls' | 'blocks';
}

function pickFrom(r: () => number, list: readonly number[]): number {
  return list[Math.floor(r() * list.length)] ?? 0;
}

/** One building: walls with a grid of windows in world units (a bay is 3.2 m, a floor 3 m), and its roof. */
function addBuilding(parts: Parts, r: () => number, b: Building): void {
  // The prototype draws the chimneys' chance first, as a default parameter.
  const chimneys = b.chimneys ?? r() < 0.55;
  const { x, z, w, d, h, y0, turn = 0, roof = 'hip', dormers = 0, into = 'walls' } = b;
  const place = new Matrix4().makeRotationY(turn).setPosition(x, y0, z);
  const walls = new BoxGeometry(w, h, d).translate(0, h / 2, 0);
  const pos = walls.getAttribute('position');
  const nrm = walls.getAttribute('normal');
  const uv = walls.getAttribute('uv');
  const ou = Math.floor(r() * 8) / 8;
  const ov = Math.floor(r() * 8) / 8;
  for (let i = 0; i < uv.count; i += 1) {
    const top = Math.abs(nrm.getY(i)) > 0.5;
    const along = Math.abs(nrm.getX(i)) > 0.5 ? pos.getZ(i) : pos.getX(i);
    uv.setXY(i, top ? 0 : along / 3.2 / 8 + ou, top ? 0 : pos.getY(i) / 3 / 8 + ov);
  }
  parts[into].push(colorize(walls, b.color ?? pickFrom(r, FACADES)).applyMatrix4(place));

  const rh = b.rh ?? (roof === 'flat' ? 0.7 : Math.min(w, d) * (0.18 + r() * 0.06));
  const roofGeo =
    roof === 'flat'
      ? flatRoof(w, d)
      : roof === 'mansard'
        ? mansardRoof(w * 1.04, d * 1.04, rh)
        : pitchedRoof(w * 1.05, d * 1.05, rh, roof === 'gable');
  roofGeo.translate(0, h, 0);
  parts.roofs.push(colorize(roofGeo, roof === 'flat' ? 0x8d8f95 : (b.tiles ?? pickFrom(r, TILES))).applyMatrix4(place));

  if (roof !== 'flat' && chimneys) {
    const n = 1 + Math.floor(r() * 3);
    for (let k = 0; k < n; k += 1) {
      const cx = (r() - 0.5) * w * 0.6;
      const cz = (r() - 0.5) * d * 0.3;
      const ch = new BoxGeometry(0.75, 1.9, 0.6).translate(cx, h + rh * 0.55 + 0.6, cz);
      parts.chimneys.push(ch.applyMatrix4(place));
    }
  }
  // Dormers on the slope that faces the camera (+z side of the footprint).
  for (let k = 0; k < dormers; k += 1) {
    const dx = (k - (dormers - 1) / 2) * (w / (dormers + 0.5));
    const dz = d * 0.24;
    const dy = h + rh * (1 - dz / (d * 0.525)) * 0.9;
    const body = new BoxGeometry(1.4, 1.6, 1.6).translate(dx, dy + 0.3, dz);
    const bu = body.getAttribute('uv');
    for (let i = 0; i < bu.count; i += 1) {
      bu.setXY(i, bu.getX(i) * (1.4 / 3.2 / 8) + 0.035, bu.getY(i) * (1.6 / 3 / 8) + 0.03);
    }
    parts.walls.push(colorize(body, 0xefe6d6).applyMatrix4(place));
    const cap = pitchedRoof(1.7, 1.9, 0.75, true).translate(dx, dy + 1.1, dz);
    parts.roofs.push(colorize(cap, 0x9d4a36).applyMatrix4(place));
  }
}

/** Smooth noise on the ground, between 0 and 1, with features about `scale` metres across. */
function valueNoise(seed: number, scale: number): (x: number, z: number) => number {
  const r = rng(seed);
  const N = 64;
  const grid = Array.from({ length: N * N }, () => r());
  const cell = (i: number, j: number): number => grid[(((i % N) + N) % N) + (((j % N) + N) % N) * N] ?? 0;
  return (x, z) => {
    const fx = x / scale;
    const fz = z / scale;
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const sx = smoothstep(0, 1, fx - i);
    const sz = smoothstep(0, 1, fz - j);
    const a = cell(i, j) + (cell(i + 1, j) - cell(i, j)) * sx;
    const b = cell(i, j + 1) + (cell(i + 1, j + 1) - cell(i, j + 1)) * sx;
    return a + (b - a) * sz;
  };
}

/**
 * The relief of the town, in metres above the plain: flat along the quays (and so at the foot of our hill and in the
 * park); on the far bank, two broad hills covered with houses whose crests stand out against the haze, small
 * undulations elsewhere, and the ground rising a little toward the hills on the horizon.
 */
const reliefNoise = valueNoise(41, 380);
const TOWN_HILLS = [
  { az: -10, d: 1500, r: 360, h: 46 },
  { az: 8, d: 1950, r: 460, h: 58 },
].map((k) => ({ ...k, p: polar(k.az, k.d) }));

export function relief(p: Vector2): number {
  const v = acrossOf(p);
  let h = 6 * smoothstep(0.35, 0.8, reliefNoise(p.x, p.y)) + (v > 0 ? 10 * smoothstep(1200, 2800, p.length()) : 0);
  for (const k of TOWN_HILLS) h += k.h * 0.5 * (1 + Math.cos(Math.PI * Math.min(1, p.distanceTo(k.p) / k.r)));
  return smoothstep(HALF + 160, HALF + 460, Math.abs(v)) * h;
}

/** The ground under a building turned along the river: the lowest point of its footprint, so that it never floats. */
export function footing(p: Vector2, w: number, d: number): number {
  let low = relief(p);
  for (const [a, b] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ] as const) {
    low = Math.min(
      low,
      relief(
        p
          .clone()
          .addScaledVector(ALONG, (a * w) / 2)
          .addScaledVector(ACROSS, (b * d) / 2),
      ),
    );
  }
  return low;
}

type InView = (p: Vector2, margin?: number) => boolean;
type Kind = 'old' | 'block' | 'house' | 'square';

/**
 * The town in districts: an old town of tall houses with tiled or zinc roofs, quieter streets of small houses, a few
 * modern blocks further away, small squares, and a park with a pond on the far quay. Everything sits on the relief.
 */
function buildTown(parts: Parts, r: () => number, inView: InView) {
  const district = valueNoise(13, 420);
  const pick = (list: readonly number[]): number => pickFrom(r, list);
  const tree = (x: number, z: number, s: number): BufferGeometry => {
    const p = new Vector2(x, z);
    return new IcosahedronGeometry(1, 1).scale(s, s * 1.12, s).translate(x, CITY.land + relief(p) + s, z);
  };
  const trees: BufferGeometry[] = [];
  const park = { u: [40, 180], v: [75, 245] } as const;
  const pond = { u: 112, v: 166, ru: 44, rv: 26 };
  const inPark = (p: Vector2): boolean => {
    const q = p.clone().sub(R0);
    const u = q.dot(ALONG);
    const v = q.dot(ACROSS);
    return u > park.u[0] - 6 && u < park.u[1] + 6 && v > park.v[0] - 6 && v < park.v[1] + 6;
  };

  const kindAt = (p: Vector2, row: number): Kind => {
    if (row === 0) return 'old';
    const n = district(p.x, p.y);
    const x = r();
    if (p.length() > 900 && x < 0.015 + 0.15 * smoothstep(0.56, 0.86, n)) return 'block';
    if (row > 1 && x < 0.5 * (1 - smoothstep(0.18, 0.44, n))) return 'house';
    if (x > 0.97) return 'square';
    return 'old';
  };
  const widthOf = (kind: Kind, row: number): number =>
    kind === 'block'
      ? 28 + r() * 22
      : kind === 'house'
        ? 7 + r() * 4
        : kind === 'square'
          ? 16 + r() * 10
          : (row === 0 ? 12 : 9) + r() * 10;
  const addKind = (kind: Kind, p: Vector2, w: number, depth: number, row: number): void => {
    if (inPark(p)) return;
    const y0 = CITY.land - 1 + footing(p, w, depth);
    const base = { x: p.x, z: p.y, w, d: depth, y0, turn: RIVER_TURN };
    const place = new Matrix4().makeRotationY(RIVER_TURN).setPosition(p.x, y0, p.y);
    if (kind === 'block') {
      const h = 21 + Math.floor(r() * 5) * 3;
      addBuilding(parts, r, { ...base, h, roof: 'flat', color: pick(BLOCK_FACADES), into: 'blocks' });
      const rx = (r() - 0.5) * w * 0.5;
      const rz = (r() - 0.5) * depth * 0.3;
      const room = bareRoof(new BoxGeometry(6, 2.6, 4.5)).translate(rx, h + 2, rz);
      parts.roofs.push(colorize(room, 0x9a9ca2).applyMatrix4(place));
    } else if (kind === 'house') {
      const h = 6.5 + r() * 3.5;
      const roof = r() < 0.6 ? 'gable' : 'hip';
      addBuilding(parts, r, { ...base, d: depth * 0.7, h, roof, color: pick(HOUSE_FACADES), tiles: pick(OLD_TILES) });
      if (r() < 0.5) {
        const g = new Vector3(w / 2 + 1.5, 0, depth * 0.3).applyMatrix4(place);
        trees.push(tree(g.x, g.z, 2.2 + r() * 1.4));
      }
    } else if (kind === 'square') {
      for (let k = 0; k < 3; k += 1) {
        const gx = (r() - 0.5) * w * 0.7;
        const gz = (r() - 0.5) * depth * 0.6;
        const g = new Vector3(gx, 0, gz).applyMatrix4(place);
        trees.push(tree(g.x, g.z, 2.4 + r() * 1.6));
      }
    } else {
      const n = district(p.x, p.y);
      const x = r();
      const roof: Roof =
        row === 0
          ? x < 0.55
            ? 'hip'
            : 'mansard'
          : x < 0.5
            ? 'hip'
            : x < 0.78
              ? 'mansard'
              : x < 0.92
                ? 'gable'
                : 'flat';
      const zinc = roof === 'mansard';
      // The order of the draws follows the prototype's object literal.
      const h = (row === 0 ? 15 : 11) + r() * 6 + n * 5;
      const rh = zinc ? 2.6 + r() * 0.8 : undefined;
      const color = pick(OLD_FACADES);
      const tiles = zinc ? pick(ZINC) : pick(OLD_TILES);
      const dormers = !zinc && roof !== 'flat' && r() < 0.18 ? 2 : 0;
      addBuilding(parts, r, { ...base, h, roof, rh, color, tiles, dormers });
    }
  };

  // Near bank: from the quay back to the foot of our hill.
  for (let v = -(HALF + 24), row = 0; v > -900; row += 1) {
    const depth = 11 + r() * 5;
    for (let u = -600; u < 3200;) {
      const kind = kindAt(at(u + 8, v - depth / 2), row);
      const w = widthOf(kind, row);
      const p = at(u + w / 2, v - depth / 2);
      if (p.length() > CITY.hill.foot + 8 && inView(p)) addKind(kind, p, w, depth, row);
      u += w + (row === 0 ? 0.4 : kind === 'house' ? 2.5 + r() * 4 : 0.8 + r() * 3);
    }
    v -= depth + (row === 0 ? 12 : 8 + r() * 6);
  }
  // Far bank: a continuous row of facades along the quay, then the districts toward the hills.
  for (let v = HALF + 24, row = 0; v < 3200; row += 1) {
    const depth = 12 + r() * 5 + v * 0.004;
    for (let u = -1500; u < 3500;) {
      const kind = kindAt(at(u + 8, v + depth / 2), row);
      const w = widthOf(kind, row) * (1 + v * 0.0005);
      const p = at(u + w / 2, v + depth / 2);
      if (inView(p, 60)) addKind(kind, p, w, depth, row);
      u += w + (row === 0 ? 0.4 : kind === 'house' ? 2.5 + r() * 4 : 0.6 + r() * 3 + v * 0.002);
    }
    v += depth + (row === 0 ? 14 : 8 + r() * 6 + v * 0.004);
  }

  // The park: groves around lawns, and the pond in a clearing.
  const lawn = valueNoise(29, 60);
  for (let u = park.u[0] + 5; u < park.u[1] - 5; u += 7.5) {
    for (let v = park.v[0] + 5; v < park.v[1] - 5; v += 7.5) {
      if (((u - pond.u) / (pond.ru + 16)) ** 2 + ((v - pond.v) / (pond.rv + 16)) ** 2 < 1) continue;
      const pu = u + (r() - 0.5) * 5;
      const p = at(pu, v + (r() - 0.5) * 5);
      if (lawn(p.x, p.y) < 0.42) continue;
      trees.push(tree(p.x, p.y, 3 + r() * 2.2));
    }
  }
  const corners = [
    at(park.u[0], park.v[0]),
    at(park.u[1], park.v[0]),
    at(park.u[1], park.v[1]),
    at(park.u[0], park.v[1]),
  ];
  return { trees, pond: { center: at(pond.u, pond.v), ru: pond.ru, rv: pond.rv }, lawn: corners };
}

/**
 * The relief as ground: a polar grid over the view, a little below the plain where the town is flat so that the plain
 * shows there, and sunk deep under the river so that the water shows. It stops short of the first hills on the horizon.
 */
function reliefGround(): BufferGeometry {
  const azs = 200;
  const rings = 160;
  const pos: number[] = [];
  for (let j = 0; j <= rings; j += 1) {
    const d = (CITY.hill.foot - 20) * Math.pow(2950 / (CITY.hill.foot - 20), j / rings);
    for (let i = 0; i <= azs; i += 1) {
      const p = polar(-55 + (110 * i) / azs, d);
      const river = Math.abs(acrossOf(p)) < HALF + 10;
      pos.push(p.x, river ? CITY.land - 50 : CITY.land - 0.4 + relief(p), p.y);
    }
  }
  const index: number[] = [];
  for (let j = 0; j < rings; j += 1) {
    for (let i = 0; i < azs; i += 1) {
      const a = j * (azs + 1) + i;
      const b = a + azs + 1;
      index.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

/** A geometry as plain arrays, to cross from the worker. */
export interface PackedGeometry {
  attributes: Record<string, { array: Float32Array; itemSize: number }>;
  index: Uint32Array | null;
  /** The bounding sphere (centre, radius), computed in the worker rather than at the first draw. */
  sphere: [number, number, number, number];
}

export function pack(geometry: BufferGeometry): PackedGeometry {
  const attributes: PackedGeometry['attributes'] = {};
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    attributes[name] = { array: Float32Array.from(attribute.array), itemSize: attribute.itemSize };
  }
  const index = geometry.getIndex();
  geometry.computeBoundingSphere();
  const { center, radius } = geometry.boundingSphere ?? { center: { x: 0, y: 0, z: 0 }, radius: 0 };
  return {
    attributes,
    index: index ? Uint32Array.from(index.array) : null,
    sphere: [center.x, center.y, center.z, radius],
  };
}

export function packedBuffers(packed: PackedGeometry): ArrayBuffer[] {
  const buffers = Object.values(packed.attributes).map((a) => a.array.buffer as ArrayBuffer);
  if (packed.index) buffers.push(packed.index.buffer as ArrayBuffer);
  return buffers;
}

export const TOWN_PARTS = ['walls', 'blocks', 'roofs', 'chimneys', 'trees', 'lamps', 'ground'] as const;
export type TownPart = (typeof TOWN_PARTS)[number];

export interface TownGeometry {
  parts: Record<TownPart, PackedGeometry>;
  pond: { center: [number, number]; ru: number; rv: number };
  lawn: [number, number][];
}

/** Only what can be seen through the window, with a margin for the movements of the head, is built. */
const inView: InView = (p, margin = 40) =>
  p.y < 0 && p.length() < 3500 && Math.abs(p.x) < -p.y * Math.tan(50 * DEG) + margin;

interface Neighbour {
  az: [number, number];
  d: number;
  depth: number;
  ridge: number;
  roof: Roof;
  dormers?: number;
  color: number;
}

/**
 * Builds the town's geometry: the neighbours on our hill, the districts, the trees along the quays and in the gardens,
 * the street lamps and the relief. The ground under the relief, the river, the landmarks and the hills are built with
 * the materials, in `city.ts`.
 */
export function buildTownGeometry(): TownGeometry {
  const r = rng(2024);
  const parts: Parts = { walls: [], roofs: [], chimneys: [], blocks: [] };

  // Neighbours on the slope of our hill, at the bottom corners of the window: mostly their roofs show.
  // Each is placed by the azimuths of its sides, its distance, and the angle at which its ridge is seen.
  const neighbours: Neighbour[] = [
    { az: [-23, -10], d: 58, depth: 12, ridge: -11.4, roof: 'hip', dormers: 2, color: 0xeee4d2 },
    { az: [4, 15], d: 62, depth: 13, ridge: -12, roof: 'hip', dormers: 2, color: 0xe7cfaa },
    { az: [15, 25], d: 74, depth: 12, ridge: -11.6, roof: 'gable', color: 0xe9bba4 },
    { az: [-35, -22], d: 66, depth: 12, ridge: -11, roof: 'hip', color: 0xdcc6a6 },
  ];
  for (const n of neighbours) {
    const x0 = Math.tan(n.az[0] * DEG) * n.d;
    const x1 = Math.tan(n.az[1] * DEG) * n.d;
    const rh = n.depth * 0.24;
    const ridgeY = 1.2 + Math.tan(n.ridge * DEG) * (n.d + n.depth / 2);
    const ground = hillY(n.d) - 2;
    addBuilding(parts, r, {
      x: (x0 + x1) / 2,
      z: -n.d - n.depth / 2,
      w: x1 - x0,
      d: n.depth,
      h: ridgeY - rh - ground,
      y0: ground,
      roof: n.roof,
      rh,
      dormers: n.dormers ?? 0,
      color: n.color,
      chimneys: true,
    });
  }
  const town = buildTown(parts, r, inView);

  // Plane trees and street lamps along the quays.
  const trees: BufferGeometry[] = [];
  const lamps: BufferGeometry[] = [];
  for (const side of [1, -1]) {
    for (let u = -250; u < 3500; u += 9 + r() * 5) {
      const p = at(u, side * (HALF + 13 + r() * 3));
      if (!inView(p)) continue;
      const s = 3.2 + r() * 1.5;
      trees.push(new IcosahedronGeometry(1, 1).scale(s, s * 1.1, s).translate(p.x, CITY.land + 3 + s, p.y));
    }
    for (let u = -250; u < 3500; u += 24) {
      const p = at(u, side * (HALF + 3));
      if (inView(p)) lamps.push(new SphereGeometry(0.75, 8, 6).translate(p.x, CITY.land + 5, p.y));
    }
  }
  // Gardens and squares here and there.
  for (let i = 0; i < 260; i += 1) {
    const p = polar(-34 + r() * 68, 60 + r() * 900);
    const d = p.length();
    if (Math.abs(acrossOf(p)) < HALF + 10 || !inView(p)) continue;
    const s = 2.6 + r() * 2;
    trees.push(new IcosahedronGeometry(1, 1).scale(s, s * 1.15, s).translate(p.x, hillY(d) + relief(p) + s, p.y));
  }
  trees.push(...town.trees);

  const merged = (list: BufferGeometry[]): PackedGeometry => {
    // Typed as never failing, but it gives null when the geometries' attributes differ.
    const geometry = mergeGeometries(list) as BufferGeometry | null;
    if (!geometry) throw new Error('town: geometries could not be merged');
    return pack(geometry);
  };
  return {
    parts: {
      walls: merged(parts.walls),
      blocks: merged(parts.blocks),
      roofs: merged(parts.roofs),
      chimneys: merged(parts.chimneys),
      trees: merged(trees),
      lamps: merged(lamps),
      ground: pack(reliefGround()),
    },
    pond: { center: [town.pond.center.x, town.pond.center.y], ru: town.pond.ru, rv: town.pond.rv },
    lawn: town.lawn.map((p): [number, number] => [p.x, p.y]),
  };
}

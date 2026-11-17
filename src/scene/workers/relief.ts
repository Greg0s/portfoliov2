/**
 * The planet's relief and the prince's hair (main spec §6.2), generated in code because the Blender material that
 * makes them cannot be exported. Ported from `docs/prototypes/petit-prince/render.html` with the same seeds, so the
 * live planet is the one of the fallback images. Pure: the geometry worker runs it, and the unit tests hash it.
 */
import { BufferAttribute, BufferGeometry, IcosahedronGeometry, MathUtils, Vector3 } from 'three';
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js';

/** A place where the relief stays calm: where the prince, the fox and the rose stand. */
export interface Calm {
  dir: [number, number, number];
  radius: number;
  floor: number;
}

/** A geometry as plain arrays, to send from the worker without copying. */
export interface Arrays {
  position: Float32Array;
  normal: Float32Array;
  index: Uint32Array;
}

/** The prototype's seeded random numbers (mulberry32). */
export function rng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let x = Math.imul(state ^ (state >>> 15), 1 | state);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function randomDir(random: () => number): Vector3 {
  const u = random() * 2 - 1;
  const a = random() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return new Vector3(s * Math.cos(a), u, s * Math.sin(a));
}

function toArrays(geometry: BufferGeometry): Arrays {
  const index = geometry.getIndex();
  return {
    position: geometry.getAttribute('position').array as Float32Array,
    normal: geometry.getAttribute('normal').array as Float32Array,
    index: Uint32Array.from(index ? index.array : []),
  };
}

/** A non-indexed geometry's attribute, as plain numbers. */
interface Corners {
  name: string;
  array: Float32Array;
  itemSize: number;
}

const ICOSAHEDRON_T = (1 + Math.sqrt(5)) / 2;
// three's icosahedron (`IcosahedronGeometry`): its corners and faces.
// prettier-ignore
const ICOSAHEDRON_VERTICES = [
  -1, ICOSAHEDRON_T, 0, 1, ICOSAHEDRON_T, 0, -1, -ICOSAHEDRON_T, 0, 1, -ICOSAHEDRON_T, 0,
  0, -1, ICOSAHEDRON_T, 0, 1, ICOSAHEDRON_T, 0, -1, -ICOSAHEDRON_T, 0, 1, -ICOSAHEDRON_T,
  ICOSAHEDRON_T, 0, -1, ICOSAHEDRON_T, 0, 1, -ICOSAHEDRON_T, 0, -1, -ICOSAHEDRON_T, 0, 1,
];
// prettier-ignore
const ICOSAHEDRON_FACES = [
  0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8,
  3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1,
];

/**
 * The corners of `new IcosahedronGeometry(1, detail)` (three's `PolyhedronGeometry`), for a detail of 1 or more: the
 * same numbers, worked out in the same order, into typed arrays rather than vectors and growing lists, several times
 * faster. Its position, normal and UV, as three gives them.
 */
function icosahedronCorners(detail: number): Corners[] {
  const cols = detail + 1;
  const corners = 20 * cols * cols * 3;
  const vertices = new Float64Array(corners * 3);
  // One face's grid of points, row `i` from a toward c, point `j` along it toward b.
  const rowStart = (i: number): number => (i * (2 * cols + 3 - i)) / 2;
  const grid = new Float64Array(((cols + 1) * (cols + 2) * 3) / 2);
  const at = (v: number): number => ICOSAHEDRON_VERTICES[v] ?? 0;
  let n = 0;
  const push = (i: number, j: number): void => {
    const g = (rowStart(i) + j) * 3;
    vertices[n] = grid[g] ?? 0;
    vertices[n + 1] = grid[g + 1] ?? 0;
    vertices[n + 2] = grid[g + 2] ?? 0;
    n += 3;
  };
  for (let f = 0; f < ICOSAHEDRON_FACES.length; f += 3) {
    const a = (ICOSAHEDRON_FACES[f] ?? 0) * 3;
    const b = (ICOSAHEDRON_FACES[f + 1] ?? 0) * 3;
    const c = (ICOSAHEDRON_FACES[f + 2] ?? 0) * 3;
    for (let i = 0; i <= cols; i += 1) {
      const alpha = i / cols;
      // `a.clone().lerp(c, alpha)` and `b.clone().lerp(c, alpha)`.
      const ax = at(a) + (at(c) - at(a)) * alpha;
      const ay = at(a + 1) + (at(c + 1) - at(a + 1)) * alpha;
      const az = at(a + 2) + (at(c + 2) - at(a + 2)) * alpha;
      const bx = at(b) + (at(c) - at(b)) * alpha;
      const by = at(b + 1) + (at(c + 1) - at(b + 1)) * alpha;
      const bz = at(b + 2) + (at(c + 2) - at(b + 2)) * alpha;
      const rows = cols - i;
      for (let j = 0; j <= rows; j += 1) {
        const g = (rowStart(i) + j) * 3;
        if (j === 0 && i === cols) {
          grid[g] = ax;
          grid[g + 1] = ay;
          grid[g + 2] = az;
        } else {
          const beta = j / rows;
          grid[g] = ax + (bx - ax) * beta;
          grid[g + 1] = ay + (by - ay) * beta;
          grid[g + 2] = az + (bz - az) * beta;
        }
      }
    }
    for (let i = 0; i < cols; i += 1) {
      for (let j = 0; j < 2 * (cols - i) - 1; j += 1) {
        const k = Math.floor(j / 2);
        if (j % 2 === 0) {
          push(i, k + 1);
          push(i + 1, k);
          push(i, k);
        } else {
          push(i, k + 1);
          push(i + 1, k + 1);
          push(i + 1, k);
        }
      }
    }
  }
  // On the unit sphere (`normalize()`, then a radius of 1, which changes nothing).
  for (let v = 0; v < vertices.length; v += 3) {
    const x = vertices[v] ?? 0;
    const y = vertices[v + 1] ?? 0;
    const z = vertices[v + 2] ?? 0;
    const scale = 1 / (Math.sqrt(x * x + y * y + z * z) || 1);
    vertices[v] = x * scale;
    vertices[v + 1] = y * scale;
    vertices[v + 2] = z * scale;
  }
  // The UVs: azimuth and inclination, then three's corrections at the poles and across the seam.
  const azimuth = (x: number, z: number): number => Math.atan2(z, -x);
  const uvs = new Float64Array(corners * 2);
  for (let v = 0, u = 0; v < vertices.length; v += 3, u += 2) {
    const x = vertices[v] ?? 0;
    const y = vertices[v + 1] ?? 0;
    const z = vertices[v + 2] ?? 0;
    uvs[u] = azimuth(x, z) / 2 / Math.PI + 0.5;
    uvs[u + 1] = 1 - (Math.atan2(-y, Math.sqrt(x * x + z * z)) / Math.PI + 0.5);
  }
  for (let v = 0, u = 0; v < vertices.length; v += 9, u += 6) {
    const cx = ((vertices[v] ?? 0) + (vertices[v + 3] ?? 0) + (vertices[v + 6] ?? 0)) * (1 / 3);
    const cz = ((vertices[v + 2] ?? 0) + (vertices[v + 5] ?? 0) + (vertices[v + 8] ?? 0)) * (1 / 3);
    const centre = azimuth(cx, cz);
    for (let corner = 0; corner < 3; corner += 1) {
      const x = uvs[u + corner * 2] ?? 0;
      if (centre < 0 && x === 1) uvs[u + corner * 2] = x - 1;
      if (vertices[v + corner * 3] === 0 && vertices[v + corner * 3 + 2] === 0) {
        uvs[u + corner * 2] = centre / 2 / Math.PI + 0.5;
      }
    }
  }
  for (let u = 0; u < uvs.length; u += 6) {
    const x0 = uvs[u] ?? 0;
    const x1 = uvs[u + 2] ?? 0;
    const x2 = uvs[u + 4] ?? 0;
    if (Math.max(x0, x1, x2) > 0.9 && Math.min(x0, x1, x2) < 0.1) {
      if (x0 < 0.2) uvs[u] = x0 + 1;
      if (x1 < 0.2) uvs[u + 2] = x1 + 1;
      if (x2 < 0.2) uvs[u + 4] = x2 + 1;
    }
  }
  const position = Float32Array.from(vertices);
  // Smooth normals: the positions, normalized again once in single precision (`normalizeNormals()`).
  const normal = Float32Array.from(vertices);
  for (let v = 0; v < normal.length; v += 3) {
    const x = normal[v] ?? 0;
    const y = normal[v + 1] ?? 0;
    const z = normal[v + 2] ?? 0;
    const scale = 1 / (Math.sqrt(x * x + y * y + z * z) || 1);
    normal[v] = x * scale;
    normal[v + 1] = y * scale;
    normal[v + 2] = z * scale;
  }
  return [
    { name: 'position', array: position, itemSize: 3 },
    { name: 'normal', array: normal, itemSize: 3 },
    { name: 'uv', array: Float32Array.from(uvs), itemSize: 2 },
  ];
}

/**
 * The icosphere `mergeVertices(new IcosahedronGeometry(1, detail))` gives, vertex for vertex and index for index, but
 * built on typed arrays and merged on whole-number keys in a table of their own rather than on strings: three's took
 * nearly all of the relief's time (1.3 of 1.4 s for the desktop's planet), while the planet waited in the dark.
 *
 * As three's, two corners are one vertex when their position, normal and UV (the icosahedron's attributes, in that
 * order) round to the same keys at a tolerance of 1e-4; a vertex keeps the values of its first corner.
 */
export function icosphere(detail: number): BufferGeometry {
  let attributes: Corners[];
  if (detail >= 1) {
    attributes = icosahedronCorners(detail);
  } else {
    // Flat normals, which the planet never uses: three's own.
    const source = new IcosahedronGeometry(1, detail);
    attributes = Object.keys(source.attributes).map((name) => {
      const attribute = source.getAttribute(name);
      return { name, array: attribute.array as Float32Array, itemSize: attribute.itemSize };
    });
  }
  const count = (attributes[0]?.array.length ?? 0) / 3;
  const width = attributes.reduce((sum, { itemSize }) => sum + itemSize, 0);
  // three's rounding, to the same digits.
  const tolerance = Math.max(1e-4, Number.EPSILON);
  const multiplier = Math.pow(10, Math.log10(1 / tolerance));
  const additive = tolerance * 0.5 * multiplier;

  const keys = new Int32Array(count * width);
  let size = 1;
  while (size < count * 2) size *= 2;
  const mask = size - 1;
  /** Each slot holds a merged vertex's number plus one (0: empty). */
  const slots = new Int32Array(size);
  const firsts = new Int32Array(count);
  const index = new Uint32Array(count);
  const key = new Int32Array(width);
  let merged = 0;
  for (let i = 0; i < count; i += 1) {
    let k = 0;
    let hash = 0;
    for (const { array, itemSize } of attributes) {
      for (let c = 0; c < itemSize; c += 1) {
        // `| 0` turns -0 into 0, which three's string keys also make one.
        const value = Math.trunc((array[i * itemSize + c] ?? 0) * multiplier + additive) | 0;
        key[k] = value;
        hash = Math.imul(hash ^ value, 0x9e3779b1) ^ (hash >>> 15);
        k += 1;
      }
    }
    let slot = (hash ^ (hash >>> 16)) & mask;
    let found = -1;
    for (;;) {
      const held = slots[slot] ?? 0;
      if (held === 0) break;
      const vertex = held - 1;
      let same = true;
      for (let c = 0; c < width; c += 1) {
        if (keys[vertex * width + c] !== key[c]) {
          same = false;
          break;
        }
      }
      if (same) {
        found = vertex;
        break;
      }
      slot = (slot + 1) & mask;
    }
    if (found < 0) {
      found = merged;
      keys.set(key, merged * width);
      firsts[merged] = i;
      slots[slot] = merged + 1;
      merged += 1;
    }
    index[i] = found;
  }

  const geometry = new BufferGeometry();
  attributes.forEach(({ name, array, itemSize }) => {
    const values = new Float32Array(merged * itemSize);
    for (let v = 0; v < merged; v += 1) {
      const from = (firsts[v] ?? 0) * itemSize;
      for (let c = 0; c < itemSize; c += 1) values[v * itemSize + c] = array[from + c] ?? 0;
    }
    geometry.setAttribute(name, new BufferAttribute(values, itemSize));
  });
  geometry.setIndex(new BufferAttribute(index, 1));
  return geometry;
}

/** The planet's surface before the calm places: its icosphere, and the height of each vertex (noise and craters). */
export interface PlanetHeights {
  geometry: BufferGeometry;
  heights: Float64Array;
}

/**
 * The planet's heights: a lumpy surface (simplex noise, 5 octaves) and 46 craters. They do not depend on the model,
 * so the worker builds them while the model downloads.
 */
export function planetHeights(detail: number, seed = 5): PlanetHeights {
  const random = rng(seed);
  const noise = new SimplexNoise({ random });
  const geometry = icosphere(detail);
  const craters: { c: Vector3; size: number; depth: number; reach: number }[] = [];
  const count = seed === 5 ? 46 : 34 + Math.floor(random() * 26);
  for (let i = 0; i < count; i += 1) {
    const size = 0.05 + Math.pow(random(), 2.6) * 0.26;
    // Below this dot product, a vertex is surely out of the crater's reach (1.7 sizes): its arc cosine is skipped.
    const reach = 1.7 * size >= Math.PI ? -2 : Math.cos(1.7 * size) - 1e-6;
    craters.push({ c: randomDir(random), size, depth: 0.16 + random() * 0.14, reach });
  }
  const position = geometry.getAttribute('position');
  const heights = new Float64Array(position.count);
  const v = new Vector3();
  for (let i = 0; i < position.count; i += 1) {
    v.fromBufferAttribute(position, i).normalize();
    let h = 0;
    let amp = 0.03;
    let freq = 1.4;
    for (let o = 0; o < 5; o += 1) {
      h += amp * noise.noise3d(v.x * freq + 11, v.y * freq, v.z * freq);
      amp *= 0.5;
      freq *= 2.15;
    }
    for (const k of craters) {
      const dot = v.dot(k.c);
      if (dot < k.reach) continue;
      const d = Math.acos(MathUtils.clamp(dot, -1, 1)) / k.size;
      if (d < 1.7) {
        const bowl = d < 1 ? d * d - 1 : 0;
        const rim = 0.32 * Math.exp(-Math.pow((d - 1.02) / 0.26, 2));
        h += k.size * k.depth * (bowl + rim);
      }
    }
    heights[i] = h;
  }
  return { geometry, heights };
}

/** Raises the planet's surface to its heights, calm where the characters stand (from the model). */
export function shapePlanet({ geometry, heights }: PlanetHeights, calm: readonly Calm[]): Arrays {
  const calmDirs = calm.map((c) => ({ ...c, v: new Vector3(...c.dir) }));
  const position = geometry.getAttribute('position');
  const v = new Vector3();
  for (let i = 0; i < position.count; i += 1) {
    v.fromBufferAttribute(position, i).normalize();
    const h = heights[i] ?? 0;
    let keep = 1;
    for (const c of calmDirs) {
      const angle = Math.acos(MathUtils.clamp(v.dot(c.v), -1, 1));
      keep *= 1 - (1 - c.floor) * Math.exp(-Math.pow(angle / c.radius, 2));
    }
    v.multiplyScalar(1 + h * keep);
    position.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  return toArrays(geometry);
}

/** The planet: a lumpy surface (simplex noise, 5 octaves) and 46 craters, calm where the characters stand. */
export function craterPlanet(detail: number, calm: readonly Calm[], seed = 5): Arrays {
  return shapePlanet(planetHeights(detail, seed), calm);
}

/** The hair: crumpled curls, an icosphere creased by softened ridged noise over 2 octaves. */
export function crumpledBall(detail: number, seed = 21): Arrays {
  const noise = new SimplexNoise({ random: rng(seed) });
  const geometry = icosphere(detail);
  const position = geometry.getAttribute('position');
  const v = new Vector3();
  for (let i = 0; i < position.count; i += 1) {
    v.fromBufferAttribute(position, i).normalize();
    let h = 0;
    let amp = 1;
    let f = 1.4;
    for (let o = 0; o < 2; o += 1) {
      // Softened ridges (|n| rounded off near 0): folds without sharp, aliasing creases.
      const n = noise.noise3d(v.x * f + o * 7.1, v.y * f, v.z * f);
      h += amp * Math.pow(1 - Math.sqrt(n * n + 0.03), 1.4);
      amp *= 0.4;
      f *= 2.1;
    }
    v.multiplyScalar(0.84 + 0.36 * h);
    position.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  return toArrays(geometry);
}

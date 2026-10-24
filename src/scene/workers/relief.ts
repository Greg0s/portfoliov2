/**
 * The planet's relief and the prince's hair (main spec §6.2), generated in code because the Blender material that
 * makes them cannot be exported. Ported from `docs/prototypes/petit-prince/render.html` with the same seeds, so the
 * live planet is the one of the fallback images. Pure: the geometry worker runs it, and the unit tests hash it.
 */
import { IcosahedronGeometry, MathUtils, Vector3, type BufferGeometry } from 'three';
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

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

/** The planet: a lumpy surface (simplex noise, 5 octaves) and 46 craters, calm where the characters stand. */
export function craterPlanet(detail: number, calm: readonly Calm[], seed = 5): Arrays {
  const random = rng(seed);
  const noise = new SimplexNoise({ random });
  const geometry = mergeVertices(new IcosahedronGeometry(1, detail));
  const craters: { c: Vector3; size: number; depth: number }[] = [];
  const count = seed === 5 ? 46 : 34 + Math.floor(random() * 26);
  for (let i = 0; i < count; i += 1) {
    const size = 0.05 + Math.pow(random(), 2.6) * 0.26;
    craters.push({ c: randomDir(random), size, depth: 0.16 + random() * 0.14 });
  }
  const calmDirs = calm.map((c) => ({ ...c, v: new Vector3(...c.dir) }));
  const position = geometry.getAttribute('position');
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
      const d = Math.acos(MathUtils.clamp(v.dot(k.c), -1, 1)) / k.size;
      if (d < 1.7) {
        const bowl = d < 1 ? d * d - 1 : 0;
        const rim = 0.32 * Math.exp(-Math.pow((d - 1.02) / 0.26, 2));
        h += k.size * k.depth * (bowl + rim);
      }
    }
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

/** The hair: crumpled curls, an icosphere creased by softened ridged noise over 2 octaves. */
export function crumpledBall(detail: number, seed = 21): Arrays {
  const noise = new SimplexNoise({ random: rng(seed) });
  const geometry = mergeVertices(new IcosahedronGeometry(1, detail));
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

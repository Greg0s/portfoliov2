/**
 * What every part of the office shares (office spec §3, ported from `docs/prototypes/bureau/scene.js`, the final
 * scene): its units (metres, the floor at y = 0, the camera looking toward −z), its render layers, the room's
 * dimensions and small builders. The geometry worker imports the pure parts, so nothing here touches the DOM at load.
 */
import {
  BoxGeometry,
  BufferAttribute,
  CanvasTexture,
  Color,
  Mesh,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  type BufferGeometry,
  type ColorRepresentation,
  type Material,
  type MeshStandardMaterialParameters,
  type Object3D,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export const DEG = Math.PI / 180;

/** The render layers: the town is drawn under its own lights, the room and the desk under theirs. */
export const LAYERS = { city: 1, room: 2, desk: 3 } as const;

/** The wall in front of the desk, its window, and the desk. */
export const ROOM = {
  wallZ: -1.2,
  wallT: 0.24,
  win: { x0: -0.47, x1: 1.6, y0: 0.78, y1: 2.5 },
  height: 2.7,
  deskY: 0.74,
  deskFront: -0.36,
} as const;

/** The picture of the monitor, in the 16:10 format of a classic desk screen (a 32-inch panel). */
export const SCREEN = { w: 0.7, h: 0.4375 } as const;

/** The prototype's seeded random numbers (mulberry32). */
export function rng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** A matte standard material. */
export function std(
  color: ColorRepresentation,
  roughness = 0.85,
  metalness = 0,
  extra: MeshStandardMaterialParameters = {},
): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, roughness, metalness, ...extra });
}

/** A texture drawn on a canvas. */
export function canvasTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  repeat = true,
): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) draw(ctx, w, h);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  if (repeat) texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

/** Whether a node is a mesh, typed with the default mesh's geometry and materials. */
export function isMesh(node: Object3D): node is Mesh {
  return node instanceof Mesh;
}

/** Puts every mesh of an object on one render layer (lights stay visible to every layer). */
export function onLayer<T extends Object3D>(object: T, layer: number, shadows = true): T {
  object.traverse((node) => {
    if (!isMesh(node)) return;
    node.layers.set(layer);
    node.castShadow = shadows && node.userData.noShadow !== true;
    node.receiveShadow = shadows;
  });
  return object;
}

export function box(
  w: number,
  h: number,
  d: number,
  material: Material,
  x: number,
  y: number,
  z: number,
  radius = 0,
): Mesh {
  const geometry = radius ? new RoundedBoxGeometry(w, h, d, 3, radius) : new BoxGeometry(w, h, d);
  const mesh = new Mesh(geometry, material);
  mesh.position.set(x, y, z);
  return mesh;
}

/** Paints a geometry with one vertex colour. */
export function colorize<T extends BufferGeometry>(geometry: T, color: ColorRepresentation): T {
  const c = new Color(color);
  const array = new Float32Array(geometry.getAttribute('position').count * 3);
  for (let i = 0; i < array.length; i += 3) c.toArray(array, i);
  geometry.setAttribute('color', new BufferAttribute(array, 3));
  return geometry;
}

/**
 * The sky's WebGL field (constellation proposals): the projects' stars or planets, the faint stars that complete the
 * constellations, their lines, and the decor that keeps the sky alive (dust at every depth, small worlds, the
 * planisphere, the suns and their orbits), drawn by the journey's renderer in the journey's camera. Built once per
 * proposal; each frame only moves uniforms and a handful of objects.
 */
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Group as ThreeGroup,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  Mesh,
  NormalBlending,
  ShaderMaterial,
  SRGBColorSpace,
  Vector3,
  type IUniform,
} from 'three';
import { GROUP_OF, type Group, type PointRef, type SkyDesign } from './designs';
import { planetFragment, planetVertex, ribbonFragment, ribbonVertex, spriteFragment, spriteVertex } from './shaders';
import { swayMatrix } from '../journey/camera3d';
import { seeded, type View } from '../journey/layout';
import type { Sway } from '../journey/camera';
import type { Renderer } from '../renderer';

export interface FieldFrame {
  time: number;
  view: View;
  sway: Sway;
  /** The sky's depth in front of the focus plane. */
  relBase: number;
  presence: number;
  /** Each body, in px from the vanishing point at the focus plane of this screen. */
  bodies: { x: number; y: number; dz: number; glow: number; dim: number }[];
  draws: Record<Group, number>;
  lineAlpha: Record<Group, number>;
  focusDz: number;
  activeBody: number;
  sx: number;
  sy: number;
}

export interface Field {
  /** Draws a frame's state; true while something still moves on its own. */
  update(frame: FieldFrame): boolean;
  resize(view: View): void;
  dispose(): void;
}

const TINT: Record<Group, [number, number, number]> = {
  perso: [1, 0.77, 0.64],
  pro: [0.68, 0.78, 1],
};
const WHITE: [number, number, number] = [1, 1, 1];
const mix3 = (a: readonly number[], b: readonly number[], k: number): [number, number, number] => [
  (a[0] ?? 0) + ((b[0] ?? 0) - (a[0] ?? 0)) * k,
  (a[1] ?? 0) + ((b[1] ?? 0) - (a[1] ?? 0)) * k,
  (a[2] ?? 0) + ((b[2] ?? 0) - (a[2] ?? 0)) * k,
];

/** Kinds of sprites, as the sprite shader draws them. */
const KIND = { star: 0, bright: 1, bokeh: 2, hexagon: 3, orb: 4, ring: 5, moon: 6, five: 7, sun: 8 } as const;

interface Sprite {
  x: number;
  y: number;
  z: number;
  size: number;
  kind: number;
  alpha: number;
  color: readonly number[];
  seed: number;
  group: number;
  body: number;
}

/** Ribbon channels: the two constellations, the orbits (one per body), the planisphere. */
const CHANNELS = 10;
const GRID = 8;

interface Segment {
  a: Vector3;
  b: Vector3;
  channel: number;
  t0: number;
  t1: number;
  dash: number;
}

function quadCorners(count: number): { corner: Float32Array; index: Uint32Array } {
  const corner = new Float32Array(count * 8);
  const index = new Uint32Array(count * 6);
  for (let i = 0; i < count; i += 1) {
    corner.set([-1, -1, 1, -1, -1, 1, 1, 1], i * 8);
    const v = i * 4;
    index.set([v, v + 1, v + 2, v + 2, v + 1, v + 3], i * 6);
  }
  return { corner, index };
}

function spriteGeometry(sprites: readonly Sprite[]): BufferGeometry {
  const count = sprites.length;
  const { corner, index } = quadCorners(count);
  const position = new Float32Array(count * 12);
  const size = new Float32Array(count * 4);
  const kind = new Float32Array(count * 4);
  const alpha = new Float32Array(count * 4);
  const color = new Float32Array(count * 12);
  const seed = new Float32Array(count * 4);
  const group = new Float32Array(count * 4);
  const body = new Float32Array(count * 4);
  sprites.forEach((sprite, i) => {
    for (let v = 0; v < 4; v += 1) {
      const at = i * 4 + v;
      position.set([sprite.x, -sprite.y, sprite.z * 1000], at * 3);
      size[at] = sprite.size;
      kind[at] = sprite.kind;
      alpha[at] = sprite.alpha;
      color.set(sprite.color.slice(0, 3), at * 3);
      seed[at] = sprite.seed;
      group[at] = sprite.group;
      body[at] = sprite.body;
    }
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  geometry.setAttribute('aCorner', new BufferAttribute(corner, 2));
  geometry.setAttribute('aSize', new BufferAttribute(size, 1));
  geometry.setAttribute('aKind', new BufferAttribute(kind, 1));
  geometry.setAttribute('aAlpha', new BufferAttribute(alpha, 1));
  geometry.setAttribute('aColor', new BufferAttribute(color, 3));
  geometry.setAttribute('aSeed', new BufferAttribute(seed, 1));
  geometry.setAttribute('aGroup', new BufferAttribute(group, 1));
  geometry.setAttribute('aBody', new BufferAttribute(body, 1));
  geometry.setIndex(new BufferAttribute(index, 1));
  return geometry;
}

function ribbonGeometry(segments: readonly Segment[]): BufferGeometry {
  const count = segments.length;
  const { index } = quadCorners(count);
  const start = new Float32Array(count * 12);
  const end = new Float32Array(count * 12);
  const side = new Float32Array(count * 4);
  const along = new Float32Array(count * 4);
  const t = new Float32Array(count * 8);
  const channel = new Float32Array(count * 4);
  const dash = new Float32Array(count * 4);
  segments.forEach((segment, i) => {
    for (let v = 0; v < 4; v += 1) {
      const at = i * 4 + v;
      start.set([segment.a.x, segment.a.y, segment.a.z], at * 3);
      end.set([segment.b.x, segment.b.y, segment.b.z], at * 3);
      side[at] = v % 2 === 0 ? -1 : 1;
      along[at] = v < 2 ? 0 : 1;
      t.set([segment.t0, segment.t1], at * 2);
      channel[at] = segment.channel;
      dash[at] = segment.dash;
    }
  });
  const geometry = new BufferGeometry();
  // Three.js wants a position: the quads are placed by the shader from their two ends.
  geometry.setAttribute('position', new BufferAttribute(start, 3));
  geometry.setAttribute('aStart', new BufferAttribute(start, 3));
  geometry.setAttribute('aEnd', new BufferAttribute(end, 3));
  geometry.setAttribute('aSide', new BufferAttribute(side, 1));
  geometry.setAttribute('aAlong', new BufferAttribute(along, 1));
  geometry.setAttribute('aT', new BufferAttribute(t, 2));
  geometry.setAttribute('aChannel', new BufferAttribute(channel, 1));
  geometry.setAttribute('aDash', new BufferAttribute(dash, 1));
  geometry.setIndex(new BufferAttribute(index, 1));
  return geometry;
}

function material(vertexShader: string, fragmentShader: string, uniforms: Record<string, IUniform>): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    // The quads are placed on screen by their shaders, which may turn them over.
    side: DoubleSide,
    blending: NormalBlending,
    premultipliedAlpha: true,
  });
}

/**
 * A point of the field, in its local space (design px, y up, depth in px), placed so that it shows where the design
 * puts it on screen once the camera rests on the sky.
 */
const local = (x: number, y: number, dz: number): Vector3 => new Vector3(x * (1 - dz), -y * (1 - dz), dz * 1000);
/** A point of the field, in its local space, as it is in space (the orbits). */
const spatial = (x: number, y: number, dz: number): Vector3 => new Vector3(x, -y, dz * 1000);

export function createField(
  design: SkyDesign,
  renderer: Renderer,
  initial: View,
  sources: { cards: number[]; images: (HTMLImageElement | null)[] },
): Field {
  const root = new ThreeGroup();
  root.matrixAutoUpdate = false;
  renderer.scene.add(root);
  const rand = seeded(97 + design.variant);
  const look = design.look;
  const bodyCount = design.bodies.length;
  const groupIndex = (group: Group): number => (group === 'perso' ? 0 : 1);
  const bodyIndex = new Map(design.bodies.map((body, i) => [body.slug, i]));

  const common = {
    uPerspective: { value: initial.perspective },
    uViewport: { value: [initial.width, initial.height] },
    uPx: { value: initial.width / 1440 },
  };

  // ---------- Sprites: decor, faint stars, stars of the projects ----------

  const sprites: Sprite[] = [];
  const dust = look === 'focus' ? 70 : look === 'chart' || look === 'figures' ? 150 : 170;
  for (let i = 0; i < dust; i += 1) {
    const big = rand() < 0.1;
    sprites.push({
      x: (rand() * 2 - 1) * 980,
      y: (rand() * 2 - 1) * 620,
      z: -1.05 + rand() * 1.55,
      size: big ? 1.3 + rand() * 0.6 : 0.6 + rand() * 0.6,
      kind: KIND.star,
      alpha: big ? 0.55 + rand() * 0.3 : 0.22 + rand() * 0.4,
      color: mix3(WHITE, rand() < 0.5 ? TINT.perso : TINT.pro, rand() * 0.35),
      seed: rand(),
      group: 2,
      body: -1,
    });
  }
  if (look === 'focus') {
    // Lights out of focus at every depth, as in a night photograph.
    for (let i = 0; i < 64; i += 1) {
      const tint = rand();
      sprites.push({
        x: (rand() * 2 - 1) * 1050,
        y: (rand() * 2 - 1) * 650,
        z: -1.0 + rand() * 1.5,
        size: 1.2 + rand() * 2.2,
        kind: KIND.bokeh,
        alpha: 0.2 + rand() * 0.3,
        color: tint < 0.4 ? mix3(WHITE, TINT.perso, 0.6) : tint < 0.8 ? mix3(WHITE, TINT.pro, 0.6) : WHITE,
        seed: rand(),
        group: 2,
        body: -1,
      });
    }
  }
  if (look === 'planets' || look === 'systems') {
    // Small worlds, as along the journey: away from the projects and from the preview.
    const kinds = [KIND.orb, KIND.ring, KIND.moon, KIND.five, KIND.orb, KIND.ring, KIND.five, KIND.moon];
    const spots: [number, number, number][] =
      look === 'planets'
        ? [
            [-160, -330, -0.3],
            [200, 330, 0.25],
            [-700, -300, -0.5],
            [690, -150, -0.6],
            [-220, 330, -0.15],
            [130, -320, 0.3],
            [-760, 120, 0.3],
            [760, 320, -0.35],
            [-60, 390, -0.7],
            [470, -390, 0.1],
          ]
        : [
            [-90, -320, -0.3],
            [120, 340, 0.2],
            [-730, -300, -0.5],
            [700, -320, -0.4],
            [-30, 280, -0.6],
            [40, -230, 0.25],
            [-720, 330, 0.3],
            [720, 330, -0.2],
          ];
    spots.forEach(([x, y, z], i) => {
      sprites.push({
        x,
        y,
        z,
        size: 5 + rand() * 4,
        kind: kinds[i % kinds.length] ?? KIND.orb,
        alpha: 0.42 + rand() * 0.25,
        color: WHITE,
        seed: rand(),
        group: 2,
        body: -1,
      });
    });
  }
  design.minors.forEach((minor) => {
    sprites.push({
      x: minor.x * (1 - minor.dz),
      y: minor.y * (1 - minor.dz),
      z: minor.dz,
      size: minor.size,
      kind: KIND.star,
      alpha: look === 'chart' || look === 'figures' ? 0.95 : 0.85,
      color: look === 'planets' ? mix3(WHITE, TINT[minor.group], 0.5) : WHITE,
      seed: rand(),
      group: groupIndex(minor.group),
      body: -1,
    });
  });
  if (look === 'chart' || look === 'figures' || look === 'focus') {
    design.bodies.forEach((body, i) => {
      const group = GROUP_OF[body.slug] ?? 'perso';
      sprites.push({
        x: body.x * (1 - body.dz),
        y: body.y * (1 - body.dz),
        z: body.dz,
        size: look === 'focus' ? body.r : body.r * 0.42,
        kind: look === 'focus' ? KIND.bokeh : KIND.bright,
        alpha: 1,
        color: look === 'focus' ? mix3(WHITE, TINT[group], 0.55) : WHITE,
        seed: rand(),
        group: groupIndex(group),
        body: i,
      });
    });
  }
  const spriteUniforms = {
    ...common,
    uTime: { value: 0 },
    uAlpha: { value: 1 },
    uGroupAlpha: { value: [1, 1] },
    uBodyGlow: { value: new Array<number>(8).fill(0) },
    uBodyDim: { value: new Array<number>(8).fill(0) },
    uFocusRel: { value: 0 },
    uBokeh: { value: look === 'focus' ? 1 : 0 },
  };
  const spriteMesh = new Mesh(spriteGeometry(sprites), material(spriteVertex, spriteFragment, spriteUniforms));
  spriteMesh.frustumCulled = false;
  spriteMesh.renderOrder = 1;
  root.add(spriteMesh);

  // ---------- Ribbons: the constellations' lines, the orbits, the planisphere ----------

  const gapOf = (ref: PointRef): number => {
    if (typeof ref === 'number') return look === 'planets' ? 9 : 8;
    const body = design.bodies[bodyIndex.get(ref) ?? -1];
    if (!body) return 8;
    if (look === 'planets') return body.r * 1.35 + 10;
    if (look === 'focus') return 16;
    return 13;
  };
  const pointOf = (ref: PointRef): Vector3 | null => {
    if (typeof ref === 'number') {
      const minor = design.minors[ref];
      return minor ? local(minor.x, minor.y, minor.dz) : null;
    }
    const body = design.bodies[bodyIndex.get(ref) ?? -1];
    return body ? local(body.x, body.y, body.dz) : null;
  };

  const lines: Segment[] = [];
  (['perso', 'pro'] as const).forEach((group) => {
    const pieces: { a: Vector3; b: Vector3; length: number }[] = [];
    design.paths
      .filter((path) => path.group === group)
      .forEach((path) => {
        for (let i = 0; i + 1 < path.points.length; i += 1) {
          const from = path.points[i];
          const to = path.points[i + 1];
          if (from === undefined || to === undefined) continue;
          const a = pointOf(from);
          const b = pointOf(to);
          if (!a || !b) continue;
          const direction = b.clone().sub(a);
          const length = direction.length();
          direction.normalize();
          const ga = gapOf(from);
          const gb = gapOf(to);
          if (length <= ga + gb + 4) continue;
          pieces.push({
            a: a.clone().addScaledVector(direction, ga),
            b: b.clone().addScaledVector(direction, -gb),
            length,
          });
        }
      });
    const total = pieces.reduce((sum, piece) => sum + piece.length, 0) || 1;
    let at = 0;
    pieces.forEach((piece) => {
      lines.push({
        a: piece.a,
        b: piece.b,
        channel: groupIndex(group),
        t0: at / total,
        t1: (at + piece.length) / total,
        dash: look === 'figures' || look === 'chart' ? 0 : 0,
      });
      at += piece.length;
    });
  });

  const channelColor = (look === 'chart' || look === 'figures' ? [WHITE, WHITE] : [TINT.perso, TINT.pro]).map(
    (tint) => new Vector3(...mix3(WHITE, tint, 0.55)),
  );
  const ribbonUniforms = (width: number): Record<string, IUniform> => ({
    ...common,
    uWidth: { value: width },
    uAlpha: { value: 1 },
    uDraw: { value: new Array<number>(CHANNELS).fill(1) },
    uChannelAlpha: { value: new Array<number>(CHANNELS).fill(1) },
    uChannelColor: {
      value: Array.from({ length: CHANNELS }, (_, i) => channelColor[i] ?? new Vector3(1, 1, 1)),
    },
    uFocusRel: { value: 0 },
    uBokeh: { value: look === 'focus' ? 1 : 0 },
  });
  const lineUniforms = ribbonUniforms(look === 'chart' || look === 'figures' ? 1.1 : 1.3);
  const lineMesh = new Mesh(ribbonGeometry(lines), material(ribbonVertex, ribbonFragment, lineUniforms));
  lineMesh.frustumCulled = false;
  lineMesh.renderOrder = 2;
  if (lines.length > 0) root.add(lineMesh);

  // The orbits (proposal 4), and the planisphere behind the chart (proposal 2).
  const guides: Segment[] = [];
  if (look === 'systems') {
    const orbitColors: Vector3[] = [];
    design.orbits?.forEach((orbit) => {
      const body = bodyIndex.get(orbit.slug) ?? 0;
      const group = GROUP_OF[orbit.slug] ?? 'perso';
      const system = design.systems?.find((candidate) => candidate.group === group);
      if (!system) return;
      orbitColors[body] = new Vector3(...mix3(WHITE, TINT[group], 0.6));
      const lean = ((90 - system.tilt) * Math.PI) / 180;
      const roll = (system.roll * Math.PI) / 180;
      const pointAt = (angle: number): Vector3 => {
        const ox = orbit.radius * Math.cos(angle);
        const oy = orbit.radius * Math.sin(angle) * Math.sin(lean);
        const oz = orbit.radius * Math.sin(angle) * Math.cos(lean);
        return spatial(
          system.x + ox * Math.cos(roll) - oy * Math.sin(roll),
          system.y + ox * Math.sin(roll) + oy * Math.cos(roll),
          oz / 1000,
        );
      };
      const steps = 120;
      for (let i = 0; i < steps; i += 1) {
        guides.push({
          a: pointAt((i / steps) * 2 * Math.PI),
          b: pointAt(((i + 1) / steps) * 2 * Math.PI),
          channel: 2 + body,
          t0: 0,
          t1: 0,
          dash: 0,
        });
      }
    });
    orbitColors.forEach((color, body) => {
      const value = (lineUniforms.uChannelColor?.value as Vector3[] | undefined) ?? [];
      value[2 + body] = color;
    });
  }
  if (look === 'chart') {
    // A planisphere, tilted away behind the stars: its circles, its hours and its outer scale.
    const tilt = (24 * Math.PI) / 180;
    const center = { x: 20, y: 60, z: -0.55 };
    const at = (radius: number, angle: number): Vector3 => {
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);
      return local(center.x + x, center.y + y * Math.cos(tilt), center.z - (y * Math.sin(tilt)) / 1000);
    };
    const circle = (radius: number, dash: number): void => {
      const steps = Math.round(radius / 6);
      for (let i = 0; i < steps; i += 1) {
        guides.push({
          a: at(radius, (i / steps) * 2 * Math.PI),
          b: at(radius, ((i + 1) / steps) * 2 * Math.PI),
          channel: GRID,
          t0: 0,
          t1: 0,
          dash,
        });
      }
    };
    [150, 300, 450, 600].forEach((radius) => {
      circle(radius, 7);
    });
    circle(760, 0);
    circle(790, 0);
    for (let hour = 0; hour < 24; hour += 1) {
      const angle = (hour / 24) * 2 * Math.PI;
      guides.push({ a: at(150, angle), b: at(760, angle), channel: GRID, t0: 0, t1: 0, dash: hour % 2 ? 5 : 0 });
    }
    for (let tick = 0; tick < 144; tick += 1) {
      const angle = (tick / 144) * 2 * Math.PI;
      guides.push({
        a: at(760, angle),
        b: at(tick % 6 === 0 ? 790 : 772, angle),
        channel: GRID,
        t0: 0,
        t1: 0,
        dash: 0,
      });
    }
  }
  const guideUniforms = ribbonUniforms(1);
  const guideColors = guideUniforms.uChannelColor?.value as Vector3[] | undefined;
  const lineColors = lineUniforms.uChannelColor?.value as Vector3[] | undefined;
  if (guideColors && lineColors) lineColors.forEach((color, i) => (guideColors[i] = color));
  const guideMesh = new Mesh(ribbonGeometry(guides), material(ribbonVertex, ribbonFragment, guideUniforms));
  guideMesh.frustumCulled = false;
  guideMesh.renderOrder = 0;
  if (guides.length > 0) root.add(guideMesh);

  // ---------- Planets: the projects' pictures on spheres (proposals 1 and 4), and the suns ----------

  const atlas = document.createElement('canvas');
  atlas.width = 1024;
  atlas.height = 768;
  const context = atlas.getContext('2d');
  const texture = new CanvasTexture(atlas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = 4;

  const quad = (): BufferGeometry => {
    const { corner, index } = quadCorners(1);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(12), 3));
    geometry.setAttribute('aCorner', new BufferAttribute(corner, 2));
    geometry.setIndex(new BufferAttribute(index, 1));
    return geometry;
  };

  interface Planet {
    mesh: Mesh;
    uniforms: Record<string, IUniform>;
    seed: number;
  }
  const planets: Planet[] = [];
  const hasPlanets = look === 'planets' || look === 'systems';
  if (hasPlanets) {
    design.bodies.forEach((body, i) => {
      const group = GROUP_OF[body.slug] ?? 'perso';
      const seed = rand();
      const ringed = look === 'planets';
      const normal = new Vector3(0.12 + 0.2 * (seed - 0.5), 1, 0.4 + 0.25 * seed).normalize();
      const uniforms: Record<string, IUniform> = {
        ...common,
        uRadius: { value: body.r },
        uExtent: { value: ringed ? 2.25 : 1.9 },
        uAlpha: { value: 1 },
        uAtlas: { value: texture },
        uCell: { value: [(i % 2) * 0.5, 1 - (Math.floor(i / 2) + 1) / 3, 0.5, 1 / 3] },
        uSpin: { value: 0 },
        uAxis: { value: (seed - 0.5) * 0.5 },
        uLight: { value: new Vector3(-0.45, 0.62, 0.64).normalize() },
        uTint: { value: new Vector3(...TINT[group]) },
        uGlow: { value: 0 },
        uDim: { value: 0 },
        uRing: { value: ringed ? 1 : 0 },
        uRingNormal: { value: normal },
        uRingSize: { value: [1.42, 2.05] },
        uRingAlpha: { value: 0.62 },
        uReady: { value: 0 },
        uAmbient: { value: look === 'systems' ? 0.34 : 0.14 },
      };
      const mesh = new Mesh(quad(), material(planetVertex, planetFragment, uniforms));
      mesh.frustumCulled = false;
      mesh.renderOrder = 3;
      mesh.position.copy(local(body.x, body.y, body.dz));
      root.add(mesh);
      planets.push({ mesh, uniforms, seed });
    });

    // The pictures, wrapped once they are loaded: the cards' own images.
    sources.images.forEach((image, i) => {
      if (!image || !context) return;
      image.loading = 'eager';
      const paint = (): void => {
        const cell = { x: (i % 2) * 512, y: Math.floor(i / 2) * 256 };
        context.drawImage(image, cell.x, cell.y, 512, 256);
        texture.needsUpdate = true;
        const ready = planets[i]?.uniforms.uReady;
        if (ready) ready.value = 1;
      };
      if (image.complete && image.naturalWidth > 0) paint();
      else image.addEventListener('load', paint, { once: true });
    });
  }

  const suns: { mesh: Mesh; group: Group; uniforms: typeof spriteUniforms }[] = [];
  design.systems?.forEach((system) => {
    const uniforms = { ...spriteUniforms, uBodyGlow: { value: new Array<number>(8).fill(0) } };
    const geometry = spriteGeometry([
      {
        x: 0,
        y: 0,
        z: 0,
        size: 11,
        kind: KIND.sun,
        alpha: 1,
        color: TINT[system.group],
        seed: 0.5,
        group: 2,
        body: -1,
      },
    ]);
    const mesh = new Mesh(geometry, material(spriteVertex, spriteFragment, uniforms));
    mesh.frustumCulled = false;
    mesh.renderOrder = 3;
    mesh.position.copy(local(system.x, system.y, 0));
    root.add(mesh);
    suns.push({ mesh, group: system.group, uniforms });
  });

  // ---------- Each frame ----------

  const scaleMatrix = new Matrix4();
  const shift = new Matrix4();
  let lastTime = -1;

  function resize(view: View): void {
    common.uPerspective.value = view.perspective;
    common.uViewport.value = [view.width, view.height];
    common.uPx.value = view.width / 1440;
  }

  return {
    update(frame) {
      const { view } = frame;
      resize(view);
      root.matrix
        .copy(swayMatrix(frame.sway))
        .multiply(shift.makeTranslation(0, 0, frame.relBase * view.perspective))
        .multiply(scaleMatrix.makeScale(frame.sx, frame.sy, frame.sx));
      root.matrixWorldNeedsUpdate = true;
      const presence = frame.presence;

      spriteUniforms.uTime.value = frame.time;
      spriteUniforms.uAlpha.value = presence;
      spriteUniforms.uGroupAlpha.value = [
        0.55 + 0.45 * Math.max(frame.draws.perso, frame.lineAlpha.perso),
        0.55 + 0.45 * Math.max(frame.draws.pro, frame.lineAlpha.pro),
      ];
      const focusRel = frame.focusDz;
      spriteUniforms.uFocusRel.value = frame.relBase + focusRel;
      frame.bodies.forEach((body, i) => {
        if (i >= 8) return;
        spriteUniforms.uBodyGlow.value[i] = body.glow;
        spriteUniforms.uBodyDim.value[i] = body.dim;
      });

      const setLines = (uniforms: Record<string, IUniform>): void => {
        const draw = uniforms.uDraw?.value as number[];
        const alpha = uniforms.uChannelAlpha?.value as number[];
        draw[0] = frame.draws.perso;
        draw[1] = frame.draws.pro;
        alpha[0] = frame.lineAlpha.perso;
        alpha[1] = frame.lineAlpha.pro;
        // The orbits: faint, the shown project's brighter.
        for (let i = 0; i < bodyCount && i < 6; i += 1) {
          const body = frame.bodies[i];
          alpha[2 + i] = 0.13 + 0.32 * (body?.glow ?? 0) - 0.08 * (body?.dim ?? 0);
        }
        alpha[GRID] = 0.085;
        if (uniforms.uAlpha) uniforms.uAlpha.value = presence;
        if (uniforms.uFocusRel) uniforms.uFocusRel.value = frame.relBase + focusRel;
      };
      setLines(lineUniforms);
      setLines(guideUniforms);

      planets.forEach((planet, i) => {
        const body = frame.bodies[i];
        if (!body) return;
        planet.mesh.position.set(body.x / frame.sx, -body.y / frame.sy, body.dz * 1000);
        const u = planet.uniforms;
        const set = (name: string, value: unknown): void => {
          const uniform = u[name];
          if (uniform) uniform.value = value;
        };
        set('uSpin', 0.55 * Math.sin(frame.time / 9000 + planet.seed * 6.28));
        set('uGlow', body.glow);
        set('uDim', body.dim);
        set('uAlpha', presence);
        if (look === 'systems') {
          // Lit by its sun.
          const group = GROUP_OF[design.bodies[i]?.slug ?? ''] ?? 'perso';
          const system = design.systems?.find((candidate) => candidate.group === group);
          if (system) {
            const light = new Vector3(
              system.x * frame.sx - body.x,
              -(system.y * frame.sy - body.y),
              -body.dz * 1000 * frame.sx,
            ).normalize();
            light.z += 0.25;
            (u.uLight?.value as Vector3 | undefined)?.copy(light.normalize());
          }
        }
      });
      suns.forEach((sun) => {
        sun.uniforms.uAlpha.value = presence;
        sun.uniforms.uTime.value = frame.time;
      });
      const moving = lastTime !== frame.time;
      lastTime = frame.time;
      return hasPlanets && moving;
    },
    resize,
    dispose() {
      renderer.scene.remove(root);
      root.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const { geometry, material } = object as Mesh<BufferGeometry, ShaderMaterial>;
        geometry.dispose();
        material.dispose();
      });
      texture.dispose();
    },
  };
}

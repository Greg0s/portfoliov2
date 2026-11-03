/**
 * The sky's WebGL field (constellation proposals): the projects' planets (the planetarium), the faint stars that
 * complete the constellations, their lines, the constellations' names in space, and the decor that keeps the sky alive
 * (dust at every depth, small worlds, lights out of focus, the planisphere), drawn by the journey's renderer in the
 * journey's camera. Built once per proposal; each frame moves uniforms, and the lines' ends where the cards move.
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
  PlaneGeometry,
  ShaderMaterial,
  SRGBColorSpace,
  Vector3,
  type IUniform,
} from 'three';
import { GROUP_OF, type Group, type PointRef, type SkyDesign } from './designs';
import {
  labelFragment,
  labelVertex,
  planetFragment,
  planetVertex,
  ribbonFragment,
  ribbonVertex,
  spriteFragment,
  spriteVertex,
} from './shaders';
import { swayMatrix } from '../journey/camera3d';
import { seeded, type View } from '../journey/layout';
import type { Sway } from '../journey/camera';
import type { Renderer } from '../renderer';

/** A point of the sky, in px from the vanishing point at the focus plane of this screen, with its depth. */
export interface FieldPoint {
  x: number;
  y: number;
  dz: number;
}

export interface FieldFrame {
  time: number;
  view: View;
  sway: Sway;
  /** The sky's depth in front of the focus plane. */
  relBase: number;
  presence: number;
  bodies: (FieldPoint & { glow: number; dim: number })[];
  minors: FieldPoint[];
  draws: Record<Group, number>;
  lineAlpha: Record<Group, number>;
  /** The constellations' names in space (the planetarium), 0 to 1. */
  nameAlpha: Record<Group, number>;
  focusDz: number;
  sx: number;
  sy: number;
}

export interface Field {
  /** Draws a frame's state; true while something still moves on its own. */
  update(frame: FieldFrame): boolean;
  resize(view: View): void;
  dispose(): void;
}

/** The two constellations' lights (the focus), or one light for both. */
const TINT: Record<Group, [number, number, number]> = {
  perso: [1, 0.77, 0.64],
  pro: [0.68, 0.78, 1],
};
const NEUTRAL: [number, number, number] = [0.93, 0.9, 0.86];
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

/** Ribbon channels: the two constellations, the planisphere. */
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

/** A constellation's name, drawn once on a canvas: small capitals, widely spaced, in the site's display face. */
function nameCanvas(text: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const scale = 4;
  const size = 10.5 * scale;
  const spacing = 0.42 * size;
  const family = getComputedStyle(document.documentElement).getPropertyValue('--font-display').trim() || 'sans-serif';
  const font = `italic 300 ${String(size)}px ${family}`;
  const context = canvas.getContext('2d');
  if (!context) return canvas;
  context.font = font;
  const letters = Array.from(new Intl.Segmenter().segment(text.toUpperCase()), (part) => part.segment);
  const widths = letters.map((letter) => context.measureText(letter).width);
  const width = widths.reduce((sum, w) => sum + w + spacing, 0) - spacing;
  canvas.width = Math.ceil(width + 2 * scale * 4);
  canvas.height = Math.ceil(size * 1.6);
  context.font = font;
  context.fillStyle = '#fff';
  context.textBaseline = 'middle';
  let x = scale * 4;
  letters.forEach((letter, i) => {
    context.fillText(letter, x, canvas.height / 2);
    x += (widths[i] ?? 0) + spacing;
  });
  return canvas;
}

export function createField(
  design: SkyDesign,
  renderer: Renderer,
  initial: View,
  sources: { cards: number[]; images: (HTMLImageElement | null)[]; names: Record<Group, string> },
): Field {
  const root = new ThreeGroup();
  root.matrixAutoUpdate = false;
  renderer.scene.add(root);
  const rand = seeded(97 + design.variant);
  const look = design.look;
  const groupIndex = (group: Group): number => (group === 'perso' ? 0 : 1);
  const bodyIndex = new Map(design.bodies.map((body, i) => [body.slug, i]));
  const tintOf = (group: Group): readonly number[] => (design.tinted ? TINT[group] : NEUTRAL);
  const cards = design.cards !== undefined;

  const common = {
    uPerspective: { value: initial.perspective },
    uViewport: { value: [initial.width, initial.height] },
    uPx: { value: initial.width / 1440 },
  };

  // ---------- Sprites: decor, faint stars ----------

  const sprites: Sprite[] = [];
  const dust = look === 'focus' ? 70 : look === 'chart' ? 150 : 170;
  for (let i = 0; i < dust; i += 1) {
    const big = rand() < 0.1;
    const tint = rand() < 0.5 ? tintOf('perso') : tintOf('pro');
    sprites.push({
      x: (rand() * 2 - 1) * 980,
      y: (rand() * 2 - 1) * 620,
      z: -1.05 + rand() * 1.55,
      size: big ? 1.3 + rand() * 0.6 : 0.6 + rand() * 0.6,
      kind: KIND.star,
      alpha: big ? 0.55 + rand() * 0.3 : 0.22 + rand() * 0.4,
      color: mix3(WHITE, tint, rand() * 0.35),
      seed: rand(),
      group: 2,
      body: -1,
    });
  }
  if (look === 'focus') {
    // Lights out of focus at every depth, as in a night photograph.
    for (let i = 0; i < 46; i += 1) {
      const tint = rand();
      sprites.push({
        x: (rand() * 2 - 1) * 1050,
        y: (rand() * 2 - 1) * 650,
        z: -1.0 + rand() * 1.5,
        size: 1.2 + rand() * 2.2,
        kind: KIND.bokeh,
        alpha: 0.16 + rand() * 0.26,
        color: tint < 0.4 ? mix3(WHITE, TINT.perso, 0.6) : tint < 0.8 ? mix3(WHITE, TINT.pro, 0.6) : WHITE,
        seed: rand(),
        group: 2,
        body: -1,
      });
    }
  }
  if (look === 'planets') {
    // Small worlds, as along the journey: away from the projects, the Little Prince's planet and the preview.
    const kinds = [KIND.orb, KIND.ring, KIND.moon, KIND.five, KIND.orb, KIND.ring, KIND.five, KIND.moon];
    const spots: [number, number, number][] = [
      [-160, -290, -0.3],
      [200, 330, 0.25],
      [-700, -280, -0.5],
      [690, -150, -0.6],
      [-220, 330, -0.15],
      [150, -290, 0.3],
      [-760, 120, 0.3],
      [760, 320, -0.35],
      [-60, 390, -0.7],
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
  const minorsFrom = sprites.length;
  design.minors.forEach((minor) => {
    sprites.push({
      x: minor.x * (1 - minor.dz),
      y: minor.y * (1 - minor.dz),
      z: minor.dz,
      size: minor.size,
      kind: KIND.star,
      alpha: look === 'chart' ? 0.95 : 0.85,
      color: mix3(WHITE, tintOf(minor.group), 0.5),
      seed: rand(),
      group: groupIndex(minor.group),
      body: -1,
    });
  });
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
  const spriteGeo = spriteGeometry(sprites);
  const spriteMesh = new Mesh(spriteGeo, material(spriteVertex, spriteFragment, spriteUniforms));
  spriteMesh.frustumCulled = false;
  spriteMesh.renderOrder = 1;
  root.add(spriteMesh);

  // ---------- Ribbons: the constellations' lines, the planisphere ----------

  /** How far a line stops short of its end: out of a planet, a star's glow; under a card, nothing to spare. */
  const gapOf = (ref: PointRef): number => {
    if (typeof ref === 'number') return look === 'planets' ? 9 : 8;
    const body = design.bodies[bodyIndex.get(ref) ?? -1];
    if (!body || cards) return 0;
    return body.r * 1.35 + 10;
  };
  const restPoint = (ref: PointRef): Vector3 | null => {
    if (typeof ref === 'number') {
      const minor = design.minors[ref];
      return minor ? local(minor.x, minor.y, minor.dz) : null;
    }
    const body = design.bodies[bodyIndex.get(ref) ?? -1];
    return body ? local(body.x, body.y, body.dz) : null;
  };

  const lines: Segment[] = [];
  const lineEnds: { from: PointRef; to: PointRef; ga: number; gb: number }[] = [];
  (['perso', 'pro'] as const).forEach((group) => {
    const pieces: { a: Vector3; b: Vector3; length: number; from: PointRef; to: PointRef }[] = [];
    design.paths
      .filter((path) => path.group === group)
      .forEach((path) => {
        for (let i = 0; i + 1 < path.points.length; i += 1) {
          const from = path.points[i];
          const to = path.points[i + 1];
          if (from === undefined || to === undefined) continue;
          const a = restPoint(from);
          const b = restPoint(to);
          if (!a || !b) continue;
          pieces.push({ a, b, length: a.distanceTo(b), from, to });
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
        dash: 0,
      });
      lineEnds.push({ from: piece.from, to: piece.to, ga: gapOf(piece.from), gb: gapOf(piece.to) });
      at += piece.length;
    });
  });

  const channelColor = [tintOf('perso'), tintOf('pro')].map((tint) => new Vector3(...mix3(WHITE, tint, 0.55)));
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
  const lineUniforms = ribbonUniforms(look === 'chart' ? 1.1 : 1.3);
  const lineGeo = ribbonGeometry(lines);
  const lineMesh = new Mesh(lineGeo, material(ribbonVertex, ribbonFragment, lineUniforms));
  lineMesh.frustumCulled = false;
  lineMesh.renderOrder = 2;
  if (lines.length > 0) root.add(lineMesh);

  // The planisphere behind the chart (proposal 2).
  const guides: Segment[] = [];
  if (look === 'chart') {
    // Tilted away behind the cards: its circles, its hours and its outer scale.
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
  const guideMesh = new Mesh(ribbonGeometry(guides), material(ribbonVertex, ribbonFragment, guideUniforms));
  guideMesh.frustumCulled = false;
  guideMesh.renderOrder = 0;
  if (guides.length > 0) root.add(guideMesh);

  // ---------- The constellations' names, in space (the planetarium) ----------

  const nameMeshes: { mesh: Mesh; group: Group; uniforms: { uMap: IUniform; uAlpha: { value: number } } }[] = [];
  const nameTextures: CanvasTexture[] = [];
  if (design.namesIn === 'space') {
    const write = (): void => {
      design.names?.forEach((name) => {
        const canvas = nameCanvas(sources.names[name.group]);
        const texture = new CanvasTexture(canvas);
        texture.colorSpace = SRGBColorSpace;
        texture.minFilter = LinearMipmapLinearFilter;
        texture.magFilter = LinearFilter;
        texture.anisotropy = 8;
        nameTextures.push(texture);
        const uniforms = { ...common, uMap: { value: texture }, uAlpha: { value: 0 } };
        const mesh = new Mesh(
          new PlaneGeometry(canvas.width / 4, canvas.height / 4),
          material(labelVertex, labelFragment, uniforms),
        );
        mesh.frustumCulled = false;
        mesh.renderOrder = 2;
        mesh.position.copy(local(name.x, name.y, name.dz));
        // Laid in the sky: turned in depth, along the constellation.
        mesh.rotation.set(0, (name.turn * Math.PI) / 180, (-name.angle * Math.PI) / 180);
        root.add(mesh);
        nameMeshes.push({ mesh, group: name.group, uniforms });
      });
    };
    // The face must be there before it is drawn.
    void document.fonts.ready.then(write);
  }

  // ---------- Planets: the projects' pictures on spheres (the planetarium) ----------

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
  const hasPlanets = look === 'planets';
  if (hasPlanets) {
    design.bodies.forEach((body, i) => {
      const group = GROUP_OF[body.slug] ?? 'perso';
      const seed = rand();
      const normal = new Vector3(0.12 + 0.2 * (seed - 0.5), 1, 0.4 + 0.25 * seed).normalize();
      const uniforms: Record<string, IUniform> = {
        ...common,
        uRadius: { value: body.r },
        uExtent: { value: 2.25 },
        uAlpha: { value: 1 },
        uAtlas: { value: texture },
        uCell: { value: [(i % 2) * 0.5, 1 - (Math.floor(i / 2) + 1) / 3, 0.5, 1 / 3] },
        uSpin: { value: 0 },
        uAxis: { value: (seed - 0.5) * 0.5 },
        uLight: { value: new Vector3(-0.45, 0.62, 0.64).normalize() },
        uTint: { value: new Vector3(...tintOf(group)) },
        uGlow: { value: 0 },
        uDim: { value: 0 },
        uRing: { value: 1 },
        uRingNormal: { value: normal },
        uRingSize: { value: [1.42, 2.05] },
        uRingAlpha: { value: 0.62 },
        uReady: { value: 0 },
        uAmbient: { value: 0.14 },
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

  // ---------- Each frame ----------

  const scaleMatrix = new Matrix4();
  const shift = new Matrix4();
  let lastTime = -1;
  const a = new Vector3();
  const b = new Vector3();
  const direction = new Vector3();

  function resize(view: View): void {
    common.uPerspective.value = view.perspective;
    common.uViewport.value = [view.width, view.height];
    common.uPx.value = view.width / 1440;
  }

  /** A point where it is this frame, in the field's local space. */
  function pointNow(ref: PointRef, frame: FieldFrame, into: Vector3): boolean {
    const point = typeof ref === 'number' ? frame.minors[ref] : frame.bodies[bodyIndex.get(ref) ?? -1];
    if (!point) return false;
    into.set(point.x / frame.sx, -point.y / frame.sy, point.dz * 1000);
    return true;
  }

  /** The lines follow the cards and the stars that move (the chart's threads, the focus's cards). */
  function moveLines(frame: FieldFrame): void {
    const start = lineGeo.getAttribute('aStart') as BufferAttribute;
    const end = lineGeo.getAttribute('aEnd') as BufferAttribute;
    lineEnds.forEach((ends, i) => {
      if (!pointNow(ends.from, frame, a) || !pointNow(ends.to, frame, b)) return;
      direction.copy(b).sub(a);
      const length = direction.length();
      direction.normalize();
      if (length > ends.ga + ends.gb + 4) {
        a.addScaledVector(direction, ends.ga);
        b.addScaledVector(direction, -ends.gb);
      } else {
        b.copy(a);
      }
      for (let v = 0; v < 4; v += 1) {
        start.setXYZ(i * 4 + v, a.x, a.y, a.z);
        end.setXYZ(i * 4 + v, b.x, b.y, b.z);
      }
    });
    start.needsUpdate = true;
    end.needsUpdate = true;
    if (design.minors.length > 0) {
      const position = spriteGeo.getAttribute('position') as BufferAttribute;
      frame.minors.forEach((minor, i) => {
        for (let v = 0; v < 4; v += 1) {
          position.setXYZ((minorsFrom + i) * 4 + v, minor.x / frame.sx, -minor.y / frame.sy, minor.dz * 1000);
        }
      });
      position.needsUpdate = true;
    }
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
      if (cards) moveLines(frame);

      spriteUniforms.uTime.value = frame.time;
      spriteUniforms.uAlpha.value = presence;
      spriteUniforms.uGroupAlpha.value = [
        0.55 + 0.45 * Math.max(frame.draws.perso, frame.lineAlpha.perso),
        0.55 + 0.45 * Math.max(frame.draws.pro, frame.lineAlpha.pro),
      ];
      spriteUniforms.uFocusRel.value = frame.relBase + frame.focusDz;
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
        alpha[GRID] = 0.085;
        if (uniforms.uAlpha) uniforms.uAlpha.value = presence;
        if (uniforms.uFocusRel) uniforms.uFocusRel.value = frame.relBase + frame.focusDz;
      };
      setLines(lineUniforms);
      setLines(guideUniforms);

      nameMeshes.forEach(({ group, uniforms }) => {
        uniforms.uAlpha.value = 0.5 * frame.nameAlpha[group] * presence;
      });

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
      nameTextures.forEach((nameTexture) => {
        nameTexture.dispose();
      });
    },
  };
}

/**
 * The desk and what stands on it (office spec §3): the monitor, a Logitech MX Keys, a mouse in the spirit of the G502
 * on a small pastel pad, a lamp in the spirit of the Anglepoise Type 75 Mini, a trailing plant, a small photo frame, a
 * succulent, the rose of the planet under its glass globe and a pencil cup. Simple shapes with softened edges, matte
 * materials, muted colours, as the planet.
 */
import {
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  ConeGeometry,
  CubicBezierCurve3,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Float32BufferAttribute,
  FrontSide,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  QuadraticBezierCurve3,
  Quaternion,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  Box3,
  type Curve,
  type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { box, canvasTexture, DEG, isMesh, LAYERS, onLayer, rng, ROOM, SCREEN, std, type Pause } from './common';
import type { PictureData } from './room';

/**
 * Where each object stands on the desk: [x, z], a turn around the vertical axis and, for the mouse on its pad, a lift.
 * The monitor is only slightly turned toward us: at the edge of a wide view, a screen facing the eye looks stretched.
 * The lamp stands between the posters and the window and turns toward the point it lights, on the desk to the left of
 * the keyboard (LAMP_AIM); the rose stands at the back, under the raised monitor, between its foot and the pencil cup.
 */
const PLACES = {
  monitor: [0.62, -0.98, -0.15],
  keyboard: [0.3, -0.72, -0.06],
  pad: [0.67, -0.745, -0.15],
  mouse: [0.67, -0.775, -0.2, 0.0036],
  lamp: [-0.5, -1.04, 0],
  plant: [-0.68, -0.6, 0.4],
  frame: [0.19, -1.07, 0.16],
  succulent: [0.05, -1.08, 0.3],
  rose: [0.85, -1.04, 4.26],
  pencils: [0.8, -0.86, 0],
} as const satisfies Record<string, readonly number[]>;

const LAMP_AIM = [-0.05, -0.8] as const;

const v3 = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);
const lathe = (points: readonly (readonly [number, number])[], material: Material, segments = 64): Mesh =>
  new Mesh(
    new LatheGeometry(
      points.map(([r, y]) => new Vector2(r, y)),
      segments,
    ),
    material,
  );

function woodTexture(): ReturnType<typeof canvasTexture> {
  return canvasTexture(1024, 256, (ctx, w, h) => {
    ctx.fillStyle = '#5a3a26';
    ctx.fillRect(0, 0, w, h);
    const r = rng(41);
    for (let i = 0; i < 150; i += 1) {
      const y = r() * h;
      const amp = 2 + r() * 6;
      ctx.strokeStyle = `rgba(${r() < 0.5 ? '38,22,13' : '118,80,50'},${String(0.07 + r() * 0.16)})`;
      ctx.lineWidth = 0.6 + r() * 2.2;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 16) {
        const yy = y + Math.sin(x * 0.006 + i) * amp + Math.sin(x * 0.021 + i * 3) * amp * 0.3;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
  });
}

/** The screen on its aluminium stand. Its picture is drawn over the render in HTML. */
function buildMonitor(): Group {
  const g = new Group();
  const alu = std(0x9a9da3, 0.35, 0.8);
  const shell = std(0x141518, 0.45, 0.1);
  const cy = 0.257 + SCREEN.h / 2;
  g.add(box(0.27, 0.012, 0.2, alu, 0, 0.006, 0.02, 0.005));
  const neck = box(0.056, cy - 0.08, 0.024, alu, 0, (cy - 0.08) / 2 + 0.01, -0.04, 0.006);
  neck.rotation.x = -0.07;
  g.add(neck);
  g.add(box(SCREEN.w + 0.024, SCREEN.h + 0.03, 0.03, shell, 0, cy - 0.004, -0.002, 0.008));
  const screen = new Mesh(new PlaneGeometry(SCREEN.w, SCREEN.h), std(0x07080b, 0.25, 0.1));
  screen.position.set(0, cy, 0.0135);
  screen.name = 'screen';
  g.add(screen);
  return g;
}

/**
 * A Logitech MX Keys, simplified: a slim graphite slab, a dark back bar and flat rounded keys, with the arrow and
 * navigation keys and the numeric keypad of the full-size model.
 */
function buildKeyboard(): Group {
  const g = new Group();
  const u = 0.0184;
  const W = 0.43;
  const D = 0.131;
  g.add(box(W, 0.011, D, std(0x6b6e74, 0.4, 0.65), 0, 0.0055, 0, 0.0045));
  g.add(box(W - 0.006, 0.004, D - 0.03, std(0x34363b, 0.5, 0.3), 0, 0.0115, 0.009, 0.002));
  g.add(box(W, 0.016, 0.024, std(0x1b1c1f, 0.45, 0.3), 0, 0.008, -D / 2 + 0.012, 0.005));
  const keys: { x: number; z: number; w: number; d: number }[] = [];
  const left = -W / 2 + 0.009;
  const rowZ = (row: number): number => -D / 2 + 0.034 + row * u;
  const add = (x: number, row: number, w = 1, h = 1): void => {
    keys.push({
      x: left + (x + w / 2) * u,
      z: rowZ(row) + ((h - 1) * u) / 2 - (row === 0 ? 0.003 : 0),
      w: w * u - 0.0026,
      d: (row === 0 ? 0.68 : h) * u - 0.0026,
    });
  };
  const run = (start: number, row: number, widths: readonly number[]): void => {
    let x = start;
    widths.forEach((w) => {
      x += w;
      add(x - w, row, w);
    });
  };
  for (let i = 0; i < 13; i += 1) add(i * (14 / 12), 0);
  for (let i = 0; i < 7; i += 1) add(15.4 + i, 0);
  run(0, 1, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2]);
  run(0, 2, [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
  add(13.6, 2, 1.4, 2);
  run(0, 3, [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
  run(0, 4, [1.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.75]);
  run(0, 5, [1.5, 1.25, 1.25, 6.5, 1.25, 1.5, 1.75]);
  for (let i = 0; i < 3; i += 1) {
    add(15.4 + i, 1);
    add(15.4 + i, 2);
    add(15.4 + i, 5);
  }
  add(16.4, 4);
  for (let i = 0; i < 4; i += 1) add(18.8 + i, 1);
  for (let row = 2; row <= 4; row += 1) for (let i = 0; i < 3; i += 1) add(18.8 + i, row);
  add(21.8, 2, 1, 2);
  add(21.8, 4, 1, 2);
  add(18.8, 5, 2);
  add(20.8, 5);
  const cap = new RoundedBoxGeometry(1, 1, 1, 2, 0.2);
  const caps = new InstancedMesh(cap, std(0x222327, 0.55, 0.05), keys.length);
  const m = new Matrix4();
  keys.forEach((k, i) => {
    m.compose(v3(k.x, 0.0158, k.z), new Quaternion(), v3(k.w, 0.0034, k.d));
    caps.setMatrixAt(i, m);
  });
  g.add(caps);
  const tilted = new Group();
  tilted.add(g);
  g.rotation.x = 0.055;
  g.position.y = 0.004;
  return tilted;
}

/**
 * A gaming mouse in the spirit of Grégoire's Logitech G502: a long body that rises toward the back, a wide thumb rest
 * on the left, side buttons, a metal wheel, a glossy black trim and small blue lights. Its front points toward −z.
 */
function buildMouse(): Group {
  const L = 0.132;
  const g = new Group();
  // Height of the back and half width of the body along the length (s = 0 at the front, 1 at the back).
  const curve1d =
    (points: readonly (readonly [number, number])[]) =>
    (s: number): number => {
      for (let i = 1; i < points.length; i += 1) {
        const [s1, v1] = points[i] ?? [1, 0];
        if (s <= s1) {
          const [s0, v0] = points[i - 1] ?? [0, 0];
          const t = (s - s0) / (s1 - s0);
          return v0 + (v1 - v0) * t * t * (3 - 2 * t);
        }
      }
      return points.at(-1)?.[1] ?? 0;
    };
  const close = (s: number): number => Math.pow(Math.max(0, 1 - Math.pow(Math.abs(2 * s - 1), 5)), 1 / 5);
  const topCurve = curve1d([
    [0, 0.02],
    [0.3, 0.029],
    [0.66, 0.04],
    [0.9, 0.035],
    [1, 0.03],
  ]);
  const halfCurve = curve1d([
    [0, 0.024],
    [0.35, 0.03],
    [0.7, 0.031],
    [1, 0.027],
  ]);
  const top = (s: number): number => topCurve(s) * close(s);
  const half = (s: number): number => halfCurve(s) * close(s);
  const thumb = (s: number): number =>
    0.01 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, (s - 0.22) / 0.62))), 0.8);
  // u from 0 (bottom edge) to 1 (crest of the back), on the left (side = −1) or right (side = 1).
  const surface = (s: number, u: number, side: number): Vector3 => {
    const y = top(s) * Math.sin((u * Math.PI) / 2) ** 0.85;
    let x = half(s) * Math.cos((u * Math.PI) / 2) ** 0.7;
    if (side < 0) x += thumb(s) * Math.pow(Math.max(0, 1 - y / 0.015), 2);
    else x -= 0.004 * Math.sin(Math.PI * s) * Math.min(1, Math.max(0, (y - 0.01) / 0.012));
    return v3(side * x, y, (s - 0.5) * L);
  };
  const geo = new SphereGeometry(1, 96, 48);
  const p = geo.getAttribute('position');
  for (let i = 0; i < p.count; i += 1) {
    const vx = p.getX(i);
    const vy = p.getY(i);
    const vz = p.getZ(i);
    const s = (vz + 1) / 2;
    const ring = Math.max(1e-6, Math.sqrt(Math.max(0, 1 - vz * vz)));
    const angle = Math.atan2(vy / ring, vx / ring);
    if (vy >= 0) {
      const side = angle < Math.PI / 2 ? 1 : -1;
      const u = side > 0 ? angle / (Math.PI / 2) : (Math.PI - angle) / (Math.PI / 2);
      const q = surface(s, u, side);
      p.setXYZ(i, q.x, q.y + 0.002, q.z);
    } else {
      const side = vx >= 0 ? 1 : -1;
      const q = surface(s, 0, side);
      p.setXYZ(i, q.x * Math.abs(vx / ring) ** 0.3, 0.002 + vy * 0.002, q.z);
    }
  }
  geo.computeVertexNormals();
  // Black plastic with a weak sheen, so that the warm light of the screen right behind it does not turn it brown.
  const body = new MeshPhysicalMaterial({ color: 0x0b0b0c, roughness: 0.55, specularIntensity: 0.22 });
  const gloss = std(0x0c0c0e, 0.16, 0.45);
  const metal = std(0xb0b3b8, 0.22, 0.9);
  const led = new MeshStandardMaterial({ color: 0x0a6cc0, emissive: 0x1fb8ff, emissiveIntensity: 1.5 });
  g.add(new Mesh(geo, body));
  const onTop = (s: number, x: number, lift = 0.0006): Vector3 => v3(x, top(s) + 0.002 + lift, (s - 0.5) * L);
  // The groove between the two buttons, and the wheel in it.
  const groove = new CatmullRomCurve3([0.02, 0.12, 0.24, 0.34].map((s) => onTop(s, 0, 0.0002)));
  g.add(new Mesh(new TubeGeometry(groove, 16, 0.0011, 6, false), gloss));
  const wheel = new Group();
  const tire = new Mesh(new CylinderGeometry(0.0105, 0.0105, 0.0072, 32), std(0x1a1a1c, 0.7));
  const rim = new Mesh(new CylinderGeometry(0.0098, 0.0098, 0.0082, 32), metal);
  tire.rotation.z = rim.rotation.z = Math.PI / 2;
  wheel.add(rim, tire);
  wheel.position.copy(onTop(0.2, 0, -0.0045));
  g.add(wheel);
  // A glossy black trim along the upper edge of the left side, from the front to the back.
  const trim = [0.12, 0.3, 0.5, 0.7, 0.86].map((s) => surface(s, 0.62, -1).add(v3(0, 0.002, 0)));
  g.add(new Mesh(new TubeGeometry(new CatmullRomCurve3(trim), 32, 0.0019, 8, false), gloss));
  // Two side buttons above the thumb rest, and a sniper button in front of them.
  (
    [
      [0.3, 0.016, 0.017],
      [0.43, 0.016, 0.017],
      [0.19, 0.012, 0.011],
    ] as const
  ).forEach(([s, len, y]) => {
    const q = surface(s, 0.42, -1);
    const button = new Mesh(new RoundedBoxGeometry(0.004, 0.0065, len, 2, 0.0015), gloss);
    button.position.set(q.x - 0.0012, y + 0.002, q.z);
    button.rotation.z = 0.35;
    g.add(button);
  });
  // The three small blue lights of the sensitivity, on the left button.
  [0.25, 0.28, 0.31].forEach((s) => {
    const q = surface(s, 0.86, -1);
    const dot = new Mesh(new BoxGeometry(0.0022, 0.0008, 0.0016), led);
    dot.position.set(q.x, q.y + 0.0022, q.z);
    g.add(dot);
  });
  return g;
}

/** A small mouse pad of pastel blue cloth, with rounded corners. Its blue is stronger than it looks: dusk greys it. */
function buildPad(): Mesh {
  const w = 0.22;
  const d = 0.19;
  const r = 0.014;
  const s = new Shape();
  s.moveTo(-w / 2 + r, -d / 2);
  s.lineTo(w / 2 - r, -d / 2);
  s.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
  s.lineTo(w / 2, d / 2 - r);
  s.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
  s.lineTo(-w / 2 + r, d / 2);
  s.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
  s.lineTo(-w / 2, -d / 2 + r);
  s.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
  const geo = new ExtrudeGeometry(s, {
    depth: 0.0024,
    bevelEnabled: true,
    bevelThickness: 0.0006,
    bevelSize: 0.0008,
    bevelSegments: 2,
    curveSegments: 6,
  });
  geo.rotateX(-Math.PI / 2).translate(0, 0.0006, 0);
  return new Mesh(geo, std(0x6b9ee0, 0.95));
}

/**
 * A desk lamp in the spirit of the Anglepoise Type 75 Mini: a round base, one gently curved arm and a head made of a
 * short cylinder that flares into a bell, lit inside. The lamp is built facing +x, its head aimed at a point of the
 * desk `reach` metres in front of its base. Its `light` child is where the light leaves the bell.
 */
function buildLamp(reach: number): { group: Group; light: Object3D; axis: Vector3 } {
  const g = new Group();
  const paint = std(0x2b2725, 0.5, 0.25);
  const steel = std(0xc9c4bc, 0.3, 0.85);
  g.add(
    lathe(
      [
        [0, 0],
        [0.085, 0],
        [0.0865, 0.004],
        [0.0855, 0.012],
        [0.08, 0.018],
        [0.07, 0.021],
        [0.04, 0.0235],
        [0, 0.024],
      ],
      paint,
    ),
  );
  // The arm rises from just behind the middle of the base, leans back, then bends forward into the joint of the head.
  const joint = v3(-0.02, 0.42, 0);
  const collar = new Mesh(new CylinderGeometry(0.011, 0.011, 0.01, 24), steel);
  collar.position.set(-0.025, 0.027, 0);
  g.add(collar);
  const arm = new CatmullRomCurve3([
    v3(-0.025, 0.02, 0),
    v3(-0.045, 0.15, 0),
    v3(-0.055, 0.28, 0),
    v3(-0.045, 0.37, 0),
    joint.clone(),
  ]);
  g.add(new Mesh(new TubeGeometry(arm, 64, 0.0065, 12, false), paint));
  const knuckle = new Mesh(new CylinderGeometry(0.0085, 0.0085, 0.022, 20), steel);
  knuckle.rotation.x = Math.PI / 2;
  knuckle.position.copy(joint);
  g.add(knuckle);
  // The head, along its own +y from the joint toward the lit point: a rounded back, the short cylinder, the bell.
  const axis = v3(reach, 0, 0).sub(joint).normalize();
  const cyl = 0.045;
  const bell = 0.075;
  const profile: [number, number][] = [
    [0, 0],
    [0.012, 0.002],
    [0.02, 0.006],
    [0.024, 0.012],
    [0.025, 0.02],
    [0.025, cyl],
  ];
  for (let i = 1; i <= 12; i += 1) {
    const t = i / 12;
    profile.push([0.025 + 0.037 * t ** 1.6, cyl + bell * t]);
  }
  const head = new Group();
  head.add(lathe(profile, std(0x2b2725, 0.45, 0.3, { side: FrontSide })));
  // Inside, the bell glows by itself, brightest at the throat and warmer toward the rim, whatever the lights around.
  const inside = lathe(profile, new MeshBasicMaterial({ vertexColors: true, side: BackSide }));
  const ip = inside.geometry.getAttribute('position');
  const glow = new Float32Array(ip.count * 3);
  const throat = new Color(0xffffff);
  const rimColor = new Color(0xf2dcbc);
  for (let i = 0; i < ip.count; i += 1) {
    const k = Math.max(0, Math.min(1, (ip.getY(i) - cyl) / bell)) ** 0.8;
    throat
      .clone()
      .lerp(rimColor, k)
      .toArray(glow, i * 3);
  }
  inside.geometry.setAttribute('color', new BufferAttribute(glow, 3));
  inside.userData.noShadow = true;
  head.add(inside);
  // The bright diffuser at the throat of the bell.
  const bulb = new Mesh(
    new CircleGeometry(0.024, 32).rotateX(-Math.PI / 2),
    new MeshBasicMaterial({ color: 0xfff6e2, side: DoubleSide }),
  );
  bulb.position.y = cyl + 0.006;
  bulb.userData.noShadow = true;
  bulb.name = 'bulb';
  head.add(bulb);
  head.position.copy(joint);
  head.quaternion.setFromUnitVectors(v3(0, 1, 0), axis);
  g.add(head);
  const light = new Object3D();
  light.position.copy(joint).addScaledVector(axis, cyl + bell - 0.01);
  g.add(light);
  return { group: g, light, axis };
}

function leafGeometry(len: number, wid: number): ShapeGeometry {
  const s = new Shape();
  s.moveTo(0, len * 0.06);
  s.bezierCurveTo(wid * 0.25, -len * 0.06, wid * 0.62, len * 0.1, wid * 0.48, len * 0.42);
  s.bezierCurveTo(wid * 0.36, len * 0.66, wid * 0.1, len * 0.86, 0, len);
  s.bezierCurveTo(-wid * 0.1, len * 0.86, -wid * 0.36, len * 0.66, -wid * 0.48, len * 0.42);
  s.bezierCurveTo(-wid * 0.62, len * 0.1, -wid * 0.25, -len * 0.06, 0, len * 0.06);
  const g = new ShapeGeometry(s, 12);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i += 1) {
    const x = p.getX(i);
    const y = p.getY(i);
    p.setZ(i, Math.abs(x) * 0.12 + Math.sin((y / len) * Math.PI) * len * 0.14 - (y / len) ** 2 * len * 0.12);
  }
  g.computeVertexNormals();
  return g;
}

/** A trailing heart-leaf plant in a white pot, kept small and low in the corner so that it hides little of the wall. */
function buildPlant(): Group {
  const g = new Group();
  const r = rng(77);
  g.add(
    lathe(
      [
        [0, 0],
        [0.07, 0],
        [0.08, 0.01],
        [0.092, 0.13],
        [0.098, 0.15],
        [0.088, 0.152],
        [0.084, 0.135],
      ],
      std(0xeeebe5, 0.55),
    ),
  );
  const soil = new Mesh(new CircleGeometry(0.084, 40), std(0x2b1f18, 1));
  soil.rotation.x = -Math.PI / 2;
  soil.position.y = 0.135;
  g.add(soil);
  const stemMat = std(0x3e6a33, 0.7);
  const leafMats = [0x264d25, 0x33612e, 0x416f34].map((c) => std(c, 0.75, 0, { side: DoubleSide }));
  const leafSizes = [
    [0.055, 0.048],
    [0.068, 0.058],
    [0.047, 0.04],
  ] as const;
  const leafGeos = leafSizes.map(([len, wid]) => leafGeometry(len, wid));
  const leafMat = (i: number): Material => leafMats[i % 3] ?? stemMat;
  // Nothing may go through the pot: below the soil a point stays outside it; between the soil and the rim it is
  // either well inside or outside.
  const potR = (y: number): number =>
    y < 0.01 ? 0.07 + y : y < 0.13 ? 0.08 + ((y - 0.01) / 0.12) * 0.012 : 0.092 + ((y - 0.13) / 0.02) * 0.006;
  const clear = (p: Vector3): boolean => {
    const rr = Math.hypot(p.x, p.z);
    if (p.y > 0.16) return true;
    if (p.y > 0.135 && rr < 0.074) return true;
    return rr > potR(Math.max(0, p.y)) + 0.006;
  };
  // Where the camera is, seen from the plant (in the plant's own frame).
  const [px, pz, turn] = PLACES.plant;
  const w = v3(-px, 1.2 - ROOM.deskY - 0.2, -pz).normalize();
  const toViewer = v3(
    w.x * Math.cos(turn) - w.z * Math.sin(turn),
    w.y + 0.5,
    w.x * Math.sin(turn) + w.z * Math.cos(turn),
  ).normalize();
  const vines = 14;
  for (let v = 0; v < vines; v += 1) {
    const a = (v / vines) * Math.PI * 2 + r() * 0.4;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const trailing = v % 3 === 0;
    let curve: Curve<Vector3>;
    if (trailing) {
      // Trailing stems climb over the rim before they hang down outside the pot.
      const out = 0.16 + r() * 0.08;
      const drop = 0.04 + r() * 0.1;
      curve = new CubicBezierCurve3(
        v3(c * 0.03, 0.14, sn * 0.03),
        v3(c * 0.075, 0.215, sn * 0.075),
        v3(c * 0.15, 0.205, sn * 0.15),
        v3(c * out, 0.15 - drop, sn * out),
      );
    } else {
      const reach = 0.1 + r() * 0.1;
      const up = 0.07 + r() * 0.11;
      curve = new QuadraticBezierCurve3(
        v3(c * 0.02, 0.14, sn * 0.02),
        v3(c * reach * 0.45, 0.14 + up * 0.7, sn * reach * 0.45),
        v3(c * reach, 0.14 + up, sn * reach),
      );
    }
    if (!curve.getPoints(24).every(clear)) continue;
    const fits = (leaf: Mesh, kind: number): boolean => {
      leaf.updateMatrix();
      const [len, wid] = leafSizes[kind] ?? [0, 0];
      return (
        [
          [0, len],
          [wid * 0.5, len * 0.42],
          [-wid * 0.5, len * 0.42],
          [0, len * 0.06],
        ] as const
      ).every(([x, y]) => clear(v3(x, y, 0).applyMatrix4(leaf.matrix)));
    };
    // A stem always ends on a leaf that carries it on, its face turned toward the viewer so that it never shows as a
    // bare spike; if that leaf would touch the pot, the stem is cut back.
    let tip = 0;
    let tipLeaf: Mesh | null = null;
    for (let tt = 1; tt > 0.35 && !tipLeaf; tt -= 0.07) {
      const kind = v % 3;
      const leaf = new Mesh(leafGeos[kind], leafMat(v));
      const T = curve.getTangent(tt);
      const P = curve.getPoint(tt);
      const up = toViewer.clone().addScaledVector(T, -toViewer.dot(T));
      if (up.lengthSq() < 0.04) up.set(P.x, 0, P.z);
      up.normalize();
      const side = new Vector3().crossVectors(T, up).normalize();
      leaf.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(side, T, up.crossVectors(side, T)));
      leaf.position.copy(P);
      leaf.scale.setScalar(0.85 + r() * 0.25);
      if (fits(leaf, kind)) {
        tip = tt;
        tipLeaf = leaf;
      }
    }
    if (!tipLeaf) continue;
    const stem: Vector3[] = [];
    for (let i = 0; i <= 20; i += 1) stem.push(curve.getPoint((i / 20) * tip));
    g.add(new Mesh(new TubeGeometry(new CatmullRomCurve3(stem), 20, 0.0025, 6, false), stemMat));
    g.add(tipLeaf);
    const n = 4 + Math.floor(r() * 3);
    for (let k = 0; k < n; k += 1) {
      const t = (0.25 + (k / n) * 0.65) * tip;
      const p = curve.getPoint(t);
      const tan = curve.getTangent(t);
      const kind = (v + k) % 3;
      const leaf = new Mesh(leafGeos[kind], leafMat(v * 2 + k));
      leaf.position.copy(p);
      const side = k % 2 ? 1 : -1;
      const out = v3(tan.x, 0, tan.z).normalize();
      const yaw = Math.atan2(out.x, out.z) + side * (0.6 + r() * 0.5);
      leaf.rotation.set(-0.9 + r() * 0.7 + (trailing ? 0.9 : 0), yaw, side * (0.3 + r() * 0.3), 'YXZ');
      leaf.scale.setScalar(0.8 + r() * 0.5);
      if (fits(leaf, kind)) g.add(leaf);
    }
  }
  return g;
}

/**
 * A small photo frame standing on the desk, leaning back on its strut: a slim black frame around a photo in the 4:5
 * format, whose face is white (the site lays a photo over it, picked at random).
 */
function buildDeskFrame(): Group {
  const g = new Group();
  const iw = 0.1;
  const ih = 0.125;
  const bd = 0.011;
  const ow = iw + 2 * bd;
  const oh = ih + 2 * bd;
  const face = new Group();
  const black = std(0x1d1b1a, 0.55);
  face.add(box(ow, bd, 0.012, black, 0, oh - bd / 2, 0, 0.002));
  face.add(box(ow, bd, 0.012, black, 0, bd / 2, 0, 0.002));
  face.add(box(bd, ih, 0.012, black, -ow / 2 + bd / 2, oh / 2, 0, 0.002));
  face.add(box(bd, ih, 0.012, black, ow / 2 - bd / 2, oh / 2, 0, 0.002));
  face.add(box(ow - 0.004, oh - 0.004, 0.003, std(0x2a2725, 0.8), 0, oh / 2, -0.0045));
  const picture = box(iw, ih, 0.0015, std(0xffffff, 0.9), 0, oh / 2, 0.0035);
  picture.name = 'picture-desk';
  const data: PictureData = { type: 'photo', w: iw, h: ih, d: 0.0015 };
  picture.userData = data;
  face.add(picture);
  face.rotation.x = -11 * DEG;
  g.add(face);
  const strut = box(0.018, 0.12, 0.004, black, 0, 0.055, -0.045);
  strut.rotation.x = 0.42;
  g.add(strut);
  return g;
}

/**
 * A succulent leaf: flat and pointed, spoon-shaped, fleshy, thicker at its base, its face a little domed and its back
 * rounder, curling up toward the tip. It lies along +z from its base at the origin, face up; its tip blushes.
 */
function succulentLeaf(
  len: number,
  wid: number,
  thick: number,
  curl: number,
  base: number,
  tip: number,
  blush: number,
): BufferGeometry {
  const NU = 22;
  const NV = 8;
  const width = (u: number): number => {
    if (u < 0.6) return 0.42 + 0.58 * Math.sin((u / 0.6) * (Math.PI / 2));
    const t = (u - 0.6) / 0.4;
    return Math.sqrt(1 - t * t) * Math.pow(1 - t, 0.35);
  };
  const pos: number[] = [];
  const col: number[] = [];
  const c0 = new Color(base);
  const c1 = new Color(tip);
  const c = new Color();
  [0.42, -0.72].forEach((side) => {
    for (let i = 0; i <= NU; i += 1) {
      const u = i / NU;
      const half = (wid * width(u)) / 2;
      const th = thick * (1 - 0.55 * u);
      const lift = curl * u * u * len;
      c.copy(c0).lerp(c1, blush * Math.pow(Math.max(0, (u - 0.55) / 0.45), 1.5));
      for (let j = 0; j <= NV; j += 1) {
        const v = (j / NV) * 2 - 1;
        pos.push(v * half, lift + side * th * (1 - v * v * v * v), u * len);
        col.push(c.r, c.g, c.b);
      }
    }
  });
  const row = NV + 1;
  const off = (NU + 1) * row;
  const index: number[] = [];
  for (let i = 0; i < NU; i += 1) {
    for (let j = 0; j < NV; j += 1) {
      const a = i * row + j;
      index.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
      index.push(off + a, off + a + 1, off + a + row, off + a + 1, off + a + row + 1, off + a + row);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/**
 * A succulent in a white pot beside the photo frame, about the size of the frame: an echeveria, a compact rosette of
 * flat, pointed leaves in rings of 13, 8, 5 and 3 turned by the golden angle, within the rim so the soil shows.
 */
function buildSucculent(): Group {
  const g = new Group();
  g.add(
    lathe(
      [
        [0, 0],
        [0.019, 0],
        [0.02, 0.002],
        [0.0245, 0.035],
        [0.0275, 0.036],
        [0.0275, 0.046],
        [0.0255, 0.046],
        [0.0248, 0.04],
        [0, 0.04],
      ],
      std(0xeeebe5, 0.55),
      48,
    ),
  );
  // Coarse soil, a little heaped, with a few grains on it.
  const soil = new Mesh(new CircleGeometry(0.0246, 36), std(0x2e2119, 1));
  soil.rotation.x = -Math.PI / 2;
  soil.position.y = 0.0405;
  g.add(soil);
  const r = rng(31);
  const grain = new IcosahedronGeometry(1, 0);
  const grainMats = [0x3d2c20, 0x4b3828, 0x261a13].map((cc) => std(cc, 1));
  for (let i = 0; i < 110; i += 1) {
    const a = r() * Math.PI * 2;
    const d = 0.008 + Math.sqrt(r()) * 0.0155;
    const m = new Mesh(grain, grainMats[i % 3]);
    const s = 0.0008 + r() * 0.0009;
    m.scale.set(s, s * 0.7, s);
    m.position.set(Math.cos(a) * d, 0.0408, Math.sin(a) * d);
    m.rotation.set(r() * 3, r() * 3, r() * 3);
    g.add(m);
  }
  const mat = std(0xffffff, 0.6, 0, { vertexColors: true });
  const rings = [
    {
      n: 13,
      len: 0.022,
      wid: 0.0122,
      thick: 0.0044,
      rise: 0.55,
      curl: 0.2,
      base: 0x86b86a,
      tip: 0xd88a80,
      blush: 0.85,
    },
    {
      n: 8,
      len: 0.0185,
      wid: 0.0115,
      thick: 0.0046,
      rise: 0.88,
      curl: 0.16,
      base: 0x7fbc56,
      tip: 0xc9967a,
      blush: 0.5,
    },
    {
      n: 5,
      len: 0.0145,
      wid: 0.0095,
      thick: 0.0044,
      rise: 1.12,
      curl: 0.1,
      base: 0x78bf46,
      tip: 0x9fbe5c,
      blush: 0.25,
    },
    { n: 3, len: 0.011, wid: 0.0078, thick: 0.004, rise: 1.3, curl: 0.06, base: 0x86c94a, tip: 0x86c94a, blush: 0 },
  ];
  const golden = Math.PI * (3 - Math.sqrt(5));
  let k = 0;
  rings.forEach((ring, j) => {
    const geo = succulentLeaf(ring.len, ring.wid, ring.thick, ring.curl, ring.base, ring.tip, ring.blush);
    for (let i = 0; i < ring.n; i += 1, k += 1) {
      const holder = new Group();
      holder.rotation.y = k * golden;
      holder.position.y = 0.0415 + j * 0.0022;
      const tilt = new Group();
      tilt.rotation.x = -(ring.rise + (r() - 0.5) * 0.12);
      const leaf = new Mesh(geo, mat);
      leaf.position.z = 0.0012;
      tilt.add(leaf);
      holder.add(tilt);
      g.add(holder);
    }
  });
  g.scale.setScalar(1.9);
  return g;
}

/** Stands the rose of the planet upright, from the foot of its stem toward its bloom, at the given height. */
function standRose(model: Object3D, height: number, y0: number): Group {
  const rose = model.clone(true);
  rose.position.set(0, 0, 0);
  rose.scale.set(1, 1, 1);
  rose.quaternion.setFromUnitVectors(v3(0.013, -0.701, -0.713).normalize(), v3(0, 1, 0));
  rose.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(rose);
  rose.scale.setScalar(height / (bounds.max.y - bounds.min.y));
  rose.updateMatrixWorld(true);
  bounds.setFromObject(rose);
  rose.position.set(-(bounds.min.x + bounds.max.x) / 2, y0 - bounds.min.y, -(bounds.min.z + bounds.max.z) / 2);
  // Opaque petals sort well under the glass; softer highlights under the desk lamp, much closer than the planet's sun.
  rose.traverse((node) => {
    if (!isMesh(node) || Array.isArray(node.material)) return;
    const material = node.material.clone();
    material.transparent = false;
    material.opacity = 1;
    material.depthWrite = true;
    if (material instanceof MeshPhysicalMaterial) material.specularIntensity *= 0.5;
    node.material = material;
  });
  const g = new Group();
  g.add(rose);
  return g;
}

function simpleRose(): Group {
  const g = new Group();
  const stem = new CatmullRomCurve3([
    v3(0, 0.024, 0),
    v3(0.004, 0.07, 0.002),
    v3(-0.003, 0.12, -0.002),
    v3(0, 0.15, 0),
  ]);
  g.add(new Mesh(new TubeGeometry(stem, 24, 0.0022, 8, false), std(0x3b6630, 0.7)));
  const leafGeo = leafGeometry(0.03, 0.018);
  (
    [
      [0.075, 0.9, 0.5],
      [0.1, -0.8, 2.6],
    ] as const
  ).forEach(([y, tilt, yaw]) => {
    const leaf = new Mesh(leafGeo, std(0x3f6d33, 0.65, 0, { side: DoubleSide }));
    leaf.position.set(0, y, 0);
    leaf.rotation.set(tilt, yaw, 0, 'YXZ');
    g.add(leaf);
  });
  // The bloom: three rings of cupped petals around a tight heart.
  const red = [0x9c1529, 0xb21e33, 0x87111f].map((c) => std(c, 0.55, 0, { side: DoubleSide }));
  const bloom = new Group();
  bloom.position.y = 0.158;
  const heart = new Mesh(new SphereGeometry(0.011, 20, 14), red[2]);
  heart.scale.set(1, 1.25, 1);
  bloom.add(heart);
  const petalGeo = new SphereGeometry(0.018, 20, 12, 0, Math.PI * 0.9, 0.15 * Math.PI, 0.6 * Math.PI);
  (
    [
      [5, 0.009, 0.25, 0.9],
      [5, 0.013, 0.55, 1.05],
      [6, 0.016, 0.9, 1.2],
    ] as const
  ).forEach(([count, rad, open, scale], ri) => {
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2 + ri * 0.6;
      const petal = new Mesh(petalGeo, red[(i + ri) % 3]);
      petal.position.set(Math.cos(a) * rad * 0.5, -0.002, Math.sin(a) * rad * 0.5);
      petal.rotation.set(0, -a + Math.PI / 2, 0, 'YXZ');
      petal.rotateX(-open * 0.6);
      petal.scale.setScalar(scale);
      bloom.add(petal);
    }
  });
  g.add(bloom);
  return g;
}

/** The rose under its glass globe: the rose of the planet itself, or a simplified one without the model. */
function buildRose(model: Object3D | null): Group {
  const g = new Group();
  const R = 0.064;
  const base = new Mesh(new CylinderGeometry(R + 0.01, R + 0.014, 0.024, 48), std(0x6b4a33, 0.55));
  base.position.y = 0.012;
  g.add(base);
  g.add(model ? standRose(model, 0.18, 0.024) : simpleRose());
  // The globe: a cylinder of glass capped by a half sphere.
  const glass = new MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.04,
    transparent: true,
    opacity: 0.16,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.6,
    side: DoubleSide,
    depthWrite: false,
  });
  const tube = new Mesh(new CylinderGeometry(R, R, 0.17, 64, 1, true), glass);
  tube.position.y = 0.024 + 0.085;
  const dome = new Mesh(new SphereGeometry(R, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2), glass);
  dome.position.y = 0.024 + 0.17;
  tube.userData.noShadow = dome.userData.noShadow = true;
  tube.renderOrder = dome.renderOrder = 1;
  g.add(tube, dome);
  return g;
}

/** A ceramic cup with a real wall, and pencils that lean against the inside of it without going through. */
function buildPencils(): Group {
  const g = new Group();
  g.add(
    lathe(
      [
        [0, 0],
        [0.036, 0],
        [0.037, 0.003],
        [0.0395, 0.103],
        [0.0392, 0.1055],
        [0.0365, 0.1055],
        [0.0362, 0.103],
        [0.0338, 0.006],
        [0, 0.006],
      ],
      std(0x8ea18b, 0.75),
      48,
    ),
  );
  const r = rng(9);
  const colors = [0xe9b44c, 0x1d1d20, 0xc0392b, 0x2f5d8a, 0xe9b44c, 0x3c3c40];
  colors.forEach((c, i) => {
    const len = 0.13 + r() * 0.04;
    const pencil = new Group();
    const body = new Mesh(new CylinderGeometry(0.0036, 0.0036, len, 6), std(c, 0.6));
    body.position.y = len / 2;
    const tip = new Mesh(new ConeGeometry(0.0036, 0.014, 6), std(0xd9b38c, 0.8));
    tip.position.y = len + 0.007;
    pencil.add(body, tip);
    // From near the middle of the bottom, each pencil leans outward and stays clear of the rim.
    const a = (i / colors.length) * Math.PI * 2;
    const lean = 0.16 + r() * 0.06;
    pencil.position.set(Math.cos(a) * 0.008, 0.012, Math.sin(a) * 0.008);
    pencil.rotation.set(Math.sin(a) * lean, 0, -Math.cos(a) * lean);
    g.add(pencil);
  });
  return g;
}

export interface Desk {
  group: Group;
  monitor: Group;
  lamp: Group;
  /** Where the lamp's light leaves its bell, and the way it goes (in the lamp's frame). */
  lampLight: Object3D;
  lampAxis: Vector3;
}

/** The desk and its objects; `pause` lets a frame through between the objects. */
export async function buildDesk(roseModel: Object3D | null, pause: Pause): Promise<Desk> {
  const g = new Group();
  const { deskY, deskFront, wallZ } = ROOM;
  const wood = woodTexture();
  wood.repeat.set(2, 1);
  g.add(
    box(
      3.4,
      0.036,
      deskFront - wallZ - 0.004,
      std(0xffffff, 0.4, 0, { map: wood }),
      -0.1,
      deskY - 0.018,
      (wallZ + deskFront) / 2 - 0.002,
      0.008,
    ),
  );
  const lamp = buildLamp(Math.hypot(LAMP_AIM[0] - PLACES.lamp[0], LAMP_AIM[1] - PLACES.lamp[1]));
  const builders: Record<keyof typeof PLACES, () => Object3D> = {
    monitor: buildMonitor,
    keyboard: buildKeyboard,
    pad: buildPad,
    mouse: buildMouse,
    lamp: () => lamp.group,
    plant: buildPlant,
    rose: () => buildRose(roseModel),
    pencils: buildPencils,
    frame: buildDeskFrame,
    succulent: buildSucculent,
  };
  const objects = {} as Record<keyof typeof PLACES, Object3D>;
  let done = 'desk top';
  for (const [name, build] of Object.entries(builders) as [keyof typeof PLACES, () => Object3D][]) {
    await pause(done);
    objects[name] = build();
    done = name;
  }
  await pause(done);
  for (const [name, object] of Object.entries(objects) as [keyof typeof PLACES, Object3D][]) {
    const place: readonly number[] = PLACES[name];
    const [x = 0, z = 0, turn = 0, lift = 0] = place;
    object.position.set(x, deskY + lift, z);
    object.rotation.y = name === 'lamp' ? Math.atan2(z - LAMP_AIM[1], LAMP_AIM[0] - x) : turn;
    g.add(object);
  }
  onLayer(g, LAYERS.desk);
  return {
    group: g,
    monitor: objects.monitor as Group,
    lamp: lamp.group,
    lampLight: lamp.light,
    lampAxis: lamp.axis,
  };
}

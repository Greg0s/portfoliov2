// The office at the end of the journey: a first-person view from the desk, toward the window and the city.
// Units are metres. The floor of the flat is at y = 0 and the camera looks toward -z.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const LAYERS = { city: 1, room: 2, desk: 3 };

// The two moments of the site. `sky` runs from the top of the frame down to the horizon. At dusk the sun, a disc a little
// larger than life (`sunDisc`, degrees), sets behind the hills in a dip between two of them, where the sky glows.
export const MOMENTS = {
  aube: {
    sky: ['#101834', '#27366a', '#6c68a0', '#cb94a2', '#eec29f'],
    glow: { azimuth: -15, color: '#ffe4b8', strength: 0.5 },
    city: { hemi: ['#8f9bd2', '#2a2734', 1.2], sun: ['#ffc6a6', 0.5], fill: ['#a3b2ea', 0.45], lit: 0.12, litGlow: 0.85, lamps: 2.2, fog: '#c9a3b3', hills: '#6f6f9c' },
    room: { hemi: ['#8c92c6', '#2a2430', 0.4], window: ['#c8b8ea', 3.4], bounce: ['#bdb9dc', 1.2], lamp: ['#ffb46a', 7], screen: ['#ffb07a', 0.8], exposure: 1 },
  },
  crepuscule: {
    sky: ['#121538', '#3b3172', '#a2567b', '#e7845a', '#f8b26b'],
    glow: { azimuth: -9.5, color: '#ffd38c', strength: 0.7 },
    sunDisc: { elevation: 2.05, size: 2.4 },
    city: { hemi: ['#b391b6', '#2d1d23', 1.1], sun: ['#ff9a5a', 0.85], fill: ['#ab9cdb', 0.38], lit: 0.38, litGlow: 1.2, lamps: 3.5, fog: '#e09a7c', hills: '#9b6377' },
    room: { hemi: ['#a67f99', '#2c1e1c', 0.4], window: ['#ffa47c', 4.1], bounce: ['#dcb9a8', 1.2], lamp: ['#ffae60', 8], screen: ['#ffa868', 0.9], exposure: 1 },
  },
};

// The two framings. Angles are in degrees; the pitch is positive when looking up. On mobile the eye stands a little
// higher and to the right: the sky of the window at the top for the contact, the screen, the rose and the pencil cup
// to the right, the town to the left of the screen.
export const FRAMINGS = {
  desktop: { w: 1440, h: 900, fov: 62, pos: [0, 1.2, 0], pitch: -3, yaw: 0 },
  mobile: { w: 390, h: 844, fov: 80, pos: [0.1, 1.4, 0.35], pitch: 7, yaw: -13 },
};

// The wall in front of the desk, its window, and the desk.
export const ROOM = {
  wallZ: -1.2,
  wallT: 0.24,
  win: { x0: -0.47, x1: 1.6, y0: 0.78, y1: 2.5 },
  height: 2.7,
  deskY: 0.74,
  deskFront: -0.36,
};

// The picture of the monitor, in the 16:10 format of a classic desk screen (a 32-inch panel).
export const SCREEN = { w: 0.7, h: 0.4375 };

// Where each object stands on the desk: [x, z], a turn around the vertical axis and, for the mouse on its pad, a lift.
// The monitor is only slightly turned toward us: at the edge of a wide view, a screen facing the eye looks stretched.
// The lamp stands between the posters and the window and turns toward the point it lights, on the desk to the left of
// the keyboard (LAMP_AIM); the rose stands at the back, under the raised monitor, between its foot and the pencil cup.
const PLACES = {
  monitor: [0.62, -0.98, -0.15],
  keyboard: [0.3, -0.72, -0.06],
  pad: [0.67, -0.745, -0.15],
  mouse: [0.67, -0.775, -0.2, 0.0036],
  lamp: [-0.5, -1.04],
  plant: [-0.68, -0.6, 0.4],
  frame: [0.19, -1.07, 0.16],
  rose: [0.85, -1.04, 4.26],
  pencils: [0.8, -0.86, 0],
};

const LAMP_AIM = [-0.05, -0.8];

const DEG = Math.PI / 180;

const rng = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const std = (color, roughness = 0.85, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

function canvasTexture(w, h, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// Puts every mesh of an object on one render layer (lights stay visible to every layer).
function onLayer(obj, layer, shadows = true) {
  obj.traverse((o) => {
    if (o.isMesh) {
      o.layers.set(layer);
      o.castShadow = shadows && !o.userData.noShadow;
      o.receiveShadow = shadows;
    }
  });
  return obj;
}

function box(w, h, d, material, x, y, z, radius = 0) {
  const g = radius ? new RoundedBoxGeometry(w, h, d, 3, radius) : new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(g, material);
  m.position.set(x, y, z);
  return m;
}

function colorize(g, color) {
  const c = new THREE.Color(color);
  const a = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) c.toArray(a, i);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

export function makeCamera(framing, { overscan = 0, ...overrides } = {}) {
  const f = { ...FRAMINGS[framing], ...overrides };
  const fov = (2 * Math.atan(Math.tan((f.fov * DEG) / 2) * (1 + 2 * overscan))) / DEG;
  const cam = new THREE.PerspectiveCamera(fov, f.w / f.h, 0.03, 12000);
  cam.position.set(...f.pos);
  cam.rotation.order = 'YXZ';
  cam.rotation.set(f.pitch * DEG, f.yaw * DEG, 0);
  cam.updateMatrixWorld();
  return cam;
}

// The point of the front wall seen at a given fraction of the desktop frame.
function wallPoint(camera, fx, fy) {
  const p = new THREE.Vector3(fx * 2 - 1, 1 - fy * 2, 0.5).unproject(camera);
  const dir = p.sub(camera.position).normalize();
  return camera.position.clone().addScaledVector(dir, (ROOM.wallZ - camera.position.z) / dir.z);
}

// ---------- The room: wall, window and the frames on the wall ----------

function buildRoom() {
  const { wallZ, wallT, win, height } = ROOM;
  const g = new THREE.Group();
  const plaster = std(0xe6ddcf, 0.95);
  // The wall in one piece, so that no seam lets the sky through, and the ceiling (seen on mobile).
  const outline = new THREE.Shape([new THREE.Vector2(-3.4, 0), new THREE.Vector2(3.4, 0), new THREE.Vector2(3.4, height), new THREE.Vector2(-3.4, height)]);
  outline.holes.push(new THREE.Path([new THREE.Vector2(win.x0, win.y0), new THREE.Vector2(win.x0, win.y1), new THREE.Vector2(win.x1, win.y1), new THREE.Vector2(win.x1, win.y0)]));
  const wall = new THREE.Mesh(new THREE.ExtrudeGeometry(outline, { depth: wallT, bevelEnabled: false }), plaster);
  wall.position.z = wallZ - wallT;
  g.add(wall);
  g.add(box(6.8, 0.05, 3, std(0xb9b0a4, 0.95), 0, height + 0.025, wallZ + 1.5));

  // A wide single pane that runs out of the frame on the right, in a slim white frame set against the inner face of
  // the wall. There is no glass to render.
  const joinery = std(0xf2f0eb, 0.45);
  const fz = wallZ - 0.04;
  const W = win.x1 - win.x0;
  const H = win.y1 - win.y0;
  const cx = (win.x0 + win.x1) / 2;
  const cy = (win.y0 + win.y1) / 2;
  const fw = 0.045;
  const ring = (inset, width, depth, z) => {
    g.add(box(width, H - 2 * inset, depth, joinery, win.x0 + inset + width / 2, cy, z, 0.004));
    g.add(box(width, H - 2 * inset, depth, joinery, win.x1 - inset - width / 2, cy, z, 0.004));
    g.add(box(W - 2 * inset, width, depth, joinery, cx, win.y1 - inset - width / 2, z, 0.004));
    g.add(box(W - 2 * inset, width, depth, joinery, cx, win.y0 + inset + width / 2, z, 0.004));
  };
  ring(0, fw, 0.06, fz);
  ring(fw - 0.004, 0.026, 0.045, fz + 0.022);

  // A slim stone sill under the frame.
  g.add(box(W + 0.06, 0.022, 0.05, std(0xcfc6b8, 0.7), cx, win.y0 - 0.011, wallZ + 0.012, 0.004));

  // The pictures stuck straight onto the wall with blu-tack (nothing shows), filling the wall left of the window,
  // behind the contact text, the lamp and the plant if need be. Each one holds a type of image (film poster, film
  // still, painting, photo, album cover) in a format close to that of its own pictures, so that they are barely
  // cropped; the site lays one of them over it, picked at random, so their faces are white here and take the light of
  // the room. `at` is the top-left corner as a fraction of the desktop frame, `w` the width of the picture in metres,
  // `ratio` its width over its height. Posters and covers are printed to the edge; photos and film stills have a thin
  // white border, paintings a wide one, as art prints.
  const cam = makeCamera('desktop');
  const frames = [
    { id: 'film', type: 'film', kind: 'print', at: [-0.0347, 0.0178], w: 0.36, ratio: 16 / 9 },
    { id: 'peinture', type: 'peinture', kind: 'art', at: [0.1424, 0.0178], w: 0.29, ratio: 16 / 9 },
    { id: 'affiche', type: 'affiche', kind: 'poster', at: [-0.0208, 0.1889], w: 0.417, ratio: 2 / 3 },
    { id: 'photo', type: 'photo', kind: 'print', at: [0.1819, 0.1911], w: 0.195, ratio: 4 / 5 },
    { id: 'photo-paysage', type: 'photo', kind: 'print', at: [0.1819, 0.3911], w: 0.21, ratio: 4 / 3 },
    { id: 'pochette', type: 'pochette', kind: 'poster', at: [0.1819, 0.5322], w: 0.224, ratio: 1 },
  ];
  const BORDER = { poster: 0, print: 0.007, art: 0.022 };
  const paper = std(0xf3efe7, 0.9);
  const blank = std(0xffffff, 0.9);
  frames.forEach((f, i) => {
    const a = wallPoint(cam, f.at[0], f.at[1]);
    const iw = f.w;
    const ih = f.w / f.ratio;
    const bd = BORDER[f.kind];
    const sw = iw + 2 * bd;
    const sh = ih + 2 * bd;
    const x = a.x + sw / 2;
    const y = a.y - sh / 2;
    const tilt = (i % 2 ? 1 : -1) * (f.kind === 'poster' ? 0.006 : 0.012);
    if (bd) {
      const sheet = box(sw, sh, 0.0015, paper, x, y, wallZ + 0.002);
      sheet.rotation.z = tilt;
      g.add(sheet);
    }
    const img = box(iw, ih, 0.0015, blank, x, y, wallZ + (bd ? 0.0032 : 0.002));
    img.rotation.z = tilt;
    img.name = 'picture-' + f.id;
    img.userData = { type: f.type, w: iw, h: ih, d: 0.0015 };
    g.add(img);
  });
  return onLayer(g, LAYERS.room);
}

// ---------- The desk and what stands on it ----------

function woodTexture() {
  return canvasTexture(1024, 256, (ctx, w, h) => {
    ctx.fillStyle = '#5a3a26';
    ctx.fillRect(0, 0, w, h);
    const r = rng(41);
    for (let i = 0; i < 150; i++) {
      const y = r() * h;
      const amp = 2 + r() * 6;
      ctx.strokeStyle = `rgba(${r() < 0.5 ? '38,22,13' : '118,80,50'},${0.07 + r() * 0.16})`;
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

// The screen on its aluminium stand. Its picture is drawn over the render in HTML.
function buildMonitor() {
  const g = new THREE.Group();
  const alu = std(0x9a9da3, 0.35, 0.8);
  const shell = std(0x141518, 0.45, 0.1);
  const cy = 0.257 + SCREEN.h / 2;
  g.add(box(0.27, 0.012, 0.2, alu, 0, 0.006, 0.02, 0.005));
  const neck = box(0.056, cy - 0.08, 0.024, alu, 0, (cy - 0.08) / 2 + 0.01, -0.04, 0.006);
  neck.rotation.x = -0.07;
  g.add(neck);
  g.add(box(SCREEN.w + 0.024, SCREEN.h + 0.03, 0.03, shell, 0, cy - 0.004, -0.002, 0.008));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN.w, SCREEN.h), std(0x07080b, 0.25, 0.1));
  screen.position.set(0, cy, 0.0135);
  screen.name = 'screen';
  g.add(screen);
  return g;
}

// A Logitech MX Keys, simplified: a slim graphite slab, a dark back bar and flat rounded keys,
// with the arrow and navigation keys and the numeric keypad of the full-size model.
function buildKeyboard() {
  const g = new THREE.Group();
  const u = 0.0184;
  const W = 0.43;
  const D = 0.131;
  g.add(box(W, 0.011, D, std(0x6b6e74, 0.4, 0.65), 0, 0.0055, 0, 0.0045));
  g.add(box(W - 0.006, 0.004, D - 0.03, std(0x34363b, 0.5, 0.3), 0, 0.0115, 0.009, 0.002));
  g.add(box(W, 0.016, 0.024, std(0x1b1c1f, 0.45, 0.3), 0, 0.008, -D / 2 + 0.012, 0.005));
  const keys = [];
  const left = -W / 2 + 0.009;
  const rowZ = (row) => -D / 2 + 0.034 + row * u;
  const add = (x, row, w = 1, h = 1) => keys.push({ x: left + (x + w / 2) * u, z: rowZ(row) + ((h - 1) * u) / 2 - (row === 0 ? 0.003 : 0), w: w * u - 0.0026, d: (row === 0 ? 0.68 : h) * u - 0.0026 });
  const run = (x, row, widths) => widths.forEach((w) => add((x += w) - w, row, w));
  for (let i = 0; i < 13; i++) add(i * (14 / 12), 0);
  for (let i = 0; i < 7; i++) add(15.4 + i, 0);
  run(0, 1, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2]);
  run(0, 2, [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
  add(13.6, 2, 1.4, 2);
  run(0, 3, [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
  run(0, 4, [1.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.75]);
  run(0, 5, [1.5, 1.25, 1.25, 6.5, 1.25, 1.5, 1.75]);
  for (let i = 0; i < 3; i++) add(15.4 + i, 1), add(15.4 + i, 2), add(15.4 + i, 5);
  add(16.4, 4);
  for (let i = 0; i < 4; i++) add(18.8 + i, 1);
  for (let row = 2; row <= 4; row++) for (let i = 0; i < 3; i++) add(18.8 + i, row);
  add(21.8, 2, 1, 2);
  add(21.8, 4, 1, 2);
  add(18.8, 5, 2);
  add(20.8, 5);
  const cap = new RoundedBoxGeometry(1, 1, 1, 2, 0.2);
  const inst = new THREE.InstancedMesh(cap, std(0x222327, 0.55, 0.05), keys.length);
  const m = new THREE.Matrix4();
  keys.forEach((k, i) => {
    m.compose(new THREE.Vector3(k.x, 0.0158, k.z), new THREE.Quaternion(), new THREE.Vector3(k.w, 0.0034, k.d));
    inst.setMatrixAt(i, m);
  });
  g.add(inst);
  const tilted = new THREE.Group();
  tilted.add(g);
  g.rotation.x = 0.055;
  g.position.y = 0.004;
  return tilted;
}

// A gaming mouse in the spirit of Grégoire's Logitech G502: a long body that rises toward the back, a wide thumb rest
// on the left, side buttons, a metal wheel, a glossy black trim and small blue lights. Its front points toward -z.
function buildMouse() {
  const L = 0.132;
  const g = new THREE.Group();
  // Height of the back and half width of the body along the length (s = 0 at the front, 1 at the back).
  const curve1d = (pts) => (s) => {
    for (let i = 1; i < pts.length; i++) {
      if (s <= pts[i][0]) {
        const [s0, v0] = pts[i - 1];
        const [s1, v1] = pts[i];
        const t = (s - s0) / (s1 - s0);
        return v0 + (v1 - v0) * t * t * (3 - 2 * t);
      }
    }
    return pts[pts.length - 1][1];
  };
  const close = (s) => Math.pow(Math.max(0, 1 - Math.pow(Math.abs(2 * s - 1), 5)), 1 / 5);
  const top = (s) => curve1d([[0, 0.02], [0.3, 0.029], [0.66, 0.04], [0.9, 0.035], [1, 0.03]])(s) * close(s);
  const half = (s) => curve1d([[0, 0.024], [0.35, 0.03], [0.7, 0.031], [1, 0.027]])(s) * close(s);
  const thumb = (s) => 0.01 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, (s - 0.22) / 0.62))), 0.8);
  const surface = (s, u, side) => {
    // u from 0 (bottom edge) to 1 (crest of the back), on the left (side = -1) or right (side = 1).
    const y = top(s) * Math.sin((u * Math.PI) / 2) ** 0.85;
    let x = half(s) * Math.cos((u * Math.PI) / 2) ** 0.7;
    if (side < 0) x += thumb(s) * Math.pow(Math.max(0, 1 - y / 0.015), 2);
    else x -= 0.004 * Math.sin(Math.PI * s) * Math.min(1, Math.max(0, (y - 0.01) / 0.012));
    return new THREE.Vector3(side * x, y, (s - 0.5) * L);
  };
  const geo = new THREE.SphereGeometry(1, 96, 48);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const vx = p.getX(i);
    const vy = p.getY(i);
    const vz = p.getZ(i);
    const s = (vz + 1) / 2;
    const ring = Math.max(1e-6, Math.sqrt(Math.max(0, 1 - vz * vz)));
    const ang = Math.atan2(vy / ring, vx / ring);
    if (vy >= 0) {
      const side = ang < Math.PI / 2 ? 1 : -1;
      const u = side > 0 ? ang / (Math.PI / 2) : (Math.PI - ang) / (Math.PI / 2);
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
  const body = new THREE.MeshPhysicalMaterial({ color: 0x0b0b0c, roughness: 0.55, specularIntensity: 0.22 });
  const gloss = std(0x0c0c0e, 0.16, 0.45);
  const metal = std(0xb0b3b8, 0.22, 0.9);
  const led = new THREE.MeshStandardMaterial({ color: 0x0a6cc0, emissive: 0x1fb8ff, emissiveIntensity: 1.5 });
  g.add(new THREE.Mesh(geo, body));
  const onTop = (s, x, lift = 0.0006) => new THREE.Vector3(x, top(s) + 0.002 + lift, (s - 0.5) * L);
  // The groove between the two buttons, and the wheel in it.
  const groove = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([0.02, 0.12, 0.24, 0.34].map((s) => onTop(s, 0, 0.0002))), 16, 0.0011, 6, false), gloss);
  g.add(groove);
  const wheel = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.0105, 0.0105, 0.0072, 32), std(0x1a1a1c, 0.7));
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.0098, 0.0098, 0.0082, 32), metal);
  tire.rotation.z = rim.rotation.z = Math.PI / 2;
  wheel.add(rim, tire);
  wheel.position.copy(onTop(0.2, 0, -0.0045));
  g.add(wheel);
  // A glossy black trim along the upper edge of the left side, from the front to the back.
  const trimPts = [0.12, 0.3, 0.5, 0.7, 0.86].map((s) => surface(s, 0.62, -1).add(new THREE.Vector3(0, 0.002, 0)));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(trimPts), 32, 0.0019, 8, false), gloss));
  // Two side buttons above the thumb rest, and a sniper button in front of them.
  [
    [0.3, 0.016, 0.017],
    [0.43, 0.016, 0.017],
    [0.19, 0.012, 0.011],
  ].forEach(([s, len, y]) => {
    const q = surface(s, 0.42, -1);
    const b = new THREE.Mesh(new RoundedBoxGeometry(0.004, 0.0065, len, 2, 0.0015), gloss);
    b.position.set(q.x - 0.0012, y + 0.002, q.z);
    b.rotation.z = 0.35;
    g.add(b);
  });
  // The three small blue lights of the sensitivity, on the left button.
  [0.25, 0.28, 0.31].forEach((s) => {
    const q = surface(s, 0.86, -1);
    const dot = new THREE.Mesh(new THREE.BoxGeometry(0.0022, 0.0008, 0.0016), led);
    dot.position.set(q.x, q.y + 0.0022, q.z);
    g.add(dot);
  });
  return g;
}

// A small mouse pad of pastel blue cloth, with rounded corners. Its blue is stronger than it looks: the warm light of
// dusk greys it.
function buildPad() {
  const w = 0.22;
  const d = 0.19;
  const r = 0.014;
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -d / 2);
  s.lineTo(w / 2 - r, -d / 2);
  s.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
  s.lineTo(w / 2, d / 2 - r);
  s.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
  s.lineTo(-w / 2 + r, d / 2);
  s.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
  s.lineTo(-w / 2, -d / 2 + r);
  s.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.0024, bevelEnabled: true, bevelThickness: 0.0006, bevelSize: 0.0008, bevelSegments: 2, curveSegments: 6 });
  geo.rotateX(-Math.PI / 2).translate(0, 0.0006, 0);
  return new THREE.Mesh(geo, std(0x6b9ee0, 0.95));
}

// A desk lamp in the spirit of the Anglepoise Type 75 Mini: a round base, one gently curved arm and a head made of a
// short cylinder that flares into a bell, lit inside. The lamp is built facing +x, its head aimed at a point of the desk
// `reach` metres in front of its base. The cylinder of the head is kept short so that it hides little behind it.
function buildLamp(reach) {
  const g = new THREE.Group();
  const paint = std(0x2b2725, 0.5, 0.25);
  const steel = std(0xc9c4bc, 0.3, 0.85);
  const lathe = (pts, material, segments = 64) => new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segments), material);
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
      paint
    )
  );
  // The arm rises from just behind the middle of the base, leans back, then bends forward into the joint of the head.
  const joint = new THREE.Vector3(-0.02, 0.42, 0);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.01, 24), steel);
  collar.position.set(-0.025, 0.027, 0);
  g.add(collar);
  const arm = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.025, 0.02, 0), new THREE.Vector3(-0.045, 0.15, 0), new THREE.Vector3(-0.055, 0.28, 0), new THREE.Vector3(-0.045, 0.37, 0), joint.clone()]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(arm, 64, 0.0065, 12, false), paint));
  const knuckle = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.022, 20), steel);
  knuckle.rotation.x = Math.PI / 2;
  knuckle.position.copy(joint);
  g.add(knuckle);
  // The head, along its own +y from the joint toward the lit point: a rounded back, the short cylinder, the bell.
  const axis = new THREE.Vector3(reach, 0, 0).sub(joint).normalize();
  const cyl = 0.045;
  const bell = 0.075;
  const profile = [
    [0, 0],
    [0.012, 0.002],
    [0.02, 0.006],
    [0.024, 0.012],
    [0.025, 0.02],
    [0.025, cyl],
  ];
  for (let i = 1; i <= 12; i++) {
    const t = i / 12;
    profile.push([0.025 + 0.037 * t ** 1.6, cyl + bell * t]);
  }
  const head = new THREE.Group();
  head.add(lathe(profile, std(0x2b2725, 0.45, 0.3, { side: THREE.FrontSide })));
  // Inside, the bell glows by itself, brightest at the throat and warmer toward the rim, whatever the lights around.
  const inside = lathe(profile, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
  const ip = inside.geometry.attributes.position;
  const glow = new Float32Array(ip.count * 3);
  const throat = new THREE.Color(0xffffff);
  const rim = new THREE.Color(0xf2dcbc);
  for (let i = 0; i < ip.count; i++) throat.clone().lerp(rim, Math.max(0, Math.min(1, (ip.getY(i) - cyl) / bell)) ** 0.8).toArray(glow, i * 3);
  inside.geometry.setAttribute('color', new THREE.BufferAttribute(glow, 3));
  inside.userData.noShadow = true;
  head.add(inside);
  // The bright diffuser at the throat of the bell.
  const bulb = new THREE.Mesh(new THREE.CircleGeometry(0.024, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff6e2, side: THREE.DoubleSide }));
  bulb.position.y = cyl + 0.006;
  bulb.userData.noShadow = true;
  bulb.name = 'bulb';
  head.add(bulb);
  head.position.copy(joint);
  head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
  g.add(head);
  // Where the light leaves the bell, and the way it goes.
  const light = new THREE.Object3D();
  light.position.copy(joint).addScaledVector(axis, cyl + bell - 0.01);
  light.userData.axis = axis;
  g.add(light);
  g.userData.light = light;
  return g;
}

function leafGeometry(len, wid) {
  const s = new THREE.Shape();
  s.moveTo(0, len * 0.06);
  s.bezierCurveTo(wid * 0.25, -len * 0.06, wid * 0.62, len * 0.1, wid * 0.48, len * 0.42);
  s.bezierCurveTo(wid * 0.36, len * 0.66, wid * 0.1, len * 0.86, 0, len);
  s.bezierCurveTo(-wid * 0.1, len * 0.86, -wid * 0.36, len * 0.66, -wid * 0.48, len * 0.42);
  s.bezierCurveTo(-wid * 0.62, len * 0.1, -wid * 0.25, -len * 0.06, 0, len * 0.06);
  const g = new THREE.ShapeGeometry(s, 12);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    p.setZ(i, Math.abs(x) * 0.12 + Math.sin((y / len) * Math.PI) * len * 0.14 - (y / len) ** 2 * len * 0.12);
  }
  g.computeVertexNormals();
  return g;
}

// A trailing heart-leaf plant in a white pot, kept small and low in the corner so that it hides little of the wall.
function buildPlant() {
  const g = new THREE.Group();
  const r = rng(77);
  const potPts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.07, 0),
    new THREE.Vector2(0.08, 0.01),
    new THREE.Vector2(0.092, 0.13),
    new THREE.Vector2(0.098, 0.15),
    new THREE.Vector2(0.088, 0.152),
    new THREE.Vector2(0.084, 0.135),
  ];
  g.add(new THREE.Mesh(new THREE.LatheGeometry(potPts, 64), std(0xeeebe5, 0.55)));
  const soil = new THREE.Mesh(new THREE.CircleGeometry(0.084, 40), std(0x2b1f18, 1));
  soil.rotation.x = -Math.PI / 2;
  soil.position.y = 0.135;
  g.add(soil);
  const stemMat = std(0x3e6a33, 0.7);
  const leafMats = [0x264d25, 0x33612e, 0x416f34].map((c) => std(c, 0.75, 0, { side: THREE.DoubleSide }));
  const leafSizes = [
    [0.055, 0.048],
    [0.068, 0.058],
    [0.047, 0.04],
  ];
  const leafGeos = leafSizes.map(([len, wid]) => leafGeometry(len, wid));
  // Nothing may go through the pot: below the soil a point stays outside it; between the soil and the rim it is
  // either well inside or outside.
  const potR = (y) => (y < 0.01 ? 0.07 + y : y < 0.13 ? 0.08 + ((y - 0.01) / 0.12) * 0.012 : 0.092 + ((y - 0.13) / 0.02) * 0.006);
  const clear = (p) => {
    const rr = Math.hypot(p.x, p.z);
    if (p.y > 0.16) return true;
    if (p.y > 0.135 && rr < 0.074) return true;
    return rr > potR(Math.max(0, p.y)) + 0.006;
  };
  // Where the camera is, seen from the plant (in the plant's own frame).
  const [px, pz, turn] = PLACES.plant;
  const w = new THREE.Vector3(-px, 1.2 - ROOM.deskY - 0.2, -pz).normalize();
  const toViewer = new THREE.Vector3(w.x * Math.cos(turn) - w.z * Math.sin(turn), w.y + 0.5, w.x * Math.sin(turn) + w.z * Math.cos(turn)).normalize();
  const vines = 14;
  for (let v = 0; v < vines; v++) {
    const a = (v / vines) * Math.PI * 2 + r() * 0.4;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const trailing = v % 3 === 0;
    let curve;
    if (trailing) {
      // Trailing stems climb over the rim before they hang down outside the pot.
      const out = 0.16 + r() * 0.08;
      const drop = 0.04 + r() * 0.1;
      curve = new THREE.CubicBezierCurve3(new THREE.Vector3(c * 0.03, 0.14, sn * 0.03), new THREE.Vector3(c * 0.075, 0.215, sn * 0.075), new THREE.Vector3(c * 0.15, 0.205, sn * 0.15), new THREE.Vector3(c * out, 0.15 - drop, sn * out));
    } else {
      const reach = 0.1 + r() * 0.1;
      const up = 0.07 + r() * 0.11;
      curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(c * 0.02, 0.14, sn * 0.02), new THREE.Vector3(c * reach * 0.45, 0.14 + up * 0.7, sn * reach * 0.45), new THREE.Vector3(c * reach, 0.14 + up, sn * reach));
    }
    if (!curve.getPoints(24).every(clear)) continue;
    const fits = (leaf, kind) => {
      leaf.updateMatrix();
      const [len, wid] = leafSizes[kind];
      return [
        [0, len],
        [wid * 0.5, len * 0.42],
        [-wid * 0.5, len * 0.42],
        [0, len * 0.06],
      ].every(([x, y]) => clear(new THREE.Vector3(x, y, 0).applyMatrix4(leaf.matrix)));
    };
    // A stem always ends on a leaf that carries it on, its face turned toward the viewer so that it never shows as a
    // bare spike; if that leaf would touch the pot, the stem is cut back.
    let tip = 0;
    let tipLeaf = null;
    for (let tt = 1; tt > 0.35 && !tipLeaf; tt -= 0.07) {
      const kind = v % 3;
      const leaf = new THREE.Mesh(leafGeos[kind], leafMats[v % 3]);
      const T = curve.getTangent(tt);
      const P = curve.getPoint(tt);
      const up = toViewer.clone().addScaledVector(T, -toViewer.dot(T));
      if (up.lengthSq() < 0.04) up.set(P.x, 0, P.z);
      up.normalize();
      const side = new THREE.Vector3().crossVectors(T, up).normalize();
      leaf.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, T, up.crossVectors(side, T)));
      leaf.position.copy(P);
      leaf.scale.setScalar(0.85 + r() * 0.25);
      if (fits(leaf, kind)) {
        tip = tt;
        tipLeaf = leaf;
      }
    }
    if (!tipLeaf) continue;
    const stemPts = [];
    for (let i = 0; i <= 20; i++) stemPts.push(curve.getPoint((i / 20) * tip));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(stemPts), 20, 0.0025, 6, false), stemMat));
    g.add(tipLeaf);
    const n = 4 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const t = (0.25 + (k / n) * 0.65) * tip;
      const p = curve.getPoint(t);
      const tan = curve.getTangent(t);
      const kind = (v + k) % 3;
      const leaf = new THREE.Mesh(leafGeos[kind], leafMats[(v * 2 + k) % 3]);
      leaf.position.copy(p);
      const side = k % 2 ? 1 : -1;
      const out = new THREE.Vector3(tan.x, 0, tan.z).normalize();
      const yaw = Math.atan2(out.x, out.z) + side * (0.6 + r() * 0.5);
      leaf.rotation.set(-0.9 + r() * 0.7 + (trailing ? 0.9 : 0), yaw, side * (0.3 + r() * 0.3), 'YXZ');
      leaf.scale.setScalar(0.8 + r() * 0.5);
      if (fits(leaf, kind)) g.add(leaf);
    }
  }
  return g;
}

// A small photo frame standing on the desk, leaning back on its strut: a slim black frame around a photo in the 4:5
// format, whose face is white here (the site lays a photo over it, picked at random).
function buildDeskFrame() {
  const g = new THREE.Group();
  const iw = 0.1;
  const ih = 0.125;
  const bd = 0.011;
  const ow = iw + 2 * bd;
  const oh = ih + 2 * bd;
  const lean = 11 * DEG;
  const face = new THREE.Group();
  const black = std(0x1d1b1a, 0.55);
  face.add(box(ow, bd, 0.012, black, 0, oh - bd / 2, 0, 0.002));
  face.add(box(ow, bd, 0.012, black, 0, bd / 2, 0, 0.002));
  face.add(box(bd, ih, 0.012, black, -ow / 2 + bd / 2, oh / 2, 0, 0.002));
  face.add(box(bd, ih, 0.012, black, ow / 2 - bd / 2, oh / 2, 0, 0.002));
  face.add(box(ow - 0.004, oh - 0.004, 0.003, std(0x2a2725, 0.8), 0, oh / 2, -0.0045));
  const img = box(iw, ih, 0.0015, std(0xffffff, 0.9), 0, oh / 2, 0.0035);
  img.name = 'picture-bureau';
  img.userData = { type: 'photo', w: iw, h: ih, d: 0.0015 };
  face.add(img);
  face.rotation.x = -lean;
  g.add(face);
  const strut = box(0.018, 0.12, 0.004, black, 0, 0.055, -0.045);
  strut.rotation.x = 0.42;
  g.add(strut);
  return g;
}

// Stands the rose of the planet upright, from the foot of its stem toward its bloom, at the given height.
function standRose(model, height, y0) {
  const rose = model.clone(true);
  rose.position.set(0, 0, 0);
  rose.scale.set(1, 1, 1);
  rose.quaternion.setFromUnitVectors(new THREE.Vector3(0.013, -0.701, -0.713).normalize(), new THREE.Vector3(0, 1, 0));
  rose.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(rose);
  rose.scale.setScalar(height / (bounds.max.y - bounds.min.y));
  rose.updateMatrixWorld(true);
  bounds.setFromObject(rose);
  rose.position.set(-(bounds.min.x + bounds.max.x) / 2, y0 - bounds.min.y, -(bounds.min.z + bounds.max.z) / 2);
  // Opaque petals sort well under the glass; softer highlights under the desk lamp, which is much closer than the
  // planet's sun.
  rose.traverse((o) => {
    if (o.isMesh) {
      o.material = o.material.clone();
      o.material.transparent = false;
      o.material.opacity = 1;
      o.material.depthWrite = true;
      if ('specularIntensity' in o.material) o.material.specularIntensity *= 0.5;
    }
  });
  const g = new THREE.Group();
  g.add(rose);
  return g;
}

// The rose under its glass globe. With Grégoire's Blender model of the planet, it is the rose of the planet itself;
// without it, a simplified one.
function buildRose(model) {
  const g = new THREE.Group();
  const R = 0.064;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.01, R + 0.014, 0.024, 48), std(0x6b4a33, 0.55));
  base.position.y = 0.012;
  g.add(base);
  if (model) g.add(standRose(model, 0.18, 0.024));
  else g.add(simpleRose());
  // The globe: a cylinder of glass capped by a half sphere.
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, transparent: true, opacity: 0.16, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6, side: THREE.DoubleSide, depthWrite: false });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.17, 64, 1, true), glass);
  tube.position.y = 0.024 + 0.085;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2), glass);
  dome.position.y = 0.024 + 0.17;
  tube.userData.noShadow = dome.userData.noShadow = true;
  tube.renderOrder = dome.renderOrder = 1;
  g.add(tube, dome);
  return g;
}

function simpleRose() {
  const g = new THREE.Group();
  const stemCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.024, 0), new THREE.Vector3(0.004, 0.07, 0.002), new THREE.Vector3(-0.003, 0.12, -0.002), new THREE.Vector3(0, 0.15, 0)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 24, 0.0022, 8, false), std(0x3b6630, 0.7)));
  const leafGeo = leafGeometry(0.03, 0.018);
  [
    [0.075, 0.9, 0.5],
    [0.1, -0.8, 2.6],
  ].forEach(([y, tilt, yaw]) => {
    const l = new THREE.Mesh(leafGeo, std(0x3f6d33, 0.65, 0, { side: THREE.DoubleSide }));
    l.position.set(0, y, 0);
    l.rotation.set(tilt, yaw, 0, 'YXZ');
    g.add(l);
  });
  // The bloom: three rings of cupped petals around a tight heart.
  const red = [0x9c1529, 0xb21e33, 0x87111f].map((c) => std(c, 0.55, 0, { side: THREE.DoubleSide }));
  const bloom = new THREE.Group();
  bloom.position.y = 0.158;
  const heart = new THREE.Mesh(new THREE.SphereGeometry(0.011, 20, 14), red[2]);
  heart.scale.set(1, 1.25, 1);
  bloom.add(heart);
  const petalGeo = new THREE.SphereGeometry(0.018, 20, 12, 0, Math.PI * 0.9, 0.15 * Math.PI, 0.6 * Math.PI);
  [
    [5, 0.009, 0.25, 0.9],
    [5, 0.013, 0.55, 1.05],
    [6, 0.016, 0.9, 1.2],
  ].forEach(([count, rad, open, scale], ri) => {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + ri * 0.6;
      const p = new THREE.Mesh(petalGeo, red[(i + ri) % 3]);
      p.position.set(Math.cos(a) * rad * 0.5, -0.002, Math.sin(a) * rad * 0.5);
      p.rotation.set(0, -a + Math.PI / 2, 0, 'YXZ');
      p.rotateX(-open * 0.6);
      p.scale.setScalar(scale);
      bloom.add(p);
    }
  });
  g.add(bloom);
  return g;
}

// A ceramic cup with a real wall, and pencils that lean against the inside of it without going through.
function buildPencils() {
  const g = new THREE.Group();
  const profile = [
    [0, 0],
    [0.036, 0],
    [0.037, 0.003],
    [0.0395, 0.103],
    [0.0392, 0.1055],
    [0.0365, 0.1055],
    [0.0362, 0.103],
    [0.0338, 0.006],
    [0, 0.006],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  g.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 48), std(0x8ea18b, 0.75)));
  const r = rng(9);
  const colors = [0xe9b44c, 0x1d1d20, 0xc0392b, 0x2f5d8a, 0xe9b44c, 0x3c3c40];
  colors.forEach((c, i) => {
    const len = 0.13 + r() * 0.04;
    const p = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.0036, 0.0036, len, 6), std(c, 0.6));
    body.position.y = len / 2;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.0036, 0.014, 6), std(0xd9b38c, 0.8));
    tip.position.y = len + 0.007;
    p.add(body, tip);
    // From near the middle of the bottom, each pencil leans outward and stays clear of the rim.
    const a = (i / colors.length) * Math.PI * 2;
    const lean = 0.16 + r() * 0.06;
    p.position.set(Math.cos(a) * 0.008, 0.012, Math.sin(a) * 0.008);
    p.rotation.set(Math.sin(a) * lean, 0, -Math.cos(a) * lean);
    g.add(p);
  });
  return g;
}

function buildDesk(roseModel) {
  const g = new THREE.Group();
  const { deskY, deskFront, wallZ } = ROOM;
  const wood = woodTexture();
  wood.repeat.set(2, 1);
  g.add(box(3.4, 0.036, deskFront - wallZ - 0.004, std(0xffffff, 0.4, 0, { map: wood }), -0.1, deskY - 0.018, (wallZ + deskFront) / 2 - 0.002, 0.008));
  const objects = {
    monitor: buildMonitor(),
    keyboard: buildKeyboard(),
    pad: buildPad(),
    mouse: buildMouse(),
    lamp: buildLamp(Math.hypot(LAMP_AIM[0] - PLACES.lamp[0], LAMP_AIM[1] - PLACES.lamp[1])),
    plant: buildPlant(),
    rose: buildRose(roseModel),
    pencils: buildPencils(),
    frame: buildDeskFrame(),
  };
  for (const [name, o] of Object.entries(objects)) {
    const [x, z, turn, lift = 0] = PLACES[name];
    o.position.set(x, deskY + lift, z);
    o.rotation.y = name === 'lamp' ? Math.atan2(z - LAMP_AIM[1], LAMP_AIM[0] - x) : turn;
    g.add(o);
  }
  onLayer(g, LAYERS.desk);
  return { group: g, ...objects };
}

// ---------- The city seen through the window ----------
// The flat is near the top of a hill, 80 m above the town. A river crosses the view diagonally, from the bottom of the
// window toward the right; beyond it the town, gently rolling, recedes to hills on several planes (Lyon, loosely).

const CITY = {
  land: -80,
  water: -86.5,
  hill: { top: -21, flat: 18, foot: 150 },
  river: { from: [-40, -330], to: [600, -1300], half: 45 },
};
// The river's frame on the ground: u runs along it, v across it, positive on the far bank.
const R0 = new THREE.Vector2(...CITY.river.from);
const ALONG = new THREE.Vector2(...CITY.river.to).sub(R0).normalize();
const ACROSS = new THREE.Vector2(ALONG.y, -ALONG.x);
if (ACROSS.dot(R0) < 0) ACROSS.negate();
const HALF = CITY.river.half;
const RIVER_TURN = Math.atan2(-ALONG.y, ALONG.x);
const at = (u, v) => R0.clone().addScaledVector(ALONG, u).addScaledVector(ACROSS, v);
const acrossOf = (p) => p.clone().sub(R0).dot(ACROSS);
// A point of the ground at an azimuth (degrees, positive to the right) and a distance from the camera.
const polar = (az, d) => new THREE.Vector2(Math.sin(az * DEG) * d, -Math.cos(az * DEG) * d);
// Height of the ground on our hill, by distance from the camera.
const hillY = (d) => {
  const { top, flat, foot } = CITY.hill;
  return d <= flat ? top : d >= foot ? CITY.land : top + ((d - flat) / (foot - flat)) * (CITY.land - top);
};

const FACADES = [0xece0c8, 0xe6c79c, 0xe9bba4, 0xdccbb5, 0xd2bb9f, 0xf1e5d0, 0xe3d2b0, 0xd9b48f];
const TILES = [0xa06a58, 0x94614f, 0xaa7563, 0x8b5b4c, 0xa2705d];

// The windows of the facades, 8 x 8 cells of one bay and one floor each: classic windows with a sill, or the ribbon
// windows of modern blocks.
const WINDOWS = {
  classic: { x: 0.3, y: 0.24, w: 0.4, h: 0.52, glass: 'rgba(64,66,80,0.86)', sill: true },
  ribbon: { x: 0.02, y: 0.3, w: 0.96, h: 0.42, glass: 'rgba(58,66,82,0.9)' },
};

function facadeTextures(seed, litRatio, style = 'classic') {
  const cols = 8;
  const rows = 8;
  const r = rng(seed);
  const lit = [];
  for (let i = 0; i < cols * rows; i++) lit.push(r() < litRatio ? (r() < 0.7 ? '#ffcf86' : '#ffe6b8') : null);
  const cell = 64;
  const win = WINDOWS[style];
  const draw = (emissive) => (ctx, w, h) => {
    ctx.fillStyle = emissive ? '#000' : '#fff';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const px = x * cell + cell * win.x;
        const py = (rows - 1 - y) * cell + cell * win.y;
        const on = lit[y * cols + x];
        if (emissive) {
          if (on) {
            ctx.fillStyle = on;
            ctx.fillRect(px, py, cell * win.w, cell * win.h);
          }
        } else {
          ctx.fillStyle = win.glass;
          ctx.fillRect(px, py, cell * win.w, cell * win.h);
          if (win.sill) {
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fillRect(px - 2, py + cell * win.h, cell * win.w + 4, 3);
          }
        }
      }
    }
  };
  return { map: canvasTexture(cols * cell, rows * cell, draw(false)), emissive: canvasTexture(cols * cell, rows * cell, draw(true)) };
}

// A roof over a w x d footprint: hipped (a ridge along the longer side) or gabled (vertical triangular ends).
function pitchedRoof(w, d, h, gable = false) {
  const long = w >= d;
  const a = long ? w : d;
  const b = long ? d : w;
  const r = gable ? a / 2 : Math.max(0, (a - b) / 2);
  const P = (u, y, v) => (long ? [u, y, v] : [v, y, u]);
  const c = [P(-a / 2, 0, -b / 2), P(a / 2, 0, -b / 2), P(a / 2, 0, b / 2), P(-a / 2, 0, b / 2)];
  const r0 = P(-r, h, 0);
  const r1 = P(r, h, 0);
  const tris = [
    [c[0], r0, r1],
    [c[0], r1, c[1]],
    [c[2], r1, r0],
    [c[2], r0, c[3]],
    [c[1], r1, c[2]],
    [c[3], r0, c[0]],
  ];
  const pos = [];
  // Swapping the axes mirrors the shape, so the winding is reversed to keep the faces pointing out.
  for (const t of tris) pos.push(...t[0], ...(long ? t[1] : t[2]), ...(long ? t[2] : t[1]));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

// Triangles turned so that each faces away from a point inside the solid.
function outward(tris, inside) {
  const pos = [];
  const [A, B, C, n, m] = [0, 0, 0, 0, 0].map(() => new THREE.Vector3());
  for (const [a, b, c] of tris) {
    A.fromArray(a);
    B.fromArray(b);
    C.fromArray(c);
    n.subVectors(B, A).cross(m.subVectors(C, A));
    const out = n.dot(A.add(B).add(C).divideScalar(3).sub(inside)) >= 0;
    pos.push(...a, ...(out ? b : c), ...(out ? c : b));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

// A mansard: steep slopes all around up to a flat top.
function mansardRoof(w, d, h) {
  const i = h * 0.38;
  const b = [
    [-w / 2, 0, -d / 2],
    [w / 2, 0, -d / 2],
    [w / 2, 0, d / 2],
    [-w / 2, 0, d / 2],
  ];
  const t = b.map(([x, , z]) => [x - Math.sign(x) * i, h, z - Math.sign(z) * i]);
  const tris = [];
  for (let k = 0; k < 4; k++) {
    const k1 = (k + 1) % 4;
    tris.push([b[k], b[k1], t[k1]], [b[k], t[k1], t[k]]);
  }
  tris.push([t[0], t[1], t[2]], [t[0], t[2], t[3]]);
  return outward(tris, new THREE.Vector3(0, h / 2, 0));
}

function flatRoof(w, d) {
  const g = new THREE.BoxGeometry(w + 0.3, 0.7, d + 0.3).translate(0, 0.35, 0).toNonIndexed();
  g.deleteAttribute('uv');
  return g;
}

// One building: walls with a grid of windows in world units (a bay is 3.2 m, a floor 3 m), and its roof.
function addBuilding(parts, r, { x, z, w, d, h, y0, turn = 0, roof = 'hip', rh, color, tiles, chimneys = r() < 0.55, dormers = 0, into = 'walls' }) {
  const place = new THREE.Matrix4().makeRotationY(turn).setPosition(x, y0, z);
  const walls = new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
  const pos = walls.attributes.position;
  const nrm = walls.attributes.normal;
  const uv = walls.attributes.uv;
  const ou = Math.floor(r() * 8) / 8;
  const ov = Math.floor(r() * 8) / 8;
  for (let i = 0; i < uv.count; i++) {
    const top = Math.abs(nrm.getY(i)) > 0.5;
    const along = Math.abs(nrm.getX(i)) > 0.5 ? pos.getZ(i) : pos.getX(i);
    uv.setXY(i, top ? 0 : along / 3.2 / 8 + ou, top ? 0 : pos.getY(i) / 3 / 8 + ov);
  }
  parts[into].push(colorize(walls, color ?? FACADES[Math.floor(r() * FACADES.length)]).applyMatrix4(place));

  rh ??= roof === 'flat' ? 0.7 : Math.min(w, d) * (0.18 + r() * 0.06);
  const roofGeo = roof === 'flat' ? flatRoof(w, d) : roof === 'mansard' ? mansardRoof(w * 1.04, d * 1.04, rh) : pitchedRoof(w * 1.05, d * 1.05, rh, roof === 'gable');
  roofGeo.translate(0, h, 0);
  parts.roofs.push(colorize(roofGeo, roof === 'flat' ? 0x8d8f95 : (tiles ?? TILES[Math.floor(r() * TILES.length)])).applyMatrix4(place));

  if (roof !== 'flat' && chimneys) {
    const n = 1 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const ch = new THREE.BoxGeometry(0.75, 1.9, 0.6).translate((r() - 0.5) * w * 0.6, h + rh * 0.55 + 0.6, (r() - 0.5) * d * 0.3);
      parts.chimneys.push(ch.applyMatrix4(place));
    }
  }
  // Dormers on the slope that faces the camera (+z side of the footprint).
  for (let k = 0; k < dormers; k++) {
    const dx = (k - (dormers - 1) / 2) * (w / (dormers + 0.5));
    const dz = d * 0.24;
    const dy = h + rh * (1 - dz / (d * 0.525)) * 0.9;
    const body = new THREE.BoxGeometry(1.4, 1.6, 1.6).translate(dx, dy + 0.3, dz);
    const bu = body.attributes.uv;
    for (let i = 0; i < bu.count; i++) bu.setXY(i, bu.getX(i) * (1.4 / 3.2 / 8) + 0.035, bu.getY(i) * (1.6 / 3 / 8) + 0.03);
    parts.walls.push(colorize(body, 0xefe6d6).applyMatrix4(place));
    const cap = pitchedRoof(1.7, 1.9, 0.75, true).translate(dx, dy + 1.1, dz);
    parts.roofs.push(colorize(cap, 0x9d4a36).applyMatrix4(place));
  }
}

// ---------- The town: districts, a park and gentle relief ----------

const OLD_FACADES = [0xefdcbc, 0xe8c393, 0xe2a77f, 0xd99c84, 0xf1e3c8, 0xd8b088, 0xeacca2, 0xcf9673, 0xe6d2b0, 0xdcb59a, 0xe9b98d, 0xd7a07a];
const HOUSE_FACADES = [0xf0e6d4, 0xe8d6b8, 0xeedcc4, 0xe2c8a6, 0xf2e9dc];
const BLOCK_FACADES = [0xe6ddd0, 0xd8d2c8, 0xe0d4c0, 0xcfc8bd, 0xe9e2d6];
const OLD_TILES = [0xa8644e, 0x96553f, 0xb0725a, 0x8c5141, 0x9e6a58, 0x7f4a3d, 0xb47a5f];
const ZINC = [0x7b828c, 0x6d747e, 0x858b93];

const smoothstep = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Smooth noise on the ground, between 0 and 1, with features about `scale` metres across.
function valueNoise(seed, scale) {
  const r = rng(seed);
  const N = 64;
  const grid = Array.from({ length: N * N }, () => r());
  const at = (i, j) => grid[(((i % N) + N) % N) + (((j % N) + N) % N) * N];
  return (x, z) => {
    const fx = x / scale;
    const fz = z / scale;
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const sx = smoothstep(0, 1, fx - i);
    const sz = smoothstep(0, 1, fz - j);
    const a = at(i, j) + (at(i + 1, j) - at(i, j)) * sx;
    const b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * sx;
    return a + (b - a) * sz;
  };
}

const bareRoof = (g) => {
  const n = g.toNonIndexed();
  n.deleteAttribute('uv');
  return n;
};

// The relief of the town, in metres above the plain: flat along the quays (and so at the foot of our hill and in the
// park); on the far bank, two broad hills covered with houses whose crests stand out against the haze, small
// undulations elsewhere, and the ground rising a little toward the hills on the horizon.
const reliefNoise = valueNoise(41, 380);
const TOWN_HILLS = [
  { az: -10, d: 1500, r: 360, h: 46 },
  { az: 8, d: 1950, r: 460, h: 58 },
].map((k) => ({ ...k, p: polar(k.az, k.d) }));
function relief(p) {
  const v = acrossOf(p);
  let h = 6 * smoothstep(0.35, 0.8, reliefNoise(p.x, p.y)) + (v > 0 ? 10 * smoothstep(1200, 2800, p.length()) : 0);
  for (const k of TOWN_HILLS) h += k.h * 0.5 * (1 + Math.cos(Math.PI * Math.min(1, p.distanceTo(k.p) / k.r)));
  return smoothstep(HALF + 160, HALF + 460, Math.abs(v)) * h;
}

// The ground under a building turned along the river: the lowest point of its footprint, so that it never floats.
function footing(p, w, d) {
  let low = relief(p);
  for (const [a, b] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]) {
    low = Math.min(low, relief(p.clone().addScaledVector(ALONG, (a * w) / 2).addScaledVector(ACROSS, (b * d) / 2)));
  }
  return low;
}

// The town in districts: an old town of tall houses with tiled or zinc roofs, quieter streets of small houses, a few
// modern blocks further away, small squares, and a park with a pond on the far quay. Everything sits on the relief.
function buildTown(parts, r, inView) {
  const district = valueNoise(13, 420);
  const pick = (list) => list[Math.floor(r() * list.length)];
  const tree = (x, z, s) => {
    const p = new THREE.Vector2(x, z);
    return new THREE.IcosahedronGeometry(1, 1).scale(s, s * 1.12, s).translate(x, CITY.land + relief(p) + s, z);
  };
  const trees = [];
  const park = { u: [40, 180], v: [75, 245] };
  const pond = { u: 112, v: 166, ru: 44, rv: 26 };
  const inPark = (p) => {
    const q = p.clone().sub(R0);
    const u = q.dot(ALONG);
    const v = q.dot(ACROSS);
    return u > park.u[0] - 6 && u < park.u[1] + 6 && v > park.v[0] - 6 && v < park.v[1] + 6;
  };

  const kindAt = (p, row) => {
    if (row === 0) return 'old';
    const n = district(p.x, p.y);
    const x = r();
    if (p.length() > 900 && x < 0.015 + 0.15 * smoothstep(0.56, 0.86, n)) return 'block';
    if (row > 1 && x < 0.5 * (1 - smoothstep(0.18, 0.44, n))) return 'house';
    if (x > 0.97) return 'square';
    return 'old';
  };
  const widthOf = (kind, row) => (kind === 'block' ? 28 + r() * 22 : kind === 'house' ? 7 + r() * 4 : kind === 'square' ? 16 + r() * 10 : (row === 0 ? 12 : 9) + r() * 10);
  const addKind = (kind, p, w, depth, row) => {
    if (inPark(p)) return;
    const y0 = CITY.land - 1 + footing(p, w, depth);
    const base = { x: p.x, z: p.y, w, d: depth, y0, turn: RIVER_TURN };
    const place = new THREE.Matrix4().makeRotationY(RIVER_TURN).setPosition(p.x, y0, p.y);
    if (kind === 'block') {
      const h = 21 + Math.floor(r() * 5) * 3;
      addBuilding(parts, r, { ...base, h, roof: 'flat', color: pick(BLOCK_FACADES), into: 'blocks' });
      const room = bareRoof(new THREE.BoxGeometry(6, 2.6, 4.5)).translate((r() - 0.5) * w * 0.5, h + 2, (r() - 0.5) * depth * 0.3);
      parts.roofs.push(colorize(room, 0x9a9ca2).applyMatrix4(place));
    } else if (kind === 'house') {
      addBuilding(parts, r, { ...base, d: depth * 0.7, h: 6.5 + r() * 3.5, roof: r() < 0.6 ? 'gable' : 'hip', color: pick(HOUSE_FACADES), tiles: pick(OLD_TILES) });
      if (r() < 0.5) {
        const g = new THREE.Vector3(w / 2 + 1.5, 0, depth * 0.3).applyMatrix4(place);
        trees.push(tree(g.x, g.z, 2.2 + r() * 1.4));
      }
    } else if (kind === 'square') {
      for (let k = 0; k < 3; k++) {
        const g = new THREE.Vector3((r() - 0.5) * w * 0.7, 0, (r() - 0.5) * depth * 0.6).applyMatrix4(place);
        trees.push(tree(g.x, g.z, 2.4 + r() * 1.6));
      }
    } else {
      const n = district(p.x, p.y);
      const x = r();
      const roof = row === 0 ? (x < 0.55 ? 'hip' : 'mansard') : x < 0.5 ? 'hip' : x < 0.78 ? 'mansard' : x < 0.92 ? 'gable' : 'flat';
      const zinc = roof === 'mansard';
      addBuilding(parts, r, {
        ...base,
        h: (row === 0 ? 15 : 11) + r() * 6 + n * 5,
        roof,
        rh: zinc ? 2.6 + r() * 0.8 : undefined,
        color: pick(OLD_FACADES),
        tiles: zinc ? pick(ZINC) : pick(OLD_TILES),
        dormers: !zinc && roof !== 'flat' && r() < 0.18 ? 2 : 0,
      });
    }
  };

  // Near bank: from the quay back to the foot of our hill.
  for (let v = -(HALF + 24), row = 0; v > -900; row++) {
    const depth = 11 + r() * 5;
    for (let u = -600; u < 3200; ) {
      const kind = kindAt(at(u + 8, v - depth / 2), row);
      const w = widthOf(kind, row);
      const p = at(u + w / 2, v - depth / 2);
      if (p.length() > CITY.hill.foot + 8 && inView(p)) addKind(kind, p, w, depth, row);
      u += w + (row === 0 ? 0.4 : kind === 'house' ? 2.5 + r() * 4 : 0.8 + r() * 3);
    }
    v -= depth + (row === 0 ? 12 : 8 + r() * 6);
  }
  // Far bank: a continuous row of facades along the quay, then the districts toward the hills.
  for (let v = HALF + 24, row = 0; v < 3200; row++) {
    const depth = 12 + r() * 5 + v * 0.004;
    for (let u = -1500; u < 3500; ) {
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
      const p = at(u + (r() - 0.5) * 5, v + (r() - 0.5) * 5);
      if (lawn(p.x, p.y) < 0.42) continue;
      trees.push(tree(p.x, p.y, 3 + r() * 2.2));
    }
  }
  const corners = [at(park.u[0], park.v[0]), at(park.u[1], park.v[0]), at(park.u[1], park.v[1]), at(park.u[0], park.v[1])];
  return { trees, pond: { center: at(pond.u, pond.v), ru: pond.ru, rv: pond.rv }, lawn: corners };
}

// The relief as ground: a polar grid over the view, a little below the plain where the town is flat so that the plain
// shows there, and sunk deep under the river so that the water shows. It stops short of the first hills on the horizon.
function reliefGround(material) {
  const azs = 200;
  const rings = 160;
  const pos = [];
  for (let j = 0; j <= rings; j++) {
    const d = (CITY.hill.foot - 20) * Math.pow(2950 / (CITY.hill.foot - 20), j / rings);
    for (let i = 0; i <= azs; i++) {
      const p = polar(-55 + (110 * i) / azs, d);
      const river = Math.abs(acrossOf(p)) < HALF + 10;
      pos.push(p.x, river ? CITY.land - 50 : CITY.land - 0.4 + relief(p), p.y);
    }
  }
  const index = [];
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < azs; i++) {
      const a = j * (azs + 1) + i;
      const b = a + azs + 1;
      index.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

function buildCity(moment) {
  const M = MOMENTS[moment].city;
  const r = rng(2024);
  const parts = { walls: [], roofs: [], chimneys: [], blocks: [] };
  // Only what can be seen through the window, with a margin for the movements of the head, is built.
  const inView = (p, margin = 40) => p.y < 0 && p.length() < 3500 && Math.abs(p.x) < -p.y * Math.tan(50 * DEG) + margin;

  // Neighbours on the slope of our hill, at the bottom corners of the window: mostly their roofs show.
  // Each is placed by the azimuths of its sides, its distance, and the angle at which its ridge is seen.
  const neighbours = [
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
    addBuilding(parts, r, { x: (x0 + x1) / 2, z: -n.d - n.depth / 2, w: x1 - x0, d: n.depth, h: ridgeY - rh - ground, y0: ground, roof: n.roof, rh, dormers: n.dormers, color: n.color, chimneys: true });
  }
  const town = buildTown(parts, r, inView);

  const g = new THREE.Group();
  const facade = facadeTextures(5, M.lit);
  const wallMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: facade.map, emissiveMap: facade.emissive, emissive: 0xffffff, emissiveIntensity: M.litGlow, roughness: 0.92 });
  const walls = new THREE.Mesh(mergeGeometries(parts.walls), wallMat);
  // Every window lit, for the layer from which windows light up now and then.
  walls.userData.allLit = new THREE.MeshBasicMaterial({ map: facadeTextures(5, 1).emissive });
  // Modern blocks with ribbon windows.
  const ribbon = facadeTextures(6, M.lit * 0.8, 'ribbon');
  const blocks = new THREE.Mesh(mergeGeometries(parts.blocks), new THREE.MeshStandardMaterial({ vertexColors: true, map: ribbon.map, emissiveMap: ribbon.emissive, emissive: 0xffffff, emissiveIntensity: M.litGlow, roughness: 0.9 }));
  blocks.userData.allLit = new THREE.MeshBasicMaterial({ map: facadeTextures(6, 1, 'ribbon').emissive });
  g.add(walls, blocks);
  g.add(new THREE.Mesh(mergeGeometries(parts.roofs), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true })));
  g.add(new THREE.Mesh(mergeGeometries(parts.chimneys), std(0xb9a58f, 0.9)));

  // Landmarks: a dome near the far quay, bell towers, and a small dome of green copper further away.
  const stone = std(0xdccab0, 0.88);
  const slate = std(0x6c7480, 0.6, 0.3);
  {
    const p = polar(-4, 560);
    const y = CITY.land + relief(p);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 10, 32), stone);
    drum.position.set(p.x, y + 24, p.y);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(9.4, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), slate);
    dome.position.set(p.x, y + 29, p.y);
    dome.scale.y = 1.25;
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 4, 12), stone);
    lantern.position.set(p.x, y + 42, p.y);
    g.add(drum, dome, lantern);
  }
  [
    [-15, 820, 38, 8],
    [7, 1150, 44, 8],
    [-9, 1600, 40, 8],
    [-14, 1050, 34, 7],
    [1.5, 980, 30, 7],
  ].forEach(([az, d, h, w]) => {
    const p = polar(az, d);
    const y = CITY.land + footing(p, w, w);
    g.add(box(w, h, w, stone, p.x, y + h / 2, p.y));
    const spire = new THREE.Mesh(new THREE.ConeGeometry(w * 0.7, h * 0.39, 4), slate);
    spire.rotation.y = Math.PI / 4 + RIVER_TURN;
    spire.position.set(p.x, y + h + h * 0.195, p.y);
    g.add(spire);
  });
  {
    const p = polar(-8.5, 1350);
    const y = CITY.land + relief(p);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 9, 28), stone);
    drum.position.set(p.x, y + 20, p.y);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(7.3, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), std(0x6f9a8a, 0.55, 0.3));
    dome.position.set(p.x, y + 24.5, p.y);
    dome.scale.y = 1.2;
    g.add(drum, dome);
  }

  // Ground: the plain of the town with the river cut out of it, the relief over it, and our hill.
  const earth = std(0x5a4f48, 0.95);
  const land = new THREE.Shape([new THREE.Vector2(-7000, -300), new THREE.Vector2(7000, -300), new THREE.Vector2(7000, 9000), new THREE.Vector2(-7000, 9000)]);
  land.holes.push(new THREE.Path([at(-250, -HALF), at(3500, -HALF), at(3500, HALF), at(-250, HALF)].map((p) => new THREE.Vector2(p.x, -p.y))));
  g.add(new THREE.Mesh(new THREE.ShapeGeometry(land).rotateX(-Math.PI / 2).translate(0, CITY.land, 0), earth));
  g.add(reliefGround(earth));
  const { top, flat, foot } = CITY.hill;
  const hill = new THREE.Mesh(new THREE.CylinderGeometry(flat, foot, top - CITY.land, 96, 1, true), std(0x4a5139, 0.95));
  hill.position.y = (top + CITY.land) / 2;
  g.add(hill);

  // The river between high stone quays, with plane trees and street lamps along them.
  const mid = at(1625, 0);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(3750, HALF * 2).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x262d3d, roughness: 0.07, metalness: 0, envMapIntensity: 1.8 }));
  water.rotation.y = RIVER_TURN;
  water.position.set(mid.x, CITY.water, mid.y);
  g.add(water);
  const quayStone = std(0xc3b39b, 0.9);
  const trees = [];
  const lamps = [];
  for (const side of [1, -1]) {
    const wallH = CITY.land - CITY.water;
    const qw = new THREE.Mesh(new THREE.BoxGeometry(3750, wallH, 1.5), quayStone);
    const c = at(1625, side * (HALF + 0.75));
    qw.position.set(c.x, CITY.water + wallH / 2, c.y);
    qw.rotation.y = RIVER_TURN;
    const walk = new THREE.Mesh(new THREE.BoxGeometry(3750, 0.3, 9), quayStone);
    const cw = at(1625, side * (HALF + 6));
    walk.position.set(cw.x, CITY.land + 0.15, cw.y);
    walk.rotation.y = RIVER_TURN;
    g.add(qw, walk);
    for (let u = -250; u < 3500; u += 9 + r() * 5) {
      const p = at(u, side * (HALF + 13 + r() * 3));
      if (!inView(p)) continue;
      const s = 3.2 + r() * 1.5;
      trees.push(new THREE.IcosahedronGeometry(1, 1).scale(s, s * 1.1, s).translate(p.x, CITY.land + 3 + s, p.y));
    }
    for (let u = -250; u < 3500; u += 24) {
      const p = at(u, side * (HALF + 3));
      if (inView(p)) lamps.push(new THREE.SphereGeometry(0.75, 8, 6).translate(p.x, CITY.land + 5, p.y));
    }
  }
  // Gardens and squares here and there.
  for (let i = 0; i < 260; i++) {
    const p = polar(-34 + r() * 68, 60 + r() * 900);
    const d = p.length();
    if (Math.abs(acrossOf(p)) < HALF + 10 || !inView(p)) continue;
    const s = 2.6 + r() * 2;
    trees.push(new THREE.IcosahedronGeometry(1, 1).scale(s, s * 1.15, s).translate(p.x, hillY(d) + relief(p) + s, p.y));
  }
  trees.push(...town.trees);
  const pond = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), water.material);
  pond.scale.set(town.pond.ru, 1, town.pond.rv);
  pond.rotation.y = RIVER_TURN;
  // Raised a little above the lawn, itself above the ground, so that the depth buffer still tells them apart from this
  // far away.
  pond.position.set(town.pond.center.x, CITY.land + 1.2, town.pond.center.y);
  const lawn = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(town.lawn.map((p) => new THREE.Vector2(p.x, -p.y)))).rotateX(-Math.PI / 2), std(0x7d9a5a, 0.95));
  lawn.position.y = CITY.land + 0.6;
  g.add(pond, lawn);
  g.add(new THREE.Mesh(mergeGeometries(trees), std(0x3a4a31, 0.95, 0, { flatShading: true })));
  g.add(new THREE.Mesh(mergeGeometries(lamps), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc472).multiplyScalar(M.lamps) })));

  // Two stone bridges with segmental arches.
  const bridgeMat = std(0xcfbea3, 0.85);
  for (const u of [90, 210]) {
    const len = HALF * 2 + 30;
    const s = new THREE.Shape();
    s.moveTo(-len / 2, -9);
    s.lineTo(len / 2, -9);
    s.lineTo(len / 2, 1.6);
    s.lineTo(-len / 2, 1.6);
    s.lineTo(-len / 2, -9);
    const arches = 5;
    const pier = 3;
    const span = (HALF * 2 - pier * (arches + 1)) / arches;
    const rise = 4.6;
    const R = (span * span) / 4 / (2 * rise) + rise / 2;
    const half = Math.asin(span / 2 / R);
    for (let i = 0; i < arches; i++) {
      const cx = -HALF + pier + span / 2 + i * (span + pier);
      const hole = new THREE.Path();
      hole.moveTo(cx - span / 2, -7);
      hole.lineTo(cx - span / 2, -6.5);
      hole.absarc(cx, -6.5 + rise - R, R, Math.PI / 2 + half, Math.PI / 2 - half, true);
      hole.lineTo(cx + span / 2, -7);
      hole.lineTo(cx - span / 2, -7);
      s.holes.push(hole);
    }
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 14, bevelEnabled: false }).translate(0, 0, -7), bridgeMat);
    const c = at(u, 0);
    m.matrixAutoUpdate = false;
    m.matrix.makeBasis(new THREE.Vector3(ACROSS.x, 0, ACROSS.y), new THREE.Vector3(0, 1, 0), new THREE.Vector3(ALONG.x, 0, ALONG.y)).setPosition(c.x, CITY.land, c.y);
    g.add(m);
  }

  g.add(hillPlanes(moment));
  onLayer(g, LAYERS.city, false);
  return g;
}

// Hills on five planes, each paler than the one in front, lost at its foot in the mist that lies over the town; the
// farthest nearly melt into the sky. Each silhouette is set by the angle at which it rises above the eye. The second
// plane carries a slender metal tower.
function hillPlanes(moment) {
  const M = MOMENTS[moment];
  const fog = new THREE.Color(M.city.fog);
  const haze = fog.clone().lerp(new THREE.Color(M.sky[M.sky.length - 1]), 0.35);
  const eye = 1.2;
  const g = new THREE.Group();
  const planes = [
    { d: 3000, lo: -0.8, hi: 1.6, seed: 31, haze: 0.04, freq: 1.4 },
    { d: 3900, lo: 0, hi: 2.4, seed: 8, haze: 0.22, freq: 1.2 },
    { d: 5000, lo: 0.6, hi: 3.1, seed: 3, haze: 0.4, freq: 1.1 },
    { d: 6300, lo: 1, hi: 3.7, seed: 17, haze: 0.56, freq: 1 },
    { d: 8000, lo: 1.4, hi: 4.3, seed: 23, haze: 0.72, freq: 0.9 },
  ];
  const steps = 360;
  planes.forEach((pl) => {
    const rr = rng(pl.seed);
    const ph = [rr() * 6, rr() * 6, rr() * 6, rr() * 6];
    const f = pl.freq;
    const top = new THREE.Color(M.city.hills).lerp(haze, pl.haze);
    const low = top.clone().lerp(fog, 0.6);
    const pos = [];
    const col = [];
    pl.tops = [];
    for (let i = 0; i <= steps; i++) {
      const az = -62 + (124 * i) / steps;
      const k = 0.5 + 0.32 * Math.sin(az * 0.09 * f + ph[0]) + 0.14 * Math.sin(az * 0.23 * f + ph[1]) + 0.05 * Math.sin(az * 0.61 * f + ph[2]);
      const d = pl.d * (1 + 0.06 * Math.sin(az * 0.05 + ph[3]));
      const p = polar(az, d);
      const y = eye + Math.tan((pl.lo + (pl.hi - pl.lo) * k) * DEG) * d;
      const mist = Math.tan(0.9 * DEG) * d;
      pos.push(p.x, y, p.y, p.x, y - mist, p.y, p.x, CITY.land - 60, p.y);
      col.push(...top.toArray(), ...low.toArray(), ...fog.toArray());
      pl.tops.push([p, y]);
    }
    const index = [];
    for (let i = 0; i < steps; i++) {
      for (let k = 0; k < 2; k++) {
        const a = i * 3 + k;
        const b = (i + 1) * 3 + k;
        index.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(index);
    g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false, side: THREE.DoubleSide })));
  });
  const [p, y] = planes[1].tops[Math.round(((-12 + 62) / 124) * steps)];
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 5, 90, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(M.city.hills).lerp(haze, 0.22), fog: false, toneMapped: false }));
  tower.position.set(p.x * 0.995, y + 40, p.y * 0.995);
  g.add(tower);
  // The setting sun, far beyond the last hills, which hide its lower part; paler at the top, warmer toward the bottom.
  if (M.sunDisc) {
    const d = 9500;
    const az = M.glow.azimuth * DEG;
    const el = M.sunDisc.elevation * DEG;
    const r = d * Math.tan((M.sunDisc.size / 2) * DEG);
    const geo = new THREE.CircleGeometry(r, 64);
    const top = new THREE.Color(0xffefc4);
    const low = new THREE.Color(0xffbf7a);
    const sp = geo.attributes.position;
    const tint = new Float32Array(sp.count * 3);
    for (let i = 0; i < sp.count; i++) low.clone().lerp(top, (sp.getY(i) / r + 1) / 2).toArray(tint, i * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(tint, 3));
    const sun = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false }));
    sun.position.set(Math.sin(az) * Math.cos(el) * d, eye + Math.sin(el) * d, -Math.cos(az) * Math.cos(el) * d);
    sun.lookAt(0, eye, 0);
    sun.name = 'sun';
    sun.userData.radius = r;
    g.add(sun);
  }
  return g;
}

// ---------- Environments used for reflections ----------

// The sky as an equirectangular picture, for the reflections in the river.
export function skyTexture(moment) {
  const M = MOMENTS[moment];
  const t = canvasTexture(
    1024,
    512,
    (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h / 2);
      M.sky.forEach((c, i) => grad.addColorStop(i / (M.sky.length - 1), c));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h / 2);
      ctx.fillStyle = '#2a2430';
      ctx.fillRect(0, h / 2, w, h / 2);
      // Forward (-z) sits at a quarter of the width.
      const gx = w * (0.25 + M.glow.azimuth / 360);
      const glow = ctx.createRadialGradient(gx, h / 2, 0, gx, h / 2, h * 0.3);
      glow.addColorStop(0, M.glow.color);
      glow.addColorStop(1, 'rgba(255,220,170,0)');
      ctx.globalAlpha = M.glow.strength;
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h / 2);
    },
    false
  );
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}

// The room as seen from the desk, for the reflections of the objects: dim walls, the bright window, the lamp.
export function roomEnvironmentScene(moment) {
  const M = MOMENTS[moment];
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(5, 3, 5).translate(0, 1.5, 0.8), new THREE.MeshBasicMaterial({ color: new THREE.Color(M.room.hemi[1]).multiplyScalar(1.3), side: THREE.BackSide })));
  const sky = canvasTexture(
    64,
    256,
    (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      M.sky.forEach((c, i) => grad.addColorStop(i / (M.sky.length - 1), c));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    },
    false
  );
  const { win, wallZ } = ROOM;
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(win.x1 - win.x0, win.y1 - win.y0), new THREE.MeshBasicMaterial({ map: sky }));
  pane.position.set((win.x0 + win.x1) / 2, (win.y0 + win.y1) / 2, wallZ);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(M.room.lamp[0]).multiplyScalar(6) }));
  lamp.position.set(-0.44, 1.1, -1);
  env.add(pane, lamp);
  return env;
}

// ---------- Lights ----------

function buildLights(moment, desk) {
  const M = MOMENTS[moment];
  const all = (l) => {
    l.layers.enableAll();
    return l;
  };
  // Outside: the sky, a low sun behind the hills, and the glow of the sky behind the flat.
  const exterior = new THREE.Group();
  exterior.add(all(new THREE.HemisphereLight(M.city.hemi[0], M.city.hemi[1], M.city.hemi[2])));
  const az = M.glow.azimuth * DEG;
  const sun = all(new THREE.DirectionalLight(M.city.sun[0], M.city.sun[1]));
  sun.position.set(Math.sin(az) * 1000, 60, -Math.cos(az) * 1000);
  sun.target.position.set(0, CITY.land, -500);
  const fill = all(new THREE.DirectionalLight(M.city.fill[0], M.city.fill[1]));
  fill.position.set(-300, 500, 800);
  fill.target.position.set(0, CITY.land, -500);
  exterior.add(sun, sun.target, fill, fill.target);

  // Inside: the desk lamp, the light from the window and the faint glow of the screen.
  const interior = new THREE.Group();
  interior.add(all(new THREE.HemisphereLight(M.room.hemi[0], M.room.hemi[1], M.room.hemi[2])));
  const lampLight = desk.lamp.userData.light;
  desk.group.updateMatrixWorld(true);
  const spot = all(new THREE.SpotLight(M.room.lamp[0], M.room.lamp[1], 4, 0.8, 0.75, 2));
  lampLight.getWorldPosition(spot.position);
  spot.target.position.copy(spot.position).addScaledVector(lampLight.userData.axis.clone().transformDirection(desk.lamp.matrixWorld), 0.8);
  spot.castShadow = true;
  spot.shadow.mapSize.set(2048, 2048);
  spot.shadow.bias = -0.0004;
  spot.shadow.normalBias = 0.015;
  spot.shadow.radius = 6;
  spot.shadow.camera.near = 0.03;
  spot.shadow.camera.far = 4;
  spot.shadow.camera.layers.enableAll();
  interior.add(spot, spot.target);
  const glow = all(new THREE.PointLight(M.room.lamp[0], 0.6, 1.4, 2));
  glow.position.copy(spot.position);
  glow.position.y += 0.03;
  interior.add(glow);

  const { win, wallZ } = ROOM;
  const winLight = all(new THREE.RectAreaLight(M.room.window[0], M.room.window[1], win.x1 - win.x0, win.y1 - win.y0));
  winLight.position.set((win.x0 + win.x1) / 2, (win.y0 + win.y1) / 2, wallZ - 0.05);
  winLight.lookAt(winLight.position.x, winLight.position.y, 2);
  interior.add(winLight);
  // Light bouncing off the room behind us, so that the wall and the fronts of the objects do not fall into black.
  const bounce = all(new THREE.RectAreaLight(M.room.bounce[0], M.room.bounce[1], 3, 1.6));
  bounce.position.set(0, 1.2, 1.2);
  bounce.lookAt(0, 1.2, ROOM.wallZ);
  interior.add(bounce);
  // A soft key from the window, so that the objects cast their shadows toward the camera.
  const back = all(new THREE.DirectionalLight(M.room.window[0], 0.45));
  back.position.set(0.1, 2.6, -4);
  back.target.position.set(0.1, ROOM.deskY, -0.8);
  back.castShadow = true;
  back.shadow.mapSize.set(2048, 2048);
  back.shadow.camera.left = -1.8;
  back.shadow.camera.right = 1.8;
  back.shadow.camera.top = 1.2;
  back.shadow.camera.bottom = -1.2;
  back.shadow.camera.near = 0.5;
  back.shadow.camera.far = 6;
  back.shadow.bias = -0.0005;
  back.shadow.radius = 8;
  back.shadow.camera.layers.enableAll();
  interior.add(back, back.target);

  const screen = desk.monitor.getObjectByName('screen');
  const screenLight = all(new THREE.RectAreaLight(M.room.screen[0], M.room.screen[1], SCREEN.w, SCREEN.h));
  screen.getWorldPosition(screenLight.position);
  const n = new THREE.Vector3(0, 0, 1).applyQuaternion(screen.getWorldQuaternion(new THREE.Quaternion()));
  screenLight.lookAt(screenLight.position.clone().add(n));
  interior.add(screenLight);
  return { exterior, interior };
}

// ---------- Assembly ----------

export function createOffice(moment, { rose } = {}) {
  const scene = new THREE.Scene();
  const room = buildRoom();
  const desk = buildDesk(rose);
  const city = buildCity(moment);
  scene.add(room, desk.group, city);
  const lights = buildLights(moment, desk);
  scene.add(lights.exterior, lights.interior);
  scene.fog = new THREE.Fog(MOMENTS[moment].city.fog, 150, 2700);
  return { scene, lights, city, room, desk, moment: MOMENTS[moment] };
}

// Projects points of the scene into pixels of a render of the given size.
export function toPixels(points, camera, w, h) {
  return points.map((p) => {
    const v = p.clone().project(camera);
    return [Number((((v.x + 1) / 2) * w).toFixed(2)), Number((((1 - v.y) / 2) * h).toFixed(2))];
  });
}

// The four corners of the screen (top-left, top-right, bottom-right, bottom-left), in world space.
export function screenCorners(monitor) {
  const screen = monitor.getObjectByName('screen');
  screen.updateMatrixWorld(true);
  const [x, y] = [SCREEN.w / 2, SCREEN.h / 2];
  return [
    [-x, y],
    [x, y],
    [x, -y],
    [-x, -y],
  ].map(([cx, cy]) => new THREE.Vector3(cx, cy, 0).applyMatrix4(screen.matrixWorld));
}

// The four corners of each picture's face (top-left, top-right, bottom-right, bottom-left), in world space, with its
// type: the wall's and the one on the desk.
export function pictureCorners(root) {
  const out = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.name || !o.name.startsWith('picture-')) return;
    const { w, h, d, type } = o.userData;
    const corners = [
      [-w / 2, h / 2],
      [w / 2, h / 2],
      [w / 2, -h / 2],
      [-w / 2, -h / 2],
    ].map(([cx, cy]) => new THREE.Vector3(cx, cy, d / 2).applyMatrix4(o.matrixWorld));
    out.push({ id: o.name.slice(8), type, ratio: Number((w / h).toFixed(4)), corners });
  });
  return out;
}

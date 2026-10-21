// The office at the end of the journey: a first-person view from the desk, toward the window and the city.
// Units are metres. The floor of the flat is at y = 0 and the camera looks toward -z.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const LAYERS = { city: 1, room: 2, desk: 3 };

// The two moments of the site. `sky` runs from the top of the frame down to the horizon.
export const MOMENTS = {
  aube: {
    sky: ['#101834', '#27366a', '#6c68a0', '#cb94a2', '#eec29f'],
    glow: { azimuth: -15, color: '#ffe4b8', strength: 0.5 },
    city: { hemi: ['#8f9bd2', '#2a2734', 1.2], sun: ['#ffc6a6', 0.5], fill: ['#a3b2ea', 0.45], lit: 0.12, litGlow: 0.85, lamps: 2.2, fog: '#c9a3b3', hills: '#6f6f9c' },
    room: { hemi: ['#8c92c6', '#2a2430', 0.4], window: ['#c8b8ea', 5], bounce: ['#bdb9dc', 1.2], lamp: ['#ffb46a', 7], screen: ['#ffb07a', 0.8], exposure: 1 },
  },
  crepuscule: {
    sky: ['#121538', '#3b3172', '#a2567b', '#e7845a', '#f8b26b'],
    glow: { azimuth: 6, color: '#ffd38c', strength: 0.7 },
    city: { hemi: ['#b391b6', '#2d1d23', 1.1], sun: ['#ff9a5a', 0.85], fill: ['#ab9cdb', 0.38], lit: 0.38, litGlow: 1.2, lamps: 3.5, fog: '#e09a7c', hills: '#9b6377' },
    room: { hemi: ['#a67f99', '#2c1e1c', 0.4], window: ['#ffa47c', 6], bounce: ['#dcb9a8', 1.2], lamp: ['#ffae60', 8], screen: ['#ffa868', 0.9], exposure: 1 },
  },
};

// The two framings. Angles are in degrees; the pitch is positive when looking up.
export const FRAMINGS = {
  desktop: { w: 1440, h: 900, fov: 62, pos: [0, 1.2, 0], pitch: -3, yaw: 0 },
  mobile: { w: 390, h: 844, fov: 80, pos: [-0.1, 1.18, 0.35], pitch: 10, yaw: -3 },
};

// The wall in front of the desk, its window, and the desk.
export const ROOM = {
  wallZ: -1.2,
  wallT: 0.24,
  win: { x0: -0.47, x1: 0.5, y0: 0.78, y1: 2.5 },
  height: 2.7,
  deskY: 0.74,
  deskFront: -0.36,
};

// The picture of the monitor, in the 16:10 format of a classic desk screen (a 32-inch panel).
export const SCREEN = { w: 0.7, h: 0.4375 };

// Where each object stands on the desk: [x, z] and a turn around the vertical axis. The monitor is only slightly
// turned toward us: at the edge of a wide view, a screen facing the eye looks stretched.
const PLACES = {
  monitor: [0.62, -0.98, -0.15],
  keyboard: [0.3, -0.72, -0.06],
  mouse: [0.63, -0.7, -0.12],
  lamp: [-0.8, -1.05, 0],
  plant: [-0.62, -0.6, 0.4],
  rose: [-0.27, -0.96, 0],
  pencils: [0.8, -0.86, 0],
};

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

  // A single large pane in a slim dark frame, set against the inner face of the wall. There is no glass to render.
  const joinery = std(0x26272c, 0.55, 0.25);
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

  // Seven frames, laid out as on the composition sketch (fractions of the desktop frame), as plain swatches
  // until their content is chosen. The sketch's lowest prints are lifted above the desk.
  const cam = makeCamera('desktop');
  const frames = [
    { r: [-0.06, 0.02, 0.089, 0.14], kind: 'print', color: 0x7b8da2 },
    { r: [0.124, 0.02, 0.225, 0.14], kind: 'print', color: 0xc4a078 },
    { r: [-0.06, 0.17, 0.168, 0.6], kind: 'poster', color: 0x26324e },
    { r: [0.181, 0.17, 0.274, 0.32], kind: 'poster', color: 0xae664a },
    { r: [0.181, 0.355, 0.267, 0.66], kind: 'poster', color: 0x7e9179 },
    { r: [-0.06, 0.63, 0.061, 0.74], kind: 'print', color: 0xd5c2a0 },
    { r: [0.075, 0.63, 0.145, 0.74], kind: 'print', color: 0x6c5b7b },
  ];
  const black = std(0x1c1c1f, 0.5);
  const mat = std(0xf1ede5, 0.9);
  const tape = std(0xf3ead6, 0.8, 0, { transparent: true, opacity: 0.8 });
  frames.forEach((f, i) => {
    const a = wallPoint(cam, f.r[0], f.r[1]);
    const b = wallPoint(cam, f.r[2], f.r[3]);
    const w = b.x - a.x;
    const h = a.y - b.y;
    const x = (a.x + b.x) / 2;
    const y = (a.y + b.y) / 2;
    if (f.kind === 'poster') {
      g.add(box(w, h, 0.02, black, x, y, wallZ + 0.01, 0.003));
      g.add(box(w - 0.024, h - 0.024, 0.004, mat, x, y, wallZ + 0.021));
      g.add(box(w - 0.07, h - 0.07, 0.004, std(f.color, 0.9), x, y, wallZ + 0.0225));
    } else {
      const print = box(w, h, 0.002, mat, x, y, wallZ + 0.002);
      print.rotation.z = (i % 2 ? 1 : -1) * 0.012;
      g.add(print);
      const img = box(w - 0.018, h - 0.03, 0.002, std(f.color, 0.85), x, y + 0.004, wallZ + 0.0035);
      img.rotation.z = print.rotation.z;
      g.add(img);
      const t = box(0.05, 0.016, 0.001, tape, x, a.y - 0.004, wallZ + 0.005);
      t.rotation.z = (i % 2 ? -1 : 1) * 0.09;
      t.userData.noShadow = true;
      g.add(t);
    }
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

// A sculpted mouse: a low dome, higher toward the back, with a thin line between the two buttons.
function buildMouse() {
  const geo = new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i);
    p.setY(i, p.getY(i) * (0.75 + 0.25 * Math.max(0, -z)));
  }
  geo.computeVertexNormals();
  const shell = new THREE.Mesh(geo, std(0x2b2c30, 0.45, 0.15));
  shell.scale.set(0.033, 0.036, 0.06);
  const line = box(0.0012, 0.004, 0.03, std(0x111214, 0.6), 0, 0.03, 0.03);
  line.rotation.x = -0.6;
  const g = new THREE.Group();
  g.add(shell, line);
  return g;
}

function buildLamp() {
  const g = new THREE.Group();
  const metal = std(0x1b1b1e, 0.42, 0.6);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.018, 48), metal);
  base.position.y = 0.009;
  g.add(base);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.015, 0),
    new THREE.Vector3(0, 0.26, -0.01),
    new THREE.Vector3(0.03, 0.43, 0.02),
    new THREE.Vector3(0.12, 0.48, 0.09),
    new THREE.Vector3(0.18, 0.455, 0.14),
  ]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.008, 12, false), metal));
  // Dome shade, open downward and tilted toward the desk.
  const pts = [];
  for (let i = 24; i >= 0; i--) {
    const a = (i / 24) * (Math.PI / 2);
    pts.push(new THREE.Vector2(0.012 + Math.sin(a) * 0.085, Math.cos(a) * 0.075));
  }
  const shadeGeo = new THREE.LatheGeometry(pts, 64);
  const outer = new THREE.Mesh(shadeGeo, std(0x18181a, 0.45, 0.5, { side: THREE.FrontSide }));
  const inner = new THREE.Mesh(shadeGeo, std(0xfff1d6, 0.6, 0, { side: THREE.BackSide, emissive: 0xffcf8f, emissiveIntensity: 1.6 }));
  inner.userData.noShadow = true;
  const shade = new THREE.Group();
  shade.add(outer, inner);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.022, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff6e2 }));
  bulb.position.y = 0.012;
  bulb.userData.noShadow = true;
  bulb.name = 'bulb';
  shade.add(bulb);
  shade.position.set(0.19, 0.44, 0.15);
  shade.rotation.set(0.42, 0, -0.18);
  g.add(shade);
  g.userData.shade = shade;
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

// A trailing heart-leaf plant in a white pot.
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
  const leafGeos = [leafGeometry(0.055, 0.048), leafGeometry(0.068, 0.058), leafGeometry(0.047, 0.04)];
  const vines = 18;
  for (let v = 0; v < vines; v++) {
    const a = (v / vines) * Math.PI * 2 + r() * 0.4;
    const trailing = v % 3 === 0;
    const reach = 0.12 + r() * 0.12;
    const up = trailing ? -0.08 - r() * 0.12 : 0.12 + r() * 0.16;
    const p0 = new THREE.Vector3(Math.cos(a) * 0.02, 0.14, Math.sin(a) * 0.02);
    const p1 = new THREE.Vector3(Math.cos(a) * reach * 0.45, 0.14 + Math.max(0.05, up * 0.7), Math.sin(a) * reach * 0.45);
    const p2 = new THREE.Vector3(Math.cos(a) * reach, 0.14 + up, Math.sin(a) * reach);
    const curve = new THREE.QuadraticBezierCurve3(p0, p1, p2);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.0025, 6, false), stemMat));
    const n = 4 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const t = 0.25 + (k / n) * 0.75;
      const p = curve.getPoint(t);
      const tan = curve.getTangent(t);
      const leaf = new THREE.Mesh(leafGeos[(v + k) % 3], leafMats[(v * 2 + k) % 3]);
      leaf.position.copy(p);
      const side = k % 2 ? 1 : -1;
      const out = new THREE.Vector3(tan.x, 0, tan.z).normalize();
      const yaw = Math.atan2(out.x, out.z) + side * (0.6 + r() * 0.5);
      leaf.rotation.set(-0.9 + r() * 0.7 + (trailing ? 0.9 : 0), yaw, side * (0.3 + r() * 0.3), 'YXZ');
      leaf.scale.setScalar(0.8 + r() * 0.5);
      g.add(leaf);
    }
  }
  return g;
}

// The rose under its glass globe, a nod to the Little Prince.
function buildRose() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.07, 0.024, 48), std(0x6b4a33, 0.55));
  base.position.y = 0.012;
  g.add(base);
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
  // The globe: a cylinder of glass capped by a half sphere.
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, transparent: true, opacity: 0.16, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6, side: THREE.DoubleSide, depthWrite: false });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.15, 64, 1, true), glass);
  tube.position.y = 0.024 + 0.075;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.056, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2), glass);
  dome.position.y = 0.024 + 0.15;
  tube.userData.noShadow = dome.userData.noShadow = true;
  g.add(tube, dome);
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

function buildDesk() {
  const g = new THREE.Group();
  const { deskY, deskFront, wallZ } = ROOM;
  const wood = woodTexture();
  wood.repeat.set(2, 1);
  g.add(box(3.4, 0.036, deskFront - wallZ - 0.004, std(0xffffff, 0.4, 0, { map: wood }), -0.1, deskY - 0.018, (wallZ + deskFront) / 2 - 0.002, 0.008));
  const objects = {
    monitor: buildMonitor(),
    keyboard: buildKeyboard(),
    mouse: buildMouse(),
    lamp: buildLamp(),
    plant: buildPlant(),
    rose: buildRose(),
    pencils: buildPencils(),
  };
  for (const [name, o] of Object.entries(objects)) {
    const [x, z, ry] = PLACES[name];
    o.position.set(x, deskY, z);
    o.rotation.y = ry;
    g.add(o);
  }
  onLayer(g, LAYERS.desk);
  return { group: g, ...objects };
}

// ---------- The city seen through the window ----------
// The flat is near the top of a hill, 80 m above the town. A river crosses the view diagonally, from the bottom of the
// window toward the right; beyond it the town recedes to hills on the horizon (Lyon, loosely).

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

function facadeTextures(seed, litRatio) {
  const cols = 8;
  const rows = 8;
  const r = rng(seed);
  const lit = [];
  for (let i = 0; i < cols * rows; i++) lit.push(r() < litRatio ? (r() < 0.7 ? '#ffcf86' : '#ffe6b8') : null);
  const cell = 64;
  const draw = (emissive) => (ctx, w, h) => {
    ctx.fillStyle = emissive ? '#000' : '#fff';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const px = x * cell + cell * 0.3;
        const py = (rows - 1 - y) * cell + cell * 0.24;
        const on = lit[y * cols + x];
        if (emissive) {
          if (on) {
            ctx.fillStyle = on;
            ctx.fillRect(px, py, cell * 0.4, cell * 0.52);
          }
        } else {
          ctx.fillStyle = 'rgba(64,66,80,0.86)';
          ctx.fillRect(px, py, cell * 0.4, cell * 0.52);
          ctx.fillStyle = 'rgba(255,255,255,0.4)';
          ctx.fillRect(px - 2, py + cell * 0.52, cell * 0.4 + 4, 3);
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

function flatRoof(w, d) {
  const g = new THREE.BoxGeometry(w + 0.3, 0.7, d + 0.3).translate(0, 0.35, 0).toNonIndexed();
  g.deleteAttribute('uv');
  return g;
}

// One building: walls with a grid of windows in world units (a bay is 3.2 m, a floor 3 m), and its roof.
function addBuilding(parts, r, { x, z, w, d, h, y0, turn = 0, roof = 'hip', rh, color, tiles, chimneys = r() < 0.55, dormers = 0 }) {
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
  parts.walls.push(colorize(walls, color ?? FACADES[Math.floor(r() * FACADES.length)]).applyMatrix4(place));

  rh ??= roof === 'flat' ? 0.7 : Math.min(w, d) * (0.18 + r() * 0.06);
  const roofGeo = roof === 'flat' ? flatRoof(w, d) : pitchedRoof(w * 1.05, d * 1.05, rh, roof === 'gable');
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

function buildCity(moment) {
  const M = MOMENTS[moment].city;
  const r = rng(2024);
  const parts = { walls: [], roofs: [], chimneys: [] };
  // Only what can be seen through the window, with a margin for the movements of the head, is built.
  const inView = (p, margin = 40) => p.y < 0 && p.length() < 3500 && Math.abs(p.x) < -p.y * Math.tan(34 * DEG) + margin;

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
  // The town, in rows parallel to the river. Near bank: from the quay back to the foot of our hill.
  const vCamera = acrossOf(new THREE.Vector2(0, 0));
  for (let v = -(HALF + 24), row = 0; v > vCamera; row++) {
    const depth = 11 + r() * 5;
    for (let u = -600; u < 1800; ) {
      const w = 10 + r() * 9;
      const p = at(u + w / 2, v - depth / 2);
      if (p.length() > CITY.hill.foot + 8 && inView(p)) {
        addBuilding(parts, r, { x: p.x, z: p.y, w, d: depth, h: row === 0 ? 16 + r() * 5 : 12 + r() * 8, y0: CITY.land - 1, turn: RIVER_TURN, roof: r() < 0.14 ? 'flat' : 'hip' });
      }
      u += w + (row === 0 ? 0.4 : 0.8 + r() * 3);
    }
    v -= depth + (row === 0 ? 12 : 8 + r() * 6);
  }
  // Far bank: a continuous row of facades along the quay, then the town receding toward the hills.
  for (let v = HALF + 24, row = 0; v < 3200; row++) {
    const depth = 12 + r() * 5 + v * 0.004;
    for (let u = -1500; u < 3500; ) {
      const w = (row === 0 ? 12 : 10) + r() * 9 + v * 0.005;
      const p = at(u + w / 2, v + depth / 2);
      if (inView(p, 60)) {
        addBuilding(parts, r, { x: p.x, z: p.y, w, d: depth, h: row === 0 ? 17 + r() * 5 : 13 + r() * 10, y0: CITY.land - 1, turn: RIVER_TURN, roof: r() < 0.16 ? 'flat' : 'hip' });
      }
      u += w + (row === 0 ? 0.4 : 0.6 + r() * 3 + v * 0.002);
    }
    v += depth + (row === 0 ? 14 : 8 + r() * 6 + v * 0.004);
  }

  const g = new THREE.Group();
  const facade = facadeTextures(5, M.lit);
  const wallMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: facade.map, emissiveMap: facade.emissive, emissive: 0xffffff, emissiveIntensity: M.litGlow, roughness: 0.92 });
  const walls = new THREE.Mesh(mergeGeometries(parts.walls), wallMat);
  // Every window lit, for the layer from which windows light up now and then.
  walls.userData.allLit = new THREE.MeshBasicMaterial({ map: facadeTextures(5, 1).emissive });
  g.add(walls);
  g.add(new THREE.Mesh(mergeGeometries(parts.roofs), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true })));
  g.add(new THREE.Mesh(mergeGeometries(parts.chimneys), std(0xb9a58f, 0.9)));

  // Landmarks on the far bank: a dome near the quay and a few bell towers.
  const stone = std(0xdccab0, 0.88);
  const slate = std(0x6c7480, 0.6, 0.3);
  {
    const p = polar(-4, 560);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 10, 32), stone);
    drum.position.set(p.x, CITY.land + 24, p.y);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(9.4, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), slate);
    dome.position.set(p.x, CITY.land + 29, p.y);
    dome.scale.y = 1.25;
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 4, 12), stone);
    lantern.position.set(p.x, CITY.land + 42, p.y);
    g.add(drum, dome, lantern);
  }
  [
    [-15, 820, 38],
    [7, 1150, 44],
    [-9, 1600, 40],
  ].forEach(([az, d, h]) => {
    const p = polar(az, d);
    g.add(box(8, h, 8, stone, p.x, CITY.land + h / 2, p.y));
    const spire = new THREE.Mesh(new THREE.ConeGeometry(5.6, 15, 4), slate);
    spire.rotation.y = Math.PI / 4 + RIVER_TURN;
    spire.position.set(p.x, CITY.land + h + 7.5, p.y);
    g.add(spire);
  });

  // Ground: the town with the river cut out of it, and our hill.
  const land = new THREE.Shape([new THREE.Vector2(-7000, -300), new THREE.Vector2(7000, -300), new THREE.Vector2(7000, 9000), new THREE.Vector2(-7000, 9000)]);
  land.holes.push(new THREE.Path([at(-250, -HALF), at(3500, -HALF), at(3500, HALF), at(-250, HALF)].map((p) => new THREE.Vector2(p.x, -p.y))));
  g.add(new THREE.Mesh(new THREE.ShapeGeometry(land).rotateX(-Math.PI / 2).translate(0, CITY.land, 0), std(0x5a4f48, 0.95)));
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
    trees.push(new THREE.IcosahedronGeometry(1, 1).scale(s, s * 1.15, s).translate(p.x, hillY(d) + s, p.y));
  }
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

  // Hills on the horizon: rolling ranges as flat silhouettes, paler with distance. The middle range carries a slender
  // metal tower.
  const fog = new THREE.Color(M.fog);
  const ranges = [
    { d: 5600, base: 150, amp: 330, seed: 3, haze: 0.62 },
    { d: 4200, base: 80, amp: 270, seed: 8, haze: 0.22 },
  ];
  ranges.forEach((rg) => {
    const rr = rng(rg.seed);
    const ph = [rr() * 6, rr() * 6, rr() * 6, rr() * 6];
    rg.dist = (az) => rg.d + Math.sin(az * 0.05 + ph[3]) * 300;
    const pos = [];
    const steps = 240;
    for (let i = 0; i <= steps; i++) {
      const az = -46 + (92 * i) / steps;
      const k = 0.5 + 0.28 * Math.sin(az * 0.07 + ph[0]) + 0.16 * Math.sin(az * 0.19 + ph[1]) + 0.07 * Math.sin(az * 0.47 + ph[2]);
      const p = polar(az, rg.dist(az));
      pos.push(p.x, CITY.land + rg.base + rg.amp * k, p.y, p.x, CITY.land - 60, p.y);
    }
    const index = [];
    for (let i = 0; i < steps; i++) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(index);
    const range = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(M.hills).lerp(fog, rg.haze), fog: false, toneMapped: false, side: THREE.DoubleSide }));
    g.add(range);
    rg.top = (az) => {
      const i = Math.round(((az + 46) / 92) * steps);
      return pos[i * 6 + 1];
    };
  });
  const towerAz = -12;
  const tp = polar(towerAz, ranges[1].dist(towerAz) - 20);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 5, 90, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(M.hills).lerp(fog, 0.22), fog: false, toneMapped: false }));
  tower.position.set(tp.x, ranges[1].top(towerAz) + 40, tp.y);
  g.add(tower);

  onLayer(g, LAYERS.city, false);
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
  lamp.position.set(-0.6, 1.15, -0.9);
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
  const shade = desk.lamp.userData.shade;
  desk.group.updateMatrixWorld(true);
  const spot = all(new THREE.SpotLight(M.room.lamp[0], M.room.lamp[1], 4, 0.95, 0.85, 2));
  shade.getWorldPosition(spot.position);
  spot.position.y -= 0.02;
  spot.target.position.set(spot.position.x + 0.28, ROOM.deskY, spot.position.z + 0.28);
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

export function createOffice(moment) {
  const scene = new THREE.Scene();
  const room = buildRoom();
  const desk = buildDesk();
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

// Fixes to the Blender export, applied by optimize.mjs before simplification.
// - seatFox: the fox's body sits half inside the planet; lift the fox along the planet's normal so it rests on it.
// - wrapScarf: the scarf is a straight ribbon that only passes behind the neck; carry it on once around the neck.
import * as THREE from 'three';

const nodeNamed = (doc, name) => doc.getRoot().listNodes().find((n) => n.getName() === name);
const worldMatrix = (node) => new THREE.Matrix4().fromArray(node.getWorldMatrix());

// World-space vertices of a node's mesh, and its triangles as a three.js mesh (for raycasting).
function worldGeometry(node) {
  const m = worldMatrix(node);
  const points = [];
  const index = [];
  for (const prim of node.getMesh().listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    const base = points.length;
    const p = [0, 0, 0];
    for (let i = 0; i < pos.getCount(); i++) points.push(new THREE.Vector3(...pos.getElement(i, p)).applyMatrix4(m));
    const idx = prim.getIndices();
    for (let i = 0; i < (idx ? idx.getCount() : pos.getCount()); i++) index.push(base + (idx ? idx.getScalar(i) : i));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  geo.setIndex(index);
  return { points, mesh: new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })) };
}

// Area-weighted smooth normals for an indexed position array.
function smoothNormals(pos, index) {
  const n = new Float32Array(pos.length);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < index.length; i += 3) {
    const [ia, ib, ic] = [index[i] * 3, index[i + 1] * 3, index[i + 2] * 3];
    a.fromArray(pos, ia);
    b.fromArray(pos, ib).sub(a);
    c.fromArray(pos, ic).sub(a);
    b.cross(c);
    for (const k of [ia, ib, ic]) {
      n[k] += b.x;
      n[k + 1] += b.y;
      n[k + 2] += b.z;
    }
  }
  for (let k = 0; k < n.length; k += 3) a.fromArray(n, k).normalize().toArray(n, k);
  return n;
}

// The fox (head, body, tail) moves as one, keeping its pose. Only `sink` of its body stays below the surface, so it
// sits on the ground rather than in it. Returns the lift; zero once the export is already right.
export function seatFox(doc, { sink = 0.025 } = {}) {
  const fox = ['Cube', 'Cube.002', 'Cube.003'].map((n) => nodeNamed(doc, n));
  const center = new THREE.Vector3().setFromMatrixPosition(worldMatrix(nodeNamed(doc, 'planet.002')));
  const body = worldGeometry(fox[1]).points;
  const up = body.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(body.length).sub(center).normalize();
  // Ground level under the fox: the planet's radius around that direction.
  const ground = worldGeometry(nodeNamed(doc, 'planet.002')).points
    .map((p) => p.clone().sub(center))
    .filter((d) => d.clone().normalize().dot(up) > Math.cos(0.4));
  const radius = ground.reduce((s, d) => s + d.length(), 0) / ground.length;
  const depth = Math.max(...body.map((p) => radius - p.distanceTo(center)));
  const lift = depth - sink;
  if (lift <= 0) return 0;
  for (const node of fox) {
    const parent = node.getParentNode();
    const offset = up.clone().multiplyScalar(lift);
    if (parent) offset.applyMatrix3(new THREE.Matrix3().setFromMatrix4(worldMatrix(parent)).invert());
    node.setTranslation(new THREE.Vector3(...node.getTranslation()).add(offset).toArray());
    // The (constant) actions would put it back: move their keys too.
    for (const anim of doc.getRoot().listAnimations()) {
      for (const channel of anim.listChannels()) {
        if (channel.getTargetNode() !== node || channel.getTargetPath() !== 'translation') continue;
        const sampler = channel.getSampler();
        const out = sampler.getOutput().clone();
        const v = [0, 0, 0];
        for (let i = 0; i < out.getCount(); i++) out.setElement(i, new THREE.Vector3(...out.getElement(i, v)).add(offset).toArray());
        sampler.setOutput(out);
      }
    }
  }
  return lift;
}

// The ribbon starts in mid-air beside the neck. Carry it on, from its own end edge, once around the neck: same
// width, same single sheet, rising and tightening a little in front, and ending tucked behind the ribbon's start.
export function wrapScarf(doc, { turn = 294, gap = 0.006, lean0 = 0.85, pull = 0.35, steps = 110 } = {}) {
  const coatNode = nodeNamed(doc, 'Cube.001');
  const ribbonNode = nodeNamed(doc, 'echarpe');
  const coatMatrix = worldMatrix(coatNode);
  const toCoat = coatMatrix.clone().invert();
  const coat = worldGeometry(coatNode).mesh;
  coat.updateMatrixWorld(true);

  // Neck frame: the coat's up axis, through the middle of the hair (the head).
  const up = new THREE.Vector3().setFromMatrixColumn(coatMatrix, 1).normalize();
  const axis = new THREE.Box3().setFromPoints(worldGeometry(nodeNamed(doc, 'planet.001')).points).getCenter(new THREE.Vector3());
  const front = new THREE.Vector3(0, 0, -1).projectOnPlane(up).normalize();
  const side = up.clone().cross(front);
  const polar = (p) => {
    const d = p.clone().sub(axis);
    return { y: d.dot(up), r: Math.hypot(d.dot(side), d.dot(front)), th: Math.atan2(d.dot(front), d.dot(side)) };
  };
  const dir = (th) => side.clone().multiplyScalar(Math.cos(th)).addScaledVector(front, Math.sin(th));
  const point = (th, r, y) => axis.clone().addScaledVector(up, y).addScaledVector(dir(th), r);
  const angle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  // Distance from the axis to the outside of the coat, at a given angle and height.
  const raycaster = new THREE.Raycaster();
  const coatRadius = (th, y) => {
    raycaster.set(point(th, 0, y), dir(th));
    const hits = raycaster.intersectObject(coat);
    return hits.length ? hits[hits.length - 1].distance : 0;
  };

  // The ribbon, in world space and around the neck axis.
  const ribbonMatrix = worldMatrix(ribbonNode);
  const ribbonNormals = new THREE.Matrix3().getNormalMatrix(ribbonMatrix);
  const ribbonPrim = ribbonNode.getMesh().listPrimitives()[0];
  const ribbon = [];
  const tmp = [0, 0, 0];
  for (let i = 0; i < ribbonPrim.getAttribute('POSITION').getCount(); i++) {
    const p = new THREE.Vector3(...ribbonPrim.getAttribute('POSITION').getElement(i, tmp)).applyMatrix4(ribbonMatrix);
    const n = new THREE.Vector3(...ribbonPrim.getAttribute('NORMAL').getElement(i, tmp)).applyMatrix3(ribbonNormals).normalize();
    const q = polar(p);
    ribbon.push({ p, n, ...q, r0: q.r });
  }

  // Its first stretch floats a hand's width off the neck: bring it in by `pull` towards the coat, fading out before
  // it leaves on the wind, so the far part is untouched.
  const end = ribbon.reduce((a, b) => (b.r < a.r ? b : a));
  const onward = Math.sign(ribbon.filter((v) => v.r > end.r + 0.01 && v.r < end.r + 0.04).reduce((s, v) => s + angle(v.th - end.th), 0));
  for (const v of ribbon) {
    v.w = 1 - THREE.MathUtils.smoothstep(angle(v.th - end.th) * onward, THREE.MathUtils.degToRad(30), THREE.MathUtils.degToRad(120));
    const target = coatRadius(v.th, v.y) + gap;
    if (v.w <= 0 || v.r <= target) continue;
    v.r -= pull * v.w * (v.r - target);
    v.p = point(v.th, v.r, v.y);
  }
  // Write it back, with normals rebuilt where it moved (shared by the copies of a vertex on UV seams).
  const ribbonLocal = ribbonMatrix.clone().invert();
  const ribbonPos = ribbonPrim.getAttribute('POSITION').clone();
  ribbon.forEach((v, i) => ribbonPos.setElement(i, v.p.clone().applyMatrix4(ribbonLocal).toArray()));
  const key = (v) => v.p.toArray().map((x) => x.toFixed(5)).join();
  const faceSum = new Map();
  const ribbonIndex = ribbonPrim.getIndices().getArray();
  for (let i = 0; i < ribbonIndex.length; i += 3) {
    const [a, b, c] = [0, 1, 2].map((k) => ribbon[ribbonIndex[i + k]]);
    const n = b.p.clone().sub(a.p).cross(c.p.clone().sub(a.p));
    for (const v of [a, b, c]) faceSum.set(key(v), (faceSum.get(key(v)) || new THREE.Vector3()).add(n));
  }
  const flip = ribbon.reduce((s, v) => s + faceSum.get(key(v)).clone().normalize().dot(v.n), 0) < 0 ? -1 : 1;
  const ribbonNrm = ribbonPrim.getAttribute('NORMAL').clone();
  const toRibbonNormals = new THREE.Matrix3().getNormalMatrix(ribbonLocal);
  ribbon.forEach((v, i) => {
    if (v.w <= 0) return;
    v.n.lerp(faceSum.get(key(v)).clone().normalize().multiplyScalar(flip), v.w).normalize();
    ribbonNrm.setElement(i, v.n.clone().applyMatrix3(toRibbonNormals).normalize().toArray());
  });
  ribbonPrim.setAttribute('POSITION', ribbonPos).setAttribute('NORMAL', ribbonNrm);

  // The end edge: the column of vertices that was closest to the neck, from bottom to top.
  const near = ribbon.filter((v) => v.r0 < end.r0 + 0.012 && Math.abs(angle(v.th - end.th)) < THREE.MathUtils.degToRad(10));
  // The export repeats some vertices (UV seams): keep one per position.
  const edge = [...new Map(near.map((v) => [v.p.toArray().map((x) => x.toFixed(5)).join(), v])).values()].sort((a, b) => a.y - b.y);
  const th0 = edge.reduce((s, v) => s + v.th, 0) / edge.length;
  const r0 = edge.reduce((s, v) => s + v.r, 0) / edge.length;
  const y0 = (edge[0].y + edge[edge.length - 1].y) / 2;
  const h0 = (edge[edge.length - 1].y - edge[0].y) / 2;
  // The ribbon leaves the neck one way round; the turn goes the other way.
  const sign = -onward;

  // Along the turn (s from 0 to 1): height and half-width of the band, and the radius that keeps it off the coat.
  const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);
  const rise = (s) => smooth(0, 0.4, s) * (1 - 0.5 * smooth(0.75, 1, s));
  const frame = [];
  for (let i = 0; i <= steps; i++) {
    const s = i / steps;
    const th = th0 + sign * s * THREE.MathUtils.degToRad(turn);
    // In front it rides up under the hair, so it shows above the ribbon from the camera; a slow sway keeps it soft.
    const yc = y0 + 0.06 * rise(s) + 0.008 * Math.sin(s * Math.PI * 5) * smooth(0, 0.2, s);
    const h = h0 * (1 - 0.25 * rise(s));
    // Away from the join the band leans in with the neck (a cone here), so it hugs it instead of standing off.
    const lean = lean0 * smooth(0, 0.35, s);
    let need = 0;
    for (const v of edge) {
      const dy = ((v.y - y0) / h0) * h;
      need = Math.max(need, coatRadius(th, yc + dy) + gap + lean * dy);
    }
    frame.push({ s, th, yc, h, lean, need });
  }
  // Smooth the clearance so the coat's collar points make a gentle swell, not a kink.
  const at = (k) => frame[Math.min(Math.max(k, 0), steps)].need;
  const swell = frame.map((_, k) => Math.max(...[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((d) => at(k + d))));
  frame.forEach((f, k) => {
    const blurred = [-3, -2, -1, 0, 1, 2, 3].reduce((sum, d) => sum + swell[Math.min(Math.max(k + d, 0), steps)] * [1, 6, 15, 20, 15, 6, 1][d + 3], 0) / 64;
    const r = THREE.MathUtils.lerp(r0, blurred, smooth(0, 0.2, f.s)) + 0.006 * Math.sin(f.s * Math.PI * 6) * smooth(0, 0.15, f.s);
    f.r = THREE.MathUtils.lerp(r, Math.max(r, f.need), smooth(0, 0.1, f.s));
  });

  // Sections: the first one is the ribbon's edge itself; its small offsets fade out along the turn.
  const positions = [];
  for (const f of frame) {
    const keep = 1 - smooth(0, 0.3, f.s);
    for (const v of edge) {
      const dy = ((v.y - y0) / h0) * f.h;
      const p = point(f.th + angle(v.th - th0) * keep, f.r + (v.r - r0) * keep - f.lean * dy, f.yc + dy);
      positions.push(...p.applyMatrix4(toCoat).toArray());
    }
  }
  const rows = edge.length;
  const index = [];
  for (let i = 0; i < steps; i++) {
    for (let k = 0; k < rows - 1; k++) {
      const a = i * rows + k, b = a + rows;
      index.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const normals = smoothNormals(positions, index);
  // Shade the join like the ribbon: same side facing out, and the ribbon's own normals on the shared edge.
  const toCoatNormals = new THREE.Matrix3().getNormalMatrix(toCoat);
  const edgeNormals = edge.map((v) => v.n.clone().applyMatrix3(toCoatNormals).normalize());
  const n1 = new THREE.Vector3().fromArray(normals, (rows + (rows >> 1)) * 3);
  if (n1.dot(edgeNormals[rows >> 1]) < 0) {
    for (let i = 0; i < index.length; i += 3) [index[i + 1], index[i + 2]] = [index[i + 2], index[i + 1]];
    for (let k = 0; k < normals.length; k++) normals[k] = -normals[k];
  }
  edgeNormals.forEach((n, k) => n.toArray(normals, k * 3));

  const buffer = doc.getRoot().listBuffers()[0];
  const accessor = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', accessor('VEC3', new Float32Array(positions)))
    .setAttribute('NORMAL', accessor('VEC3', normals))
    .setIndices(accessor('SCALAR', new Uint32Array(index)))
    .setMaterial(ribbonPrim.getMaterial());
  const node = doc.createNode('echarpe.tour').setMesh(doc.createMesh('echarpe.tour').addPrimitive(prim));
  coatNode.addChild(node);
  return node;
}

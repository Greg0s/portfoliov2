// Shrinks the Petit Prince GLB for the web: per-mesh simplification, then quantization and meshopt compression.
// Usage: node optimize.mjs <in.glb> <out-simplified.glb> <out-web.glb>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplifyPrimitive, quantize, meshopt, resample } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';

const [input, outSimple, outWeb] = process.argv.slice(2);
await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(input);
const root = doc.getRoot();

// Target share of triangles kept, by mesh name. Decor pieces are tiny on screen; the characters keep their detail.
const ratioFor = (name) => {
  if (name === 'Cylinder') return 0.004; // shooting star trail
  if (name.startsWith('Circle')) return 0.02; // five stars
  if (/^Sphere\.00[13-9]$/.test(name)) return 0.04; // glowing decor planets
  if (name.startsWith('Torus')) return 0.3; // rings
  if (name === 'Sphere' || name === 'Sphere.002') return 0.1; // main planet and hair: smooth in this export
  // The rose's petals are thin two-sided sheets: rebuilt normals would cancel out, so it keeps its own.
  return 1; // fox, coat, scarf
};

// Area-weighted smooth normals on the welded mesh (gltf-transform's normals() makes flat ones).
const smoothNormals = (prim) => {
  const pos = prim.getAttribute('POSITION').getArray();
  const idx = prim.getIndices().getArray();
  const n = new Float32Array(pos.length);
  for (let i = 0; i < idx.length; i += 3) {
    const [a, b, c] = [idx[i] * 3, idx[i + 1] * 3, idx[i + 2] * 3];
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const k of [a, b, c]) {
      n[k] += nx;
      n[k + 1] += ny;
      n[k + 2] += nz;
    }
  }
  for (let k = 0; k < n.length; k += 3) {
    const l = Math.hypot(n[k], n[k + 1], n[k + 2]) || 1;
    n[k] /= l;
    n[k + 1] /= l;
    n[k + 2] /= l;
  }
  prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(n).setBuffer(root.listBuffers()[0]));
};

const count = (prim) => (prim.getIndices() ? prim.getIndices().getCount() : prim.getAttribute('POSITION').getCount()) / 3;
let before = 0;
let after = 0;
for (const mesh of root.listMeshes()) {
  const simplify = ratioFor(mesh.getName()) < 1;
  for (const prim of mesh.listPrimitives()) {
    // On meshes we simplify, UVs (no textures here) and split normals only block vertex welding; smooth normals are
    // rebuilt afterwards. The others keep both: the rose's anisotropic petals need their UVs.
    if (!simplify) continue;
    for (const semantic of prim.listSemantics()) {
      if (semantic.startsWith('TEXCOORD_') || semantic === 'NORMAL') prim.setAttribute(semantic, null);
    }
  }
}
await doc.transform(weld());
for (const mesh of root.listMeshes()) {
  const ratio = ratioFor(mesh.getName());
  for (const prim of mesh.listPrimitives()) {
    const n = count(prim);
    before += n;
    if (ratio < 1) simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio, error: 0.01, lockBorder: false });
    if (!prim.getAttribute('NORMAL')) smoothNormals(prim);
    after += count(prim);
  }
}
// keepAttributes: prune() would drop the rose's UVs (no textures), which its anisotropic petals still need.
await doc.transform(resample(), dedup(), prune({ keepAttributes: true }));
await io.write(outSimple, doc);
await doc.transform(quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(outWeb, doc);
console.log('triangles', before, '->', Math.round(after));
for (const mesh of root.listMeshes()) {
  console.log('  ', mesh.getName().padEnd(12), mesh.listPrimitives().map((p) => Math.round(count(p))).join('+'));
}

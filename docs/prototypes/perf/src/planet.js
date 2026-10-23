// The Little Prince planet as the site will show it: the web model, the generated relief and hair, the museum spot
// (with the dusk or dawn colour), its animations and the scarf in the wind. Ported from
// `../petit-prince/render.html` (the "noir" ambience), with the site's settings from the main spec §6: 2,048 px shadow
// map, relief detail reduced on mobile.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const SPOT = { aube: 0xffc2a0, crepuscule: 0xffa070 };
const HEMI = { aube: 0xe8a890, crepuscule: 0xd98a7a };
const LEFTOVERS = ['Cube.004', 'Cube.005', 'Cube.006', 'Cylinder.006', 'Cylinder.007', 'Cylinder.008', 'Cylinder.009', 'Cylinder.010', 'Cylinder.011', 'pétale save', 'pétale save.002', 'pétale.004', 'pétale.005', 'pétale.006'];
const HIDDEN = ['buste', 'bras droit', 'bras g', 'Cylinder'];
const DECOR = ['etoile', 'etoile.001', 'etoile.002', 'etoile.003', 'etoile.004', 'planet', 'planet.003', 'planet.004', 'planet.005', 'planet.006', 'planet.007', 'planet.008', 'planet.009', 'Torus.001', 'Torus.002', 'Torus.003'];

const sn = (names) => new Set(names.map((n) => THREE.PropertyBinding.sanitizeNodeName(n)));

const rng = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
};
const randomDir = (r) => {
  const u = r() * 2 - 1;
  const a = r() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return new THREE.Vector3(s * Math.cos(a), u, s * Math.sin(a));
};

function craterPlanet(detail, calm) {
  const r = rng(5);
  const noise = new SimplexNoise({ random: r });
  const geo = mergeVertices(new THREE.IcosahedronGeometry(1, detail));
  const craters = [];
  for (let i = 0; i < 46; i++) {
    const size = 0.05 + Math.pow(r(), 2.6) * 0.26;
    craters.push({ c: randomDir(r), size, depth: 0.16 + r() * 0.14 });
  }
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    let h = 0;
    let amp = 0.03;
    let freq = 1.4;
    for (let o = 0; o < 5; o++) {
      h += amp * noise.noise3d(v.x * freq + 11, v.y * freq, v.z * freq);
      amp *= 0.5;
      freq *= 2.15;
    }
    for (const k of craters) {
      const d = Math.acos(THREE.MathUtils.clamp(v.dot(k.c), -1, 1)) / k.size;
      if (d < 1.7) {
        const bowl = d < 1 ? d * d - 1 : 0;
        const rim = 0.32 * Math.exp(-Math.pow((d - 1.02) / 0.26, 2));
        h += k.size * k.depth * (bowl + rim);
      }
    }
    let keep = 1;
    for (const c of calm) {
      const ang = Math.acos(THREE.MathUtils.clamp(v.dot(c.dir), -1, 1));
      keep *= 1 - (1 - c.floor) * Math.exp(-Math.pow(ang / c.radius, 2));
    }
    v.multiplyScalar(1 + h * keep);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function crumpledBall(detail) {
  const noise = new SimplexNoise({ random: rng(21) });
  const geo = mergeVertices(new THREE.IcosahedronGeometry(1, detail));
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    let h = 0;
    let amp = 1;
    let f = 1.4;
    for (let o = 0; o < 2; o++) {
      const n = noise.noise3d(v.x * f + o * 7.1, v.y * f, v.z * f);
      h += amp * Math.pow(1 - Math.sqrt(n * n + 0.03), 1.4);
      amp *= 0.4;
      f *= 2.1;
    }
    v.multiplyScalar(0.84 + 0.36 * h);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

const meshIn = (o) => {
  let found = null;
  if (o) o.traverse((c) => { if (!found && c.isMesh) found = c; });
  return found;
};

// The scarf wave, on the CPU as in the prototype, with buffers allocated once.
function scarfWind(root) {
  const byName = (n) => root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(n));
  const mesh = meshIn(byName('echarpe'));
  if (!mesh) return () => {};
  root.updateMatrixWorld(true);
  const geo = mesh.geometry;
  const toWorld = mesh.matrixWorld.clone();
  const toLocal = toWorld.clone().invert();
  const up = new THREE.Vector3().setFromMatrixColumn(byName('Cube.001').matrixWorld, 1).normalize();
  const axis = byName('planet.001').getWorldPosition(new THREE.Vector3());
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(toWorld);
  const count = geo.attributes.position.count;
  const p = [];
  const n = [];
  const r = [];
  for (let i = 0; i < count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(geo.attributes.position, i).applyMatrix4(toWorld);
    p.push(v);
    n.push(new THREE.Vector3().fromBufferAttribute(geo.attributes.normal, i).applyMatrix3(normalMatrix).normalize());
    const d = v.clone().sub(axis);
    r.push(d.addScaledVector(up, -d.dot(up)).length());
  }
  const r0 = Math.min(...r);
  const r1 = Math.max(...r);
  const s = r.map((x) => (x - r0) / (r1 - r0));
  const len = r1 - r0;
  const k = s.map((x) => Math.pow(THREE.MathUtils.smoothstep(x, 0.08, 1), 1.3));
  // Positions only: normals are kept from the rest pose (the wave is small).
  // The web model is quantized: the wave writes plain floats in the same local space.
  const pos = new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const normals = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
  for (let i = 0; i < count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(geo.attributes.normal, i);
    normals.setXYZ(i, v.x, v.y, v.z);
  }
  geo.setAttribute('position', pos);
  geo.setAttribute('normal', normals);
  const tmp = new THREE.Vector3();
  return (phase) => {
    for (let i = 0; i < count; i++) {
      const a = 2 * Math.PI * (1.15 * s[i] - phase);
      tmp.copy(p[i]).addScaledVector(n[i], len * 0.07 * k[i] * Math.sin(a)).addScaledVector(up, len * 0.045 * k[i] * Math.sin(a + 1.2)).applyMatrix4(toLocal);
      pos.setXYZ(i, tmp.x, tmp.y, tmp.z);
    }
    pos.needsUpdate = true;
  };
}

export async function createPlanet({ renderer, url, moment = 'crepuscule', mobile = false, aspect = 1 }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c0c0d);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.035;
  pmrem.dispose();

  const center = new THREE.Vector3(0, 0, -0.58);
  scene.add(new THREE.HemisphereLight(HEMI[moment], 0x000000, 0.06));
  const dir = (color, intensity, p) => {
    const l = new THREE.DirectionalLight(color, intensity);
    l.position.copy(center).add(new THREE.Vector3(...p));
    l.target.position.copy(center);
    scene.add(l, l.target);
  };
  dir(0xffffff, 0.35, [-6, 6, -8]);
  dir(0xffffff, 0.04, [7, 4, 4]);
  dir(0xdfe6ff, 0.9, [-2, -6, -8]);
  const spot = new THREE.SpotLight(SPOT[moment], 7.5, 0, 0.165, 1, 0);
  spot.position.copy(center).add(new THREE.Vector3(-3.5, 8, -6.5));
  spot.target.position.set(-0.25, 0.75, -1.3);
  spot.castShadow = true;
  spot.shadow.mapSize.set(2048, 2048);
  spot.shadow.bias = -0.0002;
  spot.shadow.normalBias = 0.015;
  spot.shadow.radius = 6;
  spot.shadow.camera.near = 2;
  spot.shadow.camera.far = 30;
  scene.add(spot, spot.target);

  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url);
  const root = gltf.scene;
  scene.add(root);
  const mixer = new THREE.AnimationMixer(root);
  gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
  root.updateMatrixWorld(true);

  const byName = (n) => root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(n));
  const planet = meshIn(byName('planet.002'));
  const hair = meshIn(byName('planet.001'));
  for (const [m, name] of [[planet, 'planet.002'], [hair, 'planet.001']]) {
    if (m.parent && m.parent !== root && m !== byName(name)) {
      m.position.set(0, 0, 0);
      m.quaternion.identity();
      m.scale.set(1, 1, 1);
    }
  }
  root.updateMatrixWorld(true);
  const toLocal = (name) => planet.worldToLocal(byName(name).getWorldPosition(new THREE.Vector3())).normalize();
  const calm = [
    { dir: toLocal('Cube.001'), radius: 0.42, floor: 0.15 },
    { dir: toLocal('Cube'), radius: 0.38, floor: 0.2 },
    { dir: toLocal('pétale.003'), radius: 0.25, floor: 0.3 },
  ];
  planet.geometry = craterPlanet(mobile ? 72 : 110, calm);
  planet.material.roughness = 0.93;
  planet.material.color.setRGB(0.135, 0.19, 0.27);
  hair.geometry = crumpledBall(mobile ? 48 : 64);
  hair.material.roughness = 0.4;
  hair.material.color.set(0xf5cb3a);

  const roles = [['hide', sn([...LEFTOVERS, ...HIDDEN])], ['decor', sn(DECOR)]];
  const rose = THREE.PropertyBinding.sanitizeNodeName('pétale.003');
  root.traverse((o) => {
    if (!o.isMesh) return;
    let role = 'main';
    let inRose = false;
    for (let n = o; n && n !== root; n = n.parent) {
      const hit = roles.find(([, set]) => set.has(n.name));
      if (hit && role === 'main') role = hit[0];
      if (n.name === rose) inRose = true;
    }
    if (role === 'hide') o.visible = false;
    else if (role === 'decor') {
      o.material = o.material.clone();
      o.material.emissive.setRGB(1, 1, 1);
      o.material.emissiveIntensity = 1.3;
    } else {
      o.castShadow = !inRose;
      o.receiveShadow = true;
    }
  });

  const wind = scarfWind(root);
  const camera = new THREE.PerspectiveCamera(20, aspect, 0.1, 400);
  camera.up.set(0, 0, -1);
  camera.position.set(center.x, 15.5, center.z);
  camera.lookAt(center);

  let lastT = 0;
  return {
    scene,
    camera,
    // t in seconds. The scarf runs a 6 s loop.
    update(t) {
      mixer.update(Math.max(0, t - lastT));
      lastT = t;
      wind((t / 6) % 1);
    },
    shadowMaps: [2048],
  };
}

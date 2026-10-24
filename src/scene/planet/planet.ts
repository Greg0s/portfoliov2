/**
 * The live planet (main spec §6): Grégoire's model, its generated relief and hair, the museum spot of the visitor's
 * moment, the wind in the scarf and the rose. It draws in its own small canvas inside the opening's planet, seen from
 * above with the prototype's camera, so that it lands exactly on its fallback image and takes the opening's float,
 * recession and blur from the CSS like the image did. The journey draws it while it is sharp enough to be seen
 * (`handoff.ts`).
 */
import {
  ACESFilmicToneMapping,
  BufferAttribute,
  BufferGeometry,
  Group,
  Matrix3,
  MathUtils,
  PCFShadowMap,
  PerspectiveCamera,
  Scene,
  Texture,
  Vector3,
  WebGLRenderer,
  type MeshStandardMaterial,
  type Object3D,
} from 'three';
import { addLights, CENTER, mixMoments } from './lights';
import { isMesh, loadPlanetModel, meshIn, type PlanetModel } from './load';
import { createWind, type WindState } from './wind';
import { cappedPixelRatio } from '../renderer';
import { isSoftwareRenderer } from '../quality';
import type { Moment } from '../time';
import type { Arrays } from '../workers/relief';
import type { GeometryReply, GeometryRequest } from '../workers/geometry.worker';

export interface PlanetOptions {
  modelUrl: string;
  /** Draw even with a software renderer (`?planete=live`). */
  forced: boolean;
  moment: Moment;
  mobile: boolean;
  /** The canvas's size in CSS px: the opening's planet square. */
  size: number;
}

export interface LivePlanet {
  canvas: HTMLCanvasElement;
  /** Draws a frame: `delta` ms of wind since the last one (0 holds the pose). */
  render(delta: number): void;
  setMoment(moment: Moment): void;
  resize(size: number, mobile: boolean): void;
  dispose(): void;
}

/** Thrown when the device draws WebGL in software. */
export class SlowRenderer extends Error {}

/** How long the wind takes to rise when the planet first moves, so that it leaves its fallback's pose smoothly. */
const WIND_RISE = 1500;

/** The relief, built once per visit and kept for a planet built again after the office. */
const reliefs = new Map<string, Promise<GeometryReply>>();

function buildRelief(request: GeometryRequest): Promise<GeometryReply> {
  const key = `${String(request.detail)}/${String(request.hairDetail)}`;
  let relief = reliefs.get(key);
  if (!relief) {
    relief = new Promise<GeometryReply>((resolve, reject) => {
      const worker = new Worker(new URL('../workers/geometry.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<GeometryReply>) => {
        resolve(event.data);
        worker.terminate();
      };
      worker.onerror = (event) => {
        reject(new Error(event.message));
        worker.terminate();
      };
      worker.postMessage(request);
    });
    reliefs.set(key, relief);
    relief.catch(() => reliefs.delete(key));
  }
  return relief;
}

function geometryOf(arrays: Arrays): BufferGeometry {
  const geometry = new BufferGeometry();
  // Copies: the cached arrays stay whole for a planet built again.
  geometry.setAttribute('position', new BufferAttribute(arrays.position.slice(), 3));
  geometry.setAttribute('normal', new BufferAttribute(arrays.normal.slice(), 3));
  geometry.setIndex(new BufferAttribute(arrays.index.slice(), 1));
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * The scarf in the wind (the prototype's `blowScarf`): a wave runs along the ribbon, from nothing at the neck to its
 * free end, rocking it across its face and up and down. Its normals are rebuilt from the moved faces, vertices split
 * on UV seams sharing one. Returns a function that poses the ribbon at a phase, `amount` scaling the wave.
 */
function scarfWind(model: PlanetModel): (phase: number, amount: number) => void {
  const mesh = model.scarf;
  const neck = model.byName('Cube.001');
  const head = model.byName('planet.001');
  if (!mesh || !neck || !head) return () => undefined;
  const geometry = mesh.geometry;
  const rest = geometry.getAttribute('position');
  const restNormal = geometry.getAttribute('normal');
  const count = rest.count;
  const toWorld = mesh.matrixWorld.clone();
  const toLocal = toWorld.clone().invert();
  const toLocalNormal = new Matrix3().setFromMatrix4(toWorld).transpose();
  const normalMatrix = new Matrix3().getNormalMatrix(toWorld);
  const up = new Vector3().setFromMatrixColumn(neck.matrixWorld, 1).normalize();
  const axis = head.getWorldPosition(new Vector3());

  const p = new Float32Array(count * 3);
  const n = new Float32Array(count * 3);
  const radius = new Float32Array(count);
  const v = new Vector3();
  const d = new Vector3();
  for (let i = 0; i < count; i += 1) {
    v.fromBufferAttribute(rest, i).applyMatrix4(toWorld);
    v.toArray(p, i * 3);
    d.fromBufferAttribute(restNormal, i)
      .applyMatrix3(normalMatrix)
      .normalize()
      .toArray(n, i * 3);
    d.copy(v).sub(axis);
    radius[i] = d.addScaledVector(up, -d.dot(up)).length();
  }
  let r0 = Infinity;
  let r1 = -Infinity;
  radius.forEach((r) => {
    r0 = Math.min(r0, r);
    r1 = Math.max(r1, r);
  });
  const len = r1 - r0;
  // Distance along the ribbon (0 at the neck, 1 at the free end) and how much the wave moves each vertex.
  const s = radius.map((r) => (r - r0) / len);
  const k = s.map((x) => Math.pow(MathUtils.smoothstep(x, 0.08, 1), 1.3));
  // Vertices at the same place (UV seams) share one normal.
  const groups = new Uint32Array(count);
  const seen = new Map<string, number>();
  for (let i = 0; i < count; i += 1) {
    const key = [p[i * 3], p[i * 3 + 1], p[i * 3 + 2]].map((x) => (x ?? 0).toFixed(5)).join();
    let group = seen.get(key);
    if (group === undefined) {
      group = seen.size;
      seen.set(key, group);
    }
    groups[i] = group;
  }
  const index = geometry.getIndex();
  const triangles = index ? Uint32Array.from(index.array) : Uint32Array.from({ length: count }, (_, i) => i);

  // The quantized model's attributes become plain floats in the same local space.
  const position = new BufferAttribute(new Float32Array(count * 3), 3);
  const normal = new BufferAttribute(new Float32Array(count * 3), 3);
  geometry.setAttribute('position', position);
  geometry.setAttribute('normal', normal);
  const moved = new Float32Array(count * 3);
  const sums = new Float32Array(seen.size * 3);
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();

  return (phase, amount) => {
    for (let i = 0; i < count; i += 1) {
      const angle = 2 * Math.PI * (1.15 * (s[i] ?? 0) - phase);
      const across = len * 0.07 * (k[i] ?? 0) * Math.sin(angle) * amount;
      const lift = len * 0.045 * (k[i] ?? 0) * Math.sin(angle + 1.2) * amount;
      for (let j = 0; j < 3; j += 1) {
        const o = i * 3 + j;
        moved[o] = (p[o] ?? 0) + (n[o] ?? 0) * across + up.getComponent(j) * lift;
      }
    }
    sums.fill(0);
    for (let t = 0; t < triangles.length; t += 3) {
      const ia = triangles[t] ?? 0;
      const ib = triangles[t + 1] ?? 0;
      const ic = triangles[t + 2] ?? 0;
      a.fromArray(moved, ia * 3);
      b.fromArray(moved, ib * 3).sub(a);
      c.fromArray(moved, ic * 3).sub(a);
      b.cross(c);
      for (const i of [ia, ib, ic]) {
        const g = (groups[i] ?? 0) * 3;
        sums[g] = (sums[g] ?? 0) + b.x;
        sums[g + 1] = (sums[g + 1] ?? 0) + b.y;
        sums[g + 2] = (sums[g + 2] ?? 0) + b.z;
      }
    }
    for (let i = 0; i < count; i += 1) {
      v.fromArray(moved, i * 3).applyMatrix4(toLocal);
      position.setXYZ(i, v.x, v.y, v.z);
      d.fromArray(sums, (groups[i] ?? 0) * 3).normalize();
      // On the same side as the file's normal.
      if (d.x * (n[i * 3] ?? 0) + d.y * (n[i * 3 + 1] ?? 0) + d.z * (n[i * 3 + 2] ?? 0) < 0) d.negate();
      d.applyMatrix3(toLocalNormal).normalize();
      normal.setXYZ(i, d.x, d.y, d.z);
    }
    position.needsUpdate = true;
    normal.needsUpdate = true;
    geometry.computeBoundingSphere();
  };
}

/** The rose sways on screen around the foot of its stem: a pivot there, turning around the camera's axis. */
function roseSway(model: PlanetModel): (degrees: number) => void {
  const rose = model.rose;
  const first = meshIn(rose ?? undefined);
  if (!rose || !first || !rose.parent) return () => undefined;
  const center = model.planet.getWorldPosition(new Vector3());
  const position = first.geometry.getAttribute('position');
  const v = new Vector3();
  const foot = new Vector3();
  let best = Infinity;
  for (let i = 0; i < position.count; i += 1) {
    v.fromBufferAttribute(position, i).applyMatrix4(first.matrixWorld);
    const distance = v.distanceTo(center);
    if (distance < best) {
      best = distance;
      foot.copy(v);
    }
  }
  const pivot: Object3D = new Group();
  pivot.position.copy(foot);
  model.root.add(pivot);
  pivot.updateMatrixWorld(true);
  pivot.attach(rose);
  // The camera looks down −y: a clockwise turn on screen is a negative turn around y.
  return (degrees) => {
    pivot.rotation.y = MathUtils.degToRad(-degrees);
  };
}

export async function createPlanet(container: HTMLElement, options: PlanetOptions): Promise<LivePlanet> {
  const mobile = options.mobile;
  // Without a GPU, the live planet would hold the page: the image stays, before anything is downloaded.
  if (!options.forced) {
    const probe = document.createElement('canvas').getContext('webgl2');
    if (!probe || isSoftwareRenderer(probe)) throw new SlowRenderer();
    probe.getExtension('WEBGL_lose_context')?.loseContext();
  }
  const model = await loadPlanetModel(options.modelUrl);
  const geometry = await buildRelief({
    kind: 'planet',
    detail: mobile ? 72 : 110,
    hairDetail: 64,
    calm: model.calm,
  });
  return assemble(container, options, model, geometry);
}

async function assemble(
  container: HTMLElement,
  options: PlanetOptions,
  model: PlanetModel,
  relief: GeometryReply,
): Promise<LivePlanet> {
  model.planet.geometry.dispose();
  model.planet.geometry = geometryOf(relief.planet);
  const planetMaterial = model.planet.material as MeshStandardMaterial;
  planetMaterial.roughness = 0.93;
  planetMaterial.color.setRGB(0.135, 0.19, 0.27);
  model.hair.geometry.dispose();
  model.hair.geometry = geometryOf(relief.hair);
  // A brighter, glossier gold than the file's, as in the Blender render.
  const hairMaterial = model.hair.material as MeshStandardMaterial;
  hairMaterial.roughness = 0.4;
  hairMaterial.color.set(0xf5cb3a);

  const canvas = document.createElement('canvas');
  canvas.className = 'planet-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  container.append(canvas);
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;

  const scene = new Scene();
  scene.add(model.root);
  let moment = options.moment;
  const lights = addLights(scene, renderer, moment, 2048);
  const blow = scarfWind(model);
  const sway = roseSway(model);
  blow(0, 0);

  const camera = new PerspectiveCamera(20, 1, 0.1, 400);
  camera.up.set(0, 0, -1);
  camera.position.set(CENTER.x, 15.5, CENTER.z);
  camera.lookAt(CENTER);

  const wind = createWind();
  let windState: WindState = { scarfPhase: 0, roseDeg: 0 };
  let moving = 0;
  let fade: { from: Moment; to: Moment; elapsed: number } | null = null;

  const resize = (size: number, mobile: boolean): void => {
    renderer.setPixelRatio(cappedPixelRatio(window.devicePixelRatio || 1, mobile));
    renderer.setSize(size, size, false);
  };
  resize(options.size, options.mobile);
  // Shaders compile in parallel where the browser can, so the first frame does not hold the page.
  await renderer.compileAsync(scene, camera);

  return {
    canvas,
    render(delta) {
      if (delta > 0) {
        windState = wind.advance(delta);
        moving += delta;
        const amount = MathUtils.smoothstep(moving, 0, WIND_RISE);
        blow(windState.scarfPhase, amount);
        sway(windState.roseDeg * amount);
      }
      if (fade) {
        fade.elapsed += Math.max(delta, 16);
        lights.setColors(mixMoments(fade.from, fade.to, fade.elapsed));
        if (fade.elapsed >= 2000) fade = null;
      }
      renderer.render(scene, camera);
    },
    setMoment(next) {
      if (next === moment) return;
      fade = { from: moment, to: next, elapsed: 0 };
      moment = next;
    },
    resize,
    dispose() {
      scene.traverse((mesh) => {
        if (!isMesh(mesh)) return;
        mesh.geometry.dispose();
        (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => {
          Object.values(material).forEach((value: unknown) => {
            if (value instanceof Texture) value.dispose();
          });
          material.dispose();
        });
      });
      lights.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}

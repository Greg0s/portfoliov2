/**
 * The office in relief (prototype, `?bureau=relief`): the live office's camera moves over its own layers instead of
 * its scene. The town is its layer, shifted and zoomed as the live town is; the room and the desk are their layers
 * lifted by their depth (`pnpm render-office-layers -- --layers=room-depth,desk-depth`), a grid of vertices set back
 * where the seated camera saw each pixel, so that the camera backing through the window and following the head sees
 * them with their true parallax. Everything the scene computes (lights, shadows, environments, the town) was done
 * once, when the layers were rendered: here one simple program draws three textured meshes, with nothing to compile
 * but that, and nothing to build.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  MultiplyBlending,
  NoToneMapping,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { FADE_PLANES, layerFade } from './arrival';
import { DEG } from './common';
import { placement, type Anchors } from './corners';
import type { Fit, FrameSpec } from './frame';
import { FRAMINGS, makeCamera, type Framing } from './framings';
import { glowTexture, halo, type Drawn, type OfficeScene } from './live';
import type { Moment } from '../time';
import { scenePixelRatio } from '../resolution';
import { avifShown } from '../../lib/avif';

/** The depth layers' range, as `scripts/office/render.ts` encodes it: metres over 16, on 16 bits. */
const DEPTH_RANGE = 16;
/** Nothing in the room stands closer to the seat than this, in metres: a nearer depth is a stray pixel. */
const NEAREST = 0.2;

type Xyz = [number, number, number];
interface ReliefMeta {
  w: number;
  h: number;
  overscan: number;
  anchors: {
    screen: Xyz[];
    window: Xyz[];
    bulb: Xyz;
    sun: { centre: Xyz; rim: Xyz } | null;
    pictures: { id: string; type: string; ratio: number; corners: Xyz[] }[];
    glowAzimuth: number;
  };
}

export interface ReliefOptions {
  moment: Moment;
  framing: Framing;
  frame: FrameSpec;
  /** The folder of the layers, of their depth and of `relief.json`. */
  base: string;
  size: { width: number; height: number };
}

const v3 = (p: Xyz): Vector3 => new Vector3(p[0], p[1], p[2]);

/** A picture's pixels as they are in the file: no colour conversion, alpha not premultiplied. */
async function pixels(src: string): Promise<ImageData> {
  const blob = await (await fetch(src)).blob();
  const bitmap = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('office relief: no 2D context');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * The layer's mesh: one vertex per pixel of its depth, set back along the seated camera's ray through that pixel.
 * Where nothing was drawn, the depth of the nearest drawn pixel is taken, so that the soft edges of the picture keep
 * their pixels (thin stems drawn in the picture but missed by the coarser depth); quads farther than that from anything
 * drawn are left out. With `cut`, a quad whose far corner is more than
 * `cut` times as far as its near one (an edge between an object and what is behind it) is left out too: the edge
 * then opens instead of stretching.
 */
function reliefGeometry(depth: ImageData, camera: PerspectiveCamera, cut: number): BufferGeometry {
  const { width: w, height: h, data } = depth;
  const z = new Float32Array(w * h);
  const drawn = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i += 1) {
    if ((data[i * 4 + 3] ?? 0) === 0) continue;
    const d = (((data[i * 4] ?? 0) * 256 + (data[i * 4 + 1] ?? 0)) / 65535) * DEPTH_RANGE;
    // A few pixels of the thin light strip under the ceiling come out at the camera itself: their neighbours stand in.
    if (d < NEAREST) continue;
    drawn[i] = 1;
    z[i] = d;
  }
  // A pixel far nearer than most of its neighbours is a stray one too (the light strip's thin edge): left to them.
  const strays: number[] = [];
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x;
      if (!drawn[i]) continue;
      const around = [i - 1, i + 1, i - w, i + w, i - w - 1, i - w + 1, i + w - 1, i + w + 1]
        .filter((j) => drawn[j])
        .map((j) => z[j] ?? 0)
        .sort((m, n) => m - n);
      const median = around[Math.floor(around.length / 2)];
      if (around.length >= 5 && median !== undefined && (z[i] ?? 0) < median * 0.7) strays.push(i);
    }
  }
  strays.forEach((i) => {
    drawn[i] = 0;
  });
  // Grown into what was not drawn, a few pixels a pass.
  const known = drawn.slice();
  for (let pass = 0; pass < 6; pass += 1) {
    const next = known.slice();
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = y * w + x;
        if (known[i]) continue;
        for (const j of [i - 1, i + 1, i - w, i + w]) {
          if (j < 0 || j >= w * h || !known[j]) continue;
          if (Math.abs((j % w) - x) > 1) continue;
          z[i] = z[j] ?? 0;
          next[i] = 1;
          break;
        }
      }
    }
    known.set(next);
  }
  const tanY = Math.tan((camera.fov * DEG) / 2);
  const tanX = tanY * camera.aspect;
  const positions = new Float32Array(w * h * 3);
  const uvs = new Float32Array(w * h * 2);
  const p = new Vector3();
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      const u = (x + 0.5) / w;
      const v = (y + 0.5) / h;
      const d = known[i] ? (z[i] ?? 1) : 1;
      p.set((u * 2 - 1) * tanX * d, (1 - v * 2) * tanY * d, -d).applyMatrix4(camera.matrixWorld);
      positions.set([p.x, p.y, p.z], i * 3);
      uvs.set([u, 1 - v], i * 2);
    }
  }
  const index: number[] = [];
  for (let y = 0; y < h - 1; y += 1) {
    for (let x = 0; x < w - 1; x += 1) {
      const a = y * w + x;
      const quad = [a, a + 1, a + w, a + w + 1];
      if (!quad.every((i) => known[i])) continue;
      if (cut > 0) {
        const zs = quad.map((i) => z[i] ?? 1);
        if (Math.max(...zs) > cut * Math.min(...zs)) continue;
      }
      index.push(a, a + w, a + 1, a + 1, a + w, a + w + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  return geometry;
}

function layerMaterial(map: Texture): MeshBasicMaterial {
  return new MeshBasicMaterial({ map, transparent: true, toneMapped: false, fog: false, side: DoubleSide });
}

export async function createReliefOffice(options: ReliefOptions): Promise<OfficeScene> {
  const { framing, frame, moment, base } = options;
  const query = new URLSearchParams(location.search);
  const cut = Number(query.get('relief-cut') ?? 0);
  const [response, avif] = await Promise.all([fetch(`${base}/relief.json`), avifShown()]);
  if (!response.ok) throw new Error(`office relief: relief.json ${String(response.status)}`);
  const meta = ((await response.json()) as Record<string, ReliefMeta>)[`${moment}-${framing}`];
  if (!meta) throw new Error(`office relief: nothing for ${moment}-${framing}`);
  const a = meta.anchors;
  const anchors: Anchors = {
    screen: a.screen.map(v3),
    window: a.window.map(v3),
    bulb: v3(a.bulb),
    sun: a.sun && { centre: v3(a.sun.centre), rim: v3(a.sun.rim) },
    pictures: a.pictures.map((picture) => ({ ...picture, corners: picture.corners.map(v3) })),
    glowAzimuth: a.glowAzimuth,
  };

  const name = (layer: string, ext: string): string => `${base}/${moment}-${framing}-${layer}.${ext}`;
  const loader = new TextureLoader();
  const colour = (layer: string): Promise<Texture> =>
    loader.loadAsync(name(layer, avif ? 'avif' : 'webp')).then((texture) => {
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = 4;
      return texture;
    });
  const [cityMap, roomMap, deskMap, roomDepth, deskDepth] = await Promise.all([
    colour('city'),
    colour('room'),
    colour('desk'),
    pixels(name('room-depth', 'webp')),
    pixels(name('desk-depth', 'webp')),
  ]);

  const canvas = document.createElement('canvas');
  canvas.className = 'office-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = NoToneMapping;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.autoClear = false;
  let lost = false;
  let disposed = false;
  let onLost: (() => void) | null = null;
  canvas.addEventListener('webglcontextlost', () => {
    if (disposed) return;
    lost = true;
    onLost?.();
  });
  const pixelRatio = (): number => scenePixelRatio(window.devicePixelRatio || 1, framing === 'mobile');
  renderer.setPixelRatio(pixelRatio());
  renderer.setSize(options.size.width, options.size.height, false);

  // The seated camera the layers were rendered with, margin included: the rays their pixels are lifted along.
  const seated = makeCamera(framing, meta.overscan);
  const spec = FRAMINGS[framing];
  const rest = makeCamera(framing);
  const restPlacement = placement(anchors, rest, frame.w, frame.h);
  const f = frame.h / 2 / Math.tan((rest.fov * DEG) / 2);

  // The town: its layer on a plane far away that fills the seated camera's view, margin included.
  const cityScene = new Scene();
  const far = 1000;
  const cityHeight = 2 * far * Math.tan((seated.fov * DEG) / 2);
  const cityPlane = new Mesh(new PlaneGeometry(cityHeight * seated.aspect, cityHeight), layerMaterial(cityMap));
  cityPlane.position.set(0, 0, -far).applyMatrix4(seated.matrixWorld);
  cityPlane.quaternion.copy(seated.quaternion);
  cityScene.add(cityPlane);

  const roomScene = new Scene();
  const deskScene = new Scene();
  const roomMaterial = layerMaterial(roomMap);
  const deskMaterial = layerMaterial(deskMap);
  roomScene.add(new Mesh(reliefGeometry(roomDepth, seated, cut), roomMaterial));
  deskScene.add(new Mesh(reliefGeometry(deskDepth, seated, cut), deskMaterial));

  // The halos, as the live office draws them: the setting sun's in the town, the lamp's over the desk.
  if (anchors.sun) {
    const sunHalo = halo(
      glowTexture([
        [0, 'rgba(255, 236, 190, 0.9)'],
        [0.14, 'rgba(255, 206, 140, 0.45)'],
        [0.38, 'rgba(255, 170, 100, 0.14)'],
        [0.7, 'rgba(255, 150, 90, 0)'],
        [1, 'rgba(255, 150, 90, 0)'],
      ]),
      0,
    );
    sunHalo.position.copy(anchors.sun.centre);
    sunHalo.scale.setScalar(anchors.sun.rim.distanceTo(anchors.sun.centre) * 14);
    sunHalo.lookAt(rest.position);
    cityScene.add(sunHalo);
  }
  const lampHalo = halo(
    glowTexture([
      [0, 'rgba(255, 214, 150, 0.55)'],
      [0.22, 'rgba(255, 184, 110, 0.22)'],
      [0.48, 'rgba(255, 170, 90, 0.07)'],
      [0.7, 'rgba(255, 170, 90, 0)'],
      [1, 'rgba(255, 170, 90, 0)'],
    ]),
    0,
  );
  const bulbDepth = anchors.bulb.clone().applyMatrix4(rest.matrixWorldInverse).z;
  lampHalo.scale.setScalar((340 * -bulbDepth) / f);
  lampHalo.position.copy(anchors.bulb);
  lampHalo.lookAt(rest.position);
  deskScene.add(lampHalo);

  // The pictures: quads on their faces, multiplied over the white face of the layer, which holds the room's light.
  const faces = new Map<string, { mesh: Mesh; ratio: number }>();
  for (const picture of anchors.pictures) {
    const [tl, tr, br, bl] = picture.corners as [Vector3, Vector3, Vector3, Vector3];
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new BufferAttribute(new Float32Array([tl, tr, br, bl].flatMap((c) => c.toArray())), 3),
    );
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]), 2));
    geometry.setIndex([0, 3, 1, 1, 3, 2]);
    const material = new MeshBasicMaterial({
      color: 0xffffff,
      blending: MultiplyBlending,
      premultipliedAlpha: true,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -8,
      toneMapped: false,
      side: DoubleSide,
    });
    const mesh = new Mesh(geometry, material);
    mesh.renderOrder = 1;
    mesh.visible = false;
    (picture.id === 'desk' ? deskScene : roomScene).add(mesh);
    faces.set(picture.id, { mesh, ratio: picture.ratio });
  }
  const textures: Texture[] = [cityMap, roomMap, deskMap];

  // Everything on the GPU now, and the one program linked, rather than in the first frame of the arrival.
  const warm = new PerspectiveCamera();
  renderer.compile(roomScene, warm);
  renderer.compile(cityScene, warm);
  textures.forEach((texture) => {
    renderer.initTexture(texture);
  });

  const cityCamera = rest.clone();
  const roomCamera = rest.clone();
  const roomFull = rest.clone();
  const axisRay = new Vector3((frame.axis[0] / frame.w) * 2 - 1, 1 - (frame.axis[1] / frame.h) * 2, 0.5)
    .unproject(rest)
    .sub(rest.position)
    .normalize();
  const right = new Vector3(1, 0, 0).applyQuaternion(rest.quaternion);
  const up = new Vector3(0, 1, 0).applyQuaternion(rest.quaternion);

  let fit: Fit = { k: 1, x: 0, y: 0 };
  let width = frame.w;
  let height = frame.h;
  const view = (camera: PerspectiveCamera, scale: number, cx: number, cy: number): void => {
    camera.setViewOffset(
      frame.w * scale,
      frame.h * scale,
      -fit.x / fit.k - cx,
      -fit.y / fit.k - cy,
      width / fit.k,
      height / fit.k,
    );
  };

  return {
    element: canvas,
    rest: restPlacement,
    draw(state, head) {
      // Word for word the live office's cameras (`live.ts`).
      const s = 4.67 / (state.camZ + 4.67);
      const ox = framing === 'mobile' ? frame.axis[0] : restPlacement.glow[0];
      const oy = restPlacement.horizon;
      view(
        cityCamera,
        s,
        ox * (1 - s) - head.x * frame.par.city[0],
        oy * (1 - s) + state.tiltY - head.y * frame.par.city[1],
      );
      const wallDepth = 1.2;
      const turnX = (head.x * frame.par.far[0]) / f;
      const turnY = (head.y * frame.par.far[1]) / f;
      const moveX = (head.x * (frame.par.room[0] - frame.par.far[0]) * wallDepth) / f;
      const moveY = (head.y * (frame.par.room[1] - frame.par.far[1]) * wallDepth) / f;
      roomFull.position
        .copy(rest.position)
        .addScaledVector(axisRay, -state.camZ)
        .addScaledVector(right, moveX)
        .addScaledVector(up, -moveY);
      roomFull.rotation.set(spec.pitch * DEG - turnY, spec.yaw * DEG - turnX, 0);
      roomFull.updateMatrixWorld();
      roomCamera.position.copy(roomFull.position);
      roomCamera.quaternion.copy(roomFull.quaternion);
      roomCamera.updateMatrixWorld();
      view(roomCamera, 1, 0, 0);
      const opacity = { room: layerFade(state.camZ, FADE_PLANES.room), desk: layerFade(state.camZ, FADE_PLANES.desk) };
      renderer.clear();
      renderer.render(cityScene, cityCamera);
      for (const [scene, material, k] of [
        [roomScene, roomMaterial, opacity.room],
        [deskScene, deskMaterial, opacity.desk],
      ] as const) {
        if (k <= 0.002) continue;
        material.opacity = k;
        renderer.clearDepth();
        renderer.render(scene, roomCamera);
      }
      const screenShown = anchors.screen.every(
        (corner) => corner.clone().applyMatrix4(roomFull.matrixWorldInverse).z < -roomFull.near,
      );
      const restSun = restPlacement.sun;
      const sun: Drawn['sun'] = restSun && [
        ox + s * (restSun[0] - ox) - head.x * frame.par.city[0],
        oy + s * (restSun[1] - oy) + state.tiltY - head.y * frame.par.city[1],
        restSun[2] * s,
      ];
      return { placement: placement(anchors, roomFull, frame.w, frame.h), screenShown, opacity, sun };
    },
    resize(nextWidth, nextHeight, nextFit) {
      width = nextWidth;
      height = nextHeight;
      fit = nextFit;
      const ratio = pixelRatio();
      if (ratio !== renderer.getPixelRatio()) renderer.setPixelRatio(ratio);
      const size = renderer.getSize(new Vector2());
      if (size.x !== width || size.y !== height) renderer.setSize(width, height, false);
    },
    setPictures(pictures, loaded) {
      for (const [id, picture] of pictures) {
        const face = faces.get(id);
        if (!face) continue;
        loader.load(picture.src, (texture) => {
          if (disposed) {
            texture.dispose();
            return;
          }
          texture.colorSpace = SRGBColorSpace;
          texture.anisotropy = 4;
          const image = texture.image as { width: number; height: number };
          const imageAspect = image.width / image.height;
          if (imageAspect > face.ratio) {
            texture.repeat.set(face.ratio / imageAspect, 1);
            texture.offset.set((1 - texture.repeat.x) * (picture.focus[0] / 100), 0);
          } else {
            texture.repeat.set(1, imageAspect / face.ratio);
            texture.offset.set(0, (1 - texture.repeat.y) * (1 - picture.focus[1] / 100));
          }
          const material = face.mesh.material as MeshBasicMaterial;
          material.map?.dispose();
          material.map = texture;
          material.color = new Color(0xffffff);
          material.needsUpdate = true;
          face.mesh.visible = true;
          renderer.initTexture(texture);
          textures.push(texture);
          loaded();
        });
      }
    },
    isLost: () => lost,
    whenLost(callback) {
      onLost = callback;
    },
    dispose() {
      disposed = true;
      onLost = null;
      for (const scene of [cityScene, roomScene, deskScene]) {
        scene.traverse((node) => {
          if (!(node instanceof Mesh)) return;
          (node.geometry as BufferGeometry).dispose();
          (node.material as MeshBasicMaterial).dispose();
        });
      }
      textures.forEach((texture) => {
        texture.dispose();
      });
      renderer.dispose();
      if (!lost) renderer.forceContextLoss();
      canvas.remove();
    },
  };
}

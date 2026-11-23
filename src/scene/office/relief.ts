/**
 * The office in relief (office spec §3 to §5): its camera moves over its own layers, rendered at build time from its
 * scene (`pnpm render-office-layers`). The town is its layer, shifted and zoomed as a seated camera sees it; the room
 * and the desk are their layers lifted by their depth, a grid of vertices set back
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
  LessEqualDepth,
  NotEqualStencilFunc,
  ReplaceStencilOp,
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
import { breathe, DEG, endStep, startStep } from './common';
import { placement, type Anchors } from './corners';
import type { Fit, FrameSpec } from './frame';
import { FRAMINGS, makeCamera, type Framing } from './framings';
import { glowTexture, halo, type Drawn, type OfficeScene } from './scene';
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
  /** The near layers' margin around the frame. */
  nearOverscan: number;
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
/**
 * The near layers of the room, by how far in front of the seat they were seen from, and from where to where, in the
 * arrival's `camZ`, each one fades out as the camera backs past it: the farther one is drawn over the nearer one.
 */
const NEARS = [
  { cm: 45, until: [-0.11, -0.02] },
  { cm: 80, until: [-0.4, -0.3] },
  { cm: 105, until: [-0.72, -0.58] },
] as const;
const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** A picture's pixels as they are in the file: no colour conversion, alpha not premultiplied. */
async function pixels(src: string): Promise<ImageData> {
  const blob = await (await fetch(src)).blob();
  const bitmap = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  // Safari before 16.4 has no OffscreenCanvas.
  const canvas =
    typeof OffscreenCanvas === 'undefined'
      ? Object.assign(document.createElement('canvas'), { width: bitmap.width, height: bitmap.height })
      : new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | null;
  if (!ctx) throw new Error('office relief: no 2D context');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * The layer's mesh: one vertex per pixel of its depth, set back along the seated camera's ray through that pixel.
 * Where nothing was drawn, the depth of the nearest drawn pixel is taken, so that the soft edges of the picture keep
 * their pixels (thin stems drawn in the picture but missed by the coarser depth); quads farther than that from anything
 * drawn are left out. With `minY`, only what stands higher than that, in the scene's metres, is kept.
 */
function reliefGeometry(depth: ImageData, camera: PerspectiveCamera, minY = -Infinity): BufferGeometry {
  const { width: w, height: h, data } = depth;
  const tanY = Math.tan((camera.fov * DEG) / 2);
  const tanX = tanY * camera.aspect;
  const p = new Vector3();
  const z = new Float32Array(w * h);
  const drawn = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i += 1) {
    if ((data[i * 4 + 3] ?? 0) === 0) continue;
    const d = (((data[i * 4] ?? 0) * 256 + (data[i * 4 + 1] ?? 0)) / 65535) * DEPTH_RANGE;
    // A few pixels of the thin light strip under the ceiling come out at the camera itself: their neighbours stand in.
    if (d < NEAREST) continue;
    if (minY > -Infinity) {
      const x = i % w;
      const y = (i - x) / w;
      p.set((((x + 0.5) / w) * 2 - 1) * tanX * d, (1 - ((y + 0.5) / h) * 2) * tanY * d, -d).applyMatrix4(
        camera.matrixWorld,
      );
      if (p.y < minY) continue;
    }
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
  // Only the rows and columns that hold something: a near layer fills a strip of its picture.
  let x0 = w;
  let x1 = -1;
  let y0 = h;
  let y1 = -1;
  for (let i = 0; i < w * h; i += 1) {
    if (!known[i]) continue;
    const x = i % w;
    const y = (i - x) / w;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  const bw = Math.max(0, x1 - x0 + 1);
  const bh = Math.max(0, y1 - y0 + 1);
  const positions = new Float32Array(bw * bh * 3);
  const uvs = new Float32Array(bw * bh * 2);
  for (let y = 0; y < bh; y += 1) {
    for (let x = 0; x < bw; x += 1) {
      const i = (y + y0) * w + x + x0;
      const u = (x + x0 + 0.5) / w;
      const v = (y + y0 + 0.5) / h;
      const d = known[i] ? (z[i] ?? 1) : 1;
      p.set((u * 2 - 1) * tanX * d, (1 - v * 2) * tanY * d, -d).applyMatrix4(camera.matrixWorld);
      positions.set([p.x, p.y, p.z], (y * bw + x) * 3);
      uvs.set([u, 1 - v], (y * bw + x) * 2);
    }
  }
  const index: number[] = [];
  for (let y = 0; y < bh - 1; y += 1) {
    for (let x = 0; x < bw - 1; x += 1) {
      const i = (y + y0) * w + x + x0;
      if (![i, i + 1, i + w, i + w + 1].every((j) => known[j])) continue;
      const a = y * bw + x;
      index.push(a, a + bw, a + 1, a + 1, a + bw, a + bw + 1);
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
  // The room's near layers, on a phone only: on a computer, the seat sees the lintel wide enough.
  const nearSet = framing === 'mobile' ? NEARS : [];
  startStep();
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
  const [cityMap, roomMap, deskMap, roomDepth, deskDepth, ...nearLayers] = await Promise.all([
    colour('city'),
    colour('room'),
    colour('desk'),
    pixels(name('room-depth', 'webp')),
    pixels(name('desk-depth', 'webp')),
    ...nearSet.flatMap((near) => [
      colour(`room-near${String(near.cm)}`),
      pixels(name(`room-near${String(near.cm)}-depth`, 'webp')),
    ]),
  ]);

  const canvas = document.createElement('canvas');
  canvas.className = 'office-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    stencil: true,
    powerPreference: 'high-performance',
  });
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

  const axisRay = new Vector3((frame.axis[0] / frame.w) * 2 - 1, 1 - (frame.axis[1] / frame.h) * 2, 0.5)
    .unproject(rest)
    .sub(rest.position)
    .normalize();

  const roomScene = new Scene();
  const deskScene = new Scene();
  const roomMaterial = layerMaterial(roomMap);
  const deskMaterial = layerMaterial(deskMap);
  // Each mesh in a step of its own (`office:relief …`), between two frames: a phone takes tens of ms for each.
  await breathe('relief load');
  // Where a near layer covers the view, the seated room under it is left out (the stencil), or its saw would show
  // through as the room fades in.
  roomMaterial.stencilWrite = true;
  roomMaterial.stencilFunc = NotEqualStencilFunc;
  roomMaterial.stencilRef = 1;
  const seatedRoom = new Mesh(reliefGeometry(roomDepth, seated), roomMaterial);
  roomScene.add(seatedRoom);
  await breathe('relief room');
  deskScene.add(new Mesh(reliefGeometry(deskDepth, seated), deskMaterial));
  // The room as seen on the way in: a face the seat sees edge on (the lintel from below) has few pixels in the seated
  // layer, and drawn large as the camera passes it, their steps showed as a saw. Each near layer is drawn over the
  // seated one while the camera is around where it was seen from.
  // Only the lintel and what is above it: lower, the seat sees the room well enough, and a phone would draw the near
  // layers' whole rooms for nothing.
  const lintel = Math.max(...a.window.map((corner) => corner[1])) - 0.03;
  const nears: {
    until: readonly [number, number];
    texture: Texture;
    material: MeshBasicMaterial;
    mask: MeshBasicMaterial;
    scene: Scene;
    weight: number;
  }[] = [];
  for (const [i, near] of nearSet.entries()) {
    await breathe(`relief ${i === 0 ? 'desk' : `near ${String(nearSet[i - 1]?.cm)}`}`);
    const camera = makeCamera(framing, meta.nearOverscan);
    camera.position.addScaledVector(axisRay, near.cm / 100);
    camera.updateMatrixWorld();
    // In a scene of its own, drawn over the seated room, and its depth first: while it fades, only its nearest faces
    // show, not those behind them (the lintel's underside through its front).
    const geometry = reliefGeometry(nearLayers[2 * i + 1] as ImageData, camera, lintel);
    const texture = nearLayers[2 * i] as Texture;
    const material = layerMaterial(texture);
    material.depthFunc = LessEqualDepth;
    const scene = new Scene();
    // Its depth first, marking where it covers the view in the stencil while it is whole.
    const mask = new MeshBasicMaterial({ colorWrite: false, side: DoubleSide, stencilZPass: ReplaceStencilOp });
    mask.stencilRef = 1;
    scene.add(new Mesh(geometry, mask), new Mesh(geometry, material));
    nears.push({ until: near.until, texture, material, mask, scene, weight: 0 });
  }

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
  const textures: Texture[] = [cityMap, roomMap, deskMap, ...nears.map((near) => near.texture)];

  // Everything on the GPU now, and the one program linked, rather than in the first frame of the arrival.
  await breathe(nears.length > 0 ? `relief near ${String(nearSet.at(-1)?.cm)}` : 'relief desk');
  const warm = new PerspectiveCamera();
  renderer.compile(roomScene, warm);
  renderer.compile(cityScene, warm);
  textures.forEach((texture) => {
    renderer.initTexture(texture);
  });
  endStep('compile');

  const cityCamera = rest.clone();
  const roomCamera = rest.clone();
  const roomFull = rest.clone();
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
        if (scene !== roomScene) {
          renderer.clearDepth();
          renderer.render(scene, roomCamera);
          continue;
        }
        // The near layers whole first, the farthest on top, marking the stencil; the seated room where they are not;
        // then those fading out, over it.
        for (const near of nears) {
          near.weight = 1 - smooth(near.until[0], near.until[1], state.camZ);
          near.material.opacity = k * near.weight;
          near.mask.stencilWrite = near.weight >= 0.999;
        }
        renderer.clearStencil();
        for (const whole of [true, false]) {
          for (const near of nears) {
            if (near.weight <= 0.002 || near.mask.stencilWrite !== whole) continue;
            renderer.clearDepth();
            renderer.render(near.scene, roomCamera);
          }
          if (!whole) break;
          renderer.clearDepth();
          renderer.render(roomScene, roomCamera);
        }
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
      for (const scene of [cityScene, roomScene, deskScene, ...nears.map((near) => near.scene)]) {
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

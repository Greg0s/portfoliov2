/**
 * The live office (office spec §3 to §5, plan step 7): the scene drawn every frame in its own canvas, between the
 * HTML sky behind it and the screen in front of it. The town's camera stays seated and only shifts and zooms its
 * picture, as the mockup's town layer did; the room's and the desk's camera really moves: it backs through the window
 * to the seat during the arrival, and follows the head. The pictures on the wall and on the desk are textures on
 * their white faces, so that the lamp and the room's light fall on them and the objects in front hide them.
 */
import {
  ACESFilmicToneMapping,
  CanvasTexture,
  Color,
  AddEquation,
  CustomBlending,
  DstAlphaFactor,
  DstColorFactor,
  Group,
  Mesh,
  MeshStandardMaterial,
  OneFactor,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  ReverseSubtractEquation,
  MeshBasicMaterial,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  Vector3,
  WebGLRenderer,
  ZeroFactor,
  type Object3D,
  type Texture,
} from 'three';
import { FADE_PLANES, layerFade, type ArrivalState } from './arrival';
import { breathe, DEG, endStep, isMesh, LAYERS, startStep } from './common';
import { anchorsOf, placement, type Anchors, type Placement } from './corners';
import type { Fit, FrameSpec } from './frame';
import { FRAMINGS, makeCamera, type Framing } from './framings';
import { createOffice, type Office } from './office';
import type { TownGeometry } from './town';
import type { Moment } from '../time';
import { cappedPixelRatio } from '../renderer';

export interface PictureSource {
  src: string;
  /** The point kept when cropping, in % of the image (CSS object-position). */
  focus: [number, number];
}

export interface Head {
  /** Where the head leans, from −1 to 1 on each axis (toward the mouse). */
  x: number;
  y: number;
}

export interface Drawn {
  placement: Placement;
  screenShown: boolean;
  opacity: { room: number; desk: number };
  /** The setting sun's centre and radius in the town as drawn, for the halo's twin over the sky (dusk only). */
  sun: [number, number, number] | null;
}

/** The office's scene behind its HTML: the live one (a canvas over the section) or its layers (in the frame). */
export interface OfficeScene {
  element: HTMLElement;
  /** Where things land in the frame at rest (for the HTML laid over the scene). */
  rest: Placement;
  /** Draws a frame; returns where the screen and the pictures land now, in frame px, and how visible they are. */
  draw(state: ArrivalState, head: Head): Drawn;
  resize(width: number, height: number, fit: Fit): void;
  /** Puts the pictures on their frames; `loaded` is called as each one is ready to show. */
  setPictures(pictures: ReadonlyMap<string, PictureSource>, loaded: () => void): void;
  dispose(): void;
}

/**
 * A soft round glow for the halos laid over the scene in screen blending, drawn over black: its colours are already
 * weighed by their alpha in sRGB, as the browser does when it blends a CSS gradient. Weighing them in the shader would
 * do it in linear light and brighten the faint edge of the glow a lot.
 */
function glowTexture(stops: readonly [number, string][]): CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, size, size);
    // As CSS's `radial-gradient(circle, …)`, whose stops are along the way to the farthest corner.
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * Math.SQRT1_2);
    stops.forEach(([at, color]) => {
      gradient.addColorStop(at, color);
    });
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/**
 * A halo facing the camera, blended as the CSS `screen` mode over what is drawn: the setting sun's over the hills, the
 * lamp's over the wall. Where the canvas is transparent, the sky behind is HTML and has its own twin of the halo: there
 * the halo must add nothing, or the page would add it to the sky instead of screening it. So it adds `halo × (alpha −
 * colour)` of what is drawn, in two draws: one takes off `halo × colour`, the next adds `halo × alpha`.
 */
function halo(texture: Texture, layer: number): Group {
  const geometry = new PlaneGeometry(1, 1);
  const group = new Group();
  for (const [order, equation, factor] of [
    [10, ReverseSubtractEquation, DstColorFactor],
    [11, AddEquation, DstAlphaFactor],
  ] as const) {
    const material = new MeshBasicMaterial({
      map: texture,
      transparent: true,
      premultipliedAlpha: false,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      fog: false,
      blending: CustomBlending,
      blendEquation: equation,
      blendSrc: factor,
      blendDst: OneFactor,
      blendEquationAlpha: AddEquation,
      blendSrcAlpha: ZeroFactor,
      blendDstAlpha: OneFactor,
    });
    const mesh = new Mesh(geometry, material);
    mesh.layers.set(layer);
    mesh.renderOrder = order;
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  return group;
}

/** What three's programs answer and its types leave out. */
interface Program {
  program: globalThis.WebGLProgram;
  isReady(): boolean;
}

/**
 * When the page was last moved (scrolling, wheel, touch or key), kept from `watchMoves()` until the returned stop is
 * called: a page already quiet lets the next step through at once.
 */
function watchMoves(): { quietFor(): number; stop(): void } {
  let last = -Infinity;
  const moved = (): void => {
    last = performance.now();
  };
  const events = ['scroll', 'wheel', 'touchmove', 'keydown'] as const;
  events.forEach((name) => {
    window.addEventListener(name, moved, { capture: true, passive: true });
  });
  return {
    quietFor: () => performance.now() - last,
    stop: () => {
      events.forEach((name) => {
        window.removeEventListener(name, moved, { capture: true });
      });
    },
  };
}

/** Resolves once the page has been quiet for a quarter of a second, or `patience` ms gone by. */
function atRest(moves: ReturnType<typeof watchMoves>, patience: number): Promise<void> {
  const start = performance.now();
  return new Promise<void>((resolve) => {
    const check = (): void => {
      if (moves.quietFor() >= 250 || performance.now() - start >= patience) resolve();
      else setTimeout(check, 50);
    };
    check();
  });
}

/**
 * Compiles the office's programs without holding the page. Where the driver links them in parallel
 * (`KHR_parallel_shader_compile`), all are started in this task and finished out of its way. Elsewhere (phones,
 * among them), the first draw would wait for every link at once, seconds long: each program is linked in a task of
 * its own instead, while the page is at rest.
 */
async function compileOffice(renderer: WebGLRenderer, office: Office, camera: PerspectiveCamera): Promise<void> {
  const programs = (): Program[] => (renderer.info.programs ?? []) as unknown as Program[];
  if (renderer.extensions.has('KHR_parallel_shader_compile')) {
    await office.compile(renderer, camera, () => Promise.resolve());
    endStep('shaders (start)');
    while (!programs().every((program) => program.isReady())) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    startStep();
    return;
  }
  const gl = renderer.getContext();
  let linked = 0;
  // Waiting for rest, two seconds in all at most: the office has to be ready before the journey reaches it.
  let patience = 2000;
  const moves = watchMoves();
  try {
    await office.compile(renderer, camera, async () => {
      // Asking whether it is linked makes this task wait for it, and for it alone.
      const all = programs();
      for (; linked < all.length; linked += 1) {
        const program = all[linked];
        if (program) gl.getProgramParameter(program.program, gl.LINK_STATUS);
      }
      endStep(`shader ${String(linked)}`);
      await breathe();
      if (patience > 0) {
        const waited = performance.now();
        await atRest(moves, patience);
        patience -= performance.now() - waited;
      }
      startStep();
    });
  } finally {
    moves.stop();
  }
}

export interface LiveOptions {
  moment: Moment;
  framing: Framing;
  frame: FrameSpec;
  town: TownGeometry;
  rose: Object3D | null;
  /** The section's size, in CSS px: the canvas is made at it from the start. */
  size: { width: number; height: number };
}

export async function createLiveOffice(options: LiveOptions): Promise<OfficeScene> {
  const { framing, frame } = options;
  // Each part in a task of its own, between two frames: the context, then the scene (createOffice pauses too).
  await breathe('town and model');
  const canvas = document.createElement('canvas');
  canvas.className = 'office-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  // Reading back each program's log once it is linked makes the driver wait for it: only while developing.
  renderer.debug.checkShaderErrors = import.meta.env.DEV;
  // The drawing buffer, made at its size in a step of its own: resizing it later, with the view, held the page
  // (a quarter of a second on a laptop, without a graphics card).
  const pixelRatio = (): number => cappedPixelRatio(window.devicePixelRatio || 1, framing === 'mobile');
  renderer.setPixelRatio(pixelRatio());
  renderer.setSize(options.size.width, options.size.height, false);
  await breathe('canvas');

  const office: Office = await createOffice(renderer, options.moment, options.town, options.rose, breathe);
  const spec = FRAMINGS[framing];
  const rest = makeCamera(framing);
  const anchors: Anchors = anchorsOf(office);
  const restPlacement = placement(anchors, rest, frame.w, frame.h);
  const f = frame.h / 2 / Math.tan((rest.fov * DEG) / 2);

  // The town's camera is the seated one; the room's moves. A twin without the view offset projects the corners.
  const cityCamera = rest.clone();
  const roomCamera = rest.clone();
  const roomFull = rest.clone();
  // The arrival's path: the ray from the seat through the axis of the frame.
  const axisRay = new Vector3((frame.axis[0] / frame.w) * 2 - 1, 1 - (frame.axis[1] / frame.h) * 2, 0.5)
    .unproject(rest)
    .sub(rest.position)
    .normalize();
  const right = new Vector3(1, 0, 0).applyQuaternion(rest.quaternion);
  const up = new Vector3(0, 1, 0).applyQuaternion(rest.quaternion);

  // The halos: the setting sun's (dusk), and the lamp's.
  const sunHalo = halo(
    glowTexture([
      [0, 'rgba(255, 236, 190, 0.9)'],
      [0.14, 'rgba(255, 206, 140, 0.45)'],
      [0.38, 'rgba(255, 170, 100, 0.14)'],
      [0.7, 'rgba(255, 150, 90, 0)'],
      [1, 'rgba(255, 150, 90, 0)'],
    ]),
    LAYERS.city,
  );
  if (anchors.sun) {
    const radius = anchors.sun.rim.distanceTo(anchors.sun.centre);
    sunHalo.position.copy(anchors.sun.centre);
    sunHalo.scale.setScalar(radius * 14);
    sunHalo.lookAt(rest.position);
    office.scene.add(sunHalo);
  }
  const lampHalo = halo(
    glowTexture([
      [0, 'rgba(255, 214, 150, 0.55)'],
      [0.22, 'rgba(255, 184, 110, 0.22)'],
      [0.48, 'rgba(255, 170, 90, 0.07)'],
      [0.7, 'rgba(255, 170, 90, 0)'],
      [1, 'rgba(255, 170, 90, 0)'],
    ]),
    LAYERS.desk,
  );
  // 340 px across in the frame at rest, at the bulb's distance.
  const bulbDepth = anchors.bulb.clone().applyMatrix4(rest.matrixWorldInverse).z;
  lampHalo.scale.setScalar((340 * -bulbDepth) / f);
  lampHalo.position.copy(anchors.bulb);
  lampHalo.lookAt(rest.position);
  office.scene.add(lampHalo);

  // The pictures' faces, each with its own material.
  const faces = new Map<string, Mesh>();
  office.scene.traverse((node) => {
    if (!isMesh(node) || !node.name.startsWith('picture-')) return;
    node.material = (node.material as MeshStandardMaterial).clone();
    faces.set(node.name.slice(8), node);
  });
  const loader = new TextureLoader();
  const textures: Texture[] = [];

  endStep('halos and pictures');
  startStep();
  await compileOffice(renderer, office, rest);
  // Then each layer drawn once, out of sight, in a step of its own: together, in the first draw, they held the page.
  const warmCamera = rest.clone();
  let warmed = 'shaders (end)';
  for (const layer of ['city', 'room', 'desk'] as const) {
    await breathe(warmed);
    office.warm(renderer, warmCamera, layer);
    warmed = `first ${layer} draw`;
  }
  endStep(warmed);

  let fit: Fit = { k: 1, x: 0, y: 0 };
  let width = frame.w;
  let height = frame.h;
  const view = (camera: PerspectiveCamera, scale: number, cx: number, cy: number): void => {
    // The frame's visible part, in frame px; the picture is scaled by `scale` and moved by (cx, cy) in it.
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
      // The town: seated, shifted by the tilt and the head, zoomed from 1.6× about the sun (or the axis on phones).
      const s = 4.67 / (state.camZ + 4.67);
      const ox = framing === 'mobile' ? frame.axis[0] : restPlacement.glow[0];
      const oy = restPlacement.horizon;
      view(
        cityCamera,
        s,
        ox * (1 - s) - head.x * frame.par.city[0],
        oy * (1 - s) + state.tiltY - head.y * frame.par.city[1],
      );
      // The room and the desk: the camera backs along the axis to the seat, and follows the head: it turns as much
      // as the far sky slides, and moves as much as the room's wall slides more.
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
      office.render(renderer, { city: cityCamera, room: roomCamera }, opacity);
      // The screen is laid over the scene only when it is wholly in front of the camera.
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
      // Setting the canvas's size, even to the same one, makes its drawing buffer again: only when it changes.
      const ratio = pixelRatio();
      if (ratio !== renderer.getPixelRatio()) renderer.setPixelRatio(ratio);
      const size = renderer.getSize(new Vector2());
      if (size.x !== width || size.y !== height) renderer.setSize(width, height, false);
    },
    setPictures(pictures, loaded) {
      for (const [id, picture] of pictures) {
        const face = faces.get(id);
        if (!face) continue;
        const { w, h } = face.userData as { w: number; h: number };
        loader.load(picture.src, (texture) => {
          texture.colorSpace = SRGBColorSpace;
          texture.anisotropy = 4;
          // Cropped to the frame's shape around its focus, as `object-fit: cover`.
          const image = texture.image as { width: number; height: number };
          const imageAspect = image.width / image.height;
          const frameAspect = w / h;
          if (imageAspect > frameAspect) {
            texture.repeat.set(frameAspect / imageAspect, 1);
            texture.offset.set((1 - texture.repeat.x) * (picture.focus[0] / 100), 0);
          } else {
            texture.repeat.set(1, imageAspect / frameAspect);
            texture.offset.set(0, (1 - texture.repeat.y) * (1 - picture.focus[1] / 100));
          }
          const material = face.material as MeshStandardMaterial;
          material.map?.dispose();
          material.map = texture;
          material.color = new Color(0xffffff);
          material.needsUpdate = true;
          // Sent to the GPU now, rather than in the first frame of the arrival that shows it.
          renderer.initTexture(texture);
          textures.push(texture);
          loaded();
        });
      }
    },
    dispose() {
      office.dispose();
      textures.forEach((texture) => {
        texture.dispose();
      });
      renderer.dispose();
      canvas.remove();
    },
  };
}

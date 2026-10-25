/**
 * The office scene, assembled (office spec §3 and §4): the town, the room and the desk, each drawn in its own pass as
 * the layers were, over a cleared depth buffer: the town under the exterior lights with the sky as its environment,
 * then the room, then the desk, each under its own copy of the interior lights with the room as theirs. A pass only
 * sees its own layer, so its shadows come from its own objects only, as in the layers; since nothing that casts a
 * shadow ever moves, the shadow maps are drawn once. The sky behind is HTML: the canvas stays transparent where
 * nothing is drawn.
 */
import {
  Fog,
  HalfFloatType,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  type Camera,
  type Object3D,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { buildCity, type City } from './city';
import { isMesh, LAYERS, noPause, type Pause } from './common';
import { buildLights, type OfficeLights } from './lighting';
import { MOMENTS, type OfficeMoment } from './moments';
import { buildDesk, type Desk } from './objects';
import { buildRoom } from './room';
import { roomEnvironmentScene, skyTexture } from './sky';
import type { TownGeometry } from './town';
import type { Moment } from '../time';

export type Layer = keyof typeof LAYERS;

export interface OfficeCameras {
  /** The town's camera, and the one of the room and the desk (they part during the arrival only). */
  city: Camera;
  room: Camera;
}

export interface Office {
  scene: Scene;
  room: Object3D;
  desk: Desk;
  city: City;
  lights: { exterior: OfficeLights['exterior']; room: OfficeLights; desk: OfficeLights };
  moment: OfficeMoment;
  /** Draws the three passes; the room and the desk can be faded (during the arrival). */
  render(renderer: WebGLRenderer, cameras: OfficeCameras, opacity?: { room: number; desk: number }): void;
  /** Compiles every pass's shaders without blocking the page. */
  compile(renderer: WebGLRenderer, camera: Camera): Promise<void>;
  /** Draws one layer alone, on a cleared canvas, as the fallback layers are. */
  renderLayer(renderer: WebGLRenderer, camera: Camera, layer: Layer): void;
  /**
   * Draws one layer out of sight, as `render` would: its buffers, textures and shadow maps go to the GPU, and its
   * programs are put to use, so that the first draw on screen has nothing left to do.
   */
  warm(renderer: WebGLRenderer, camera: Camera, layer: Layer): void;
  dispose(): void;
}

let rectAreaReady = false;

/** A pass drawn off screen, then laid over the canvas with an opacity: the room and the desk fading in. */
function fader() {
  let target: WebGLRenderTarget | null = null;
  const material = new MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false });
  material.premultipliedAlpha = true;
  const quad = new Mesh(new PlaneGeometry(2, 2), material);
  const scene = new Scene();
  scene.add(quad);
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const size = new Vector2();
  const targetFor = (renderer: WebGLRenderer): WebGLRenderTarget => {
    renderer.getDrawingBufferSize(size);
    if (target?.width !== size.x || target.height !== size.y) {
      target?.dispose();
      // Linear and before tone mapping: the canvas's tone mapping applies when the pass is laid over it.
      target = new WebGLRenderTarget(size.x, size.y, { samples: 4, type: HalfFloatType });
    }
    return target;
  };
  return {
    /**
     * Compiles, without holding the page, what the passes drawn off screen need: drawn into the target, every
     * material takes other shaders (no tone mapping, a linear output), which would otherwise compile in the middle
     * of the arrival, at the first frame where the room fades in.
     */
    async compile(renderer: WebGLRenderer, compilePass: () => Promise<void>): Promise<void> {
      const previous = renderer.getRenderTarget();
      renderer.setRenderTarget(targetFor(renderer));
      const passes = compilePass();
      renderer.setRenderTarget(previous);
      material.map = targetFor(renderer).texture;
      await Promise.all([passes, renderer.compileAsync(scene, camera)]);
    },
    draw(renderer: WebGLRenderer, opacity: number, pass: () => void): void {
      const previous = renderer.getRenderTarget();
      renderer.setRenderTarget(targetFor(renderer));
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      pass();
      renderer.setRenderTarget(previous);
      material.map = targetFor(renderer).texture;
      material.opacity = opacity;
      renderer.render(scene, camera);
    },
    dispose(): void {
      target?.dispose();
      material.dispose();
      quad.geometry.dispose();
    },
  };
}

/** Builds the office; `pause` lets frames through between its parts, so that preparing it never holds the page. */
export async function createOffice(
  renderer: WebGLRenderer,
  momentName: Moment,
  town: TownGeometry,
  rose: Object3D | null,
  pause: Pause = noPause,
): Promise<Office> {
  if (!rectAreaReady) {
    RectAreaLightUniformsLib.init();
    rectAreaReady = true;
  }
  const moment = MOMENTS[momentName];
  const scene = new Scene();
  await pause('scene');
  const room = buildRoom();
  await pause('room');
  const desk = await buildDesk(rose, pause);
  const city = buildCity(town, moment);
  await pause('city');
  scene.add(room, desk.group, city.group);
  const roomLights = buildLights(moment, desk);
  const deskLights = buildLights(moment, desk);
  scene.add(roomLights.exterior, roomLights.interior, deskLights.interior);
  scene.fog = new Fog(moment.city.fog, 150, 2700);

  const pmrem = new PMREMGenerator(renderer);
  const sky = skyTexture(moment);
  const skyEnv = pmrem.fromEquirectangular(sky).texture;
  await pause('sky environment');
  const roomScene = roomEnvironmentScene(moment);
  const roomEnv: Texture = pmrem.fromScene(roomScene, 0.04, 0.05, 20, { position: new Vector3(0, 1.2, -0.4) }).texture;
  pmrem.dispose();
  sky.dispose();
  await pause('room environment');
  roomScene.traverse((node) => {
    if (isMesh(node)) node.geometry.dispose();
  });

  const shadowsDrawn = new Set<Layer>();
  const prepare = (camera: Camera, layer: Layer): void => {
    camera.layers.set(LAYERS[layer]);
    roomLights.exterior.visible = layer === 'city';
    roomLights.interior.visible = layer === 'room';
    deskLights.interior.visible = layer === 'desk';
    scene.environment = layer === 'city' ? skyEnv : roomEnv;
    scene.environmentIntensity = layer === 'city' ? 1 : 0.7;
  };
  const pass = (target: WebGLRenderer, camera: Camera, layer: Layer): void => {
    prepare(camera, layer);
    if (layer !== 'city' && !shadowsDrawn.has(layer)) {
      target.shadowMap.needsUpdate = true;
      shadowsDrawn.add(layer);
    }
    target.render(scene, camera);
  };
  const fade = fader();

  return {
    scene,
    room,
    desk,
    city,
    lights: { exterior: roomLights.exterior, room: roomLights, desk: deskLights },
    moment,
    render(target, cameras, opacity = { room: 1, desk: 1 }) {
      const autoClear = target.autoClear;
      target.toneMappingExposure = moment.room.exposure;
      target.shadowMap.autoUpdate = false;
      target.autoClear = false;
      target.setClearColor(0x000000, 0);
      target.clear();
      pass(target, cameras.city, 'city');
      for (const layer of ['room', 'desk'] as const) {
        const k = opacity[layer];
        if (k <= 0.002) continue;
        target.clearDepth();
        if (k >= 0.998) pass(target, cameras.room, layer);
        else {
          fade.draw(target, k, () => {
            pass(target, cameras.room, layer);
          });
        }
      }
      target.autoClear = autoClear;
    },
    async compile(target, camera) {
      for (const layer of ['city', 'room', 'desk'] as const) {
        prepare(camera, layer);
        await target.compileAsync(scene, camera);
      }
      // The room and the desk again, for the off-screen passes that fade them in. Each compile starts at once, with
      // its layer's lights, then the next.
      await fade.compile(target, async () => {
        const started: Promise<unknown>[] = [];
        for (const layer of ['room', 'desk'] as const) {
          prepare(camera, layer);
          started.push(target.compileAsync(scene, camera));
        }
        await Promise.all(started);
      });
    },
    renderLayer(target, camera, layer) {
      target.toneMappingExposure = moment.room.exposure;
      target.shadowMap.autoUpdate = true;
      pass(target, camera, layer);
    },
    warm(target, camera, layer) {
      target.toneMappingExposure = moment.room.exposure;
      target.shadowMap.autoUpdate = false;
      pass(target, camera, layer);
    },
    dispose() {
      const textures = new Set<Texture>();
      scene.traverse((node) => {
        if (!isMesh(node)) return;
        node.geometry.dispose();
        (Array.isArray(node.material) ? node.material : [node.material]).forEach((material) => {
          Object.values(material).forEach((value: unknown) => {
            if (value && typeof value === 'object' && 'isTexture' in value) textures.add(value as Texture);
          });
          material.dispose();
        });
      });
      textures.forEach((texture) => {
        texture.dispose();
      });
      [roomLights, deskLights].forEach((set) => {
        set.interior.traverse((node) => {
          const shadow = (node as { shadow?: { map?: { dispose(): void } | null } }).shadow;
          shadow?.map?.dispose();
        });
      });
      city.facades.dispose();
      skyEnv.dispose();
      roomEnv.dispose();
      fade.dispose();
    },
  };
}

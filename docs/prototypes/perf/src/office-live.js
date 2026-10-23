// The office rendered in real time by the scene of `../bureau/scene.js`: the arrival through the window, then the seat
// with the head moving. The screen and the pictures are HTML, set in perspective over the scene at every frame
// (main spec §6.5).
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { createOffice, makeCamera, skyTexture, roomEnvironmentScene, screenCorners, pictureCorners, toPixels, LAYERS, ROOM } from '../../bureau/scene.js';
import { quadMatrix } from './quad.js';
import { sceneGpuBytes, framebufferMB, round } from './meter.js';

const ARRIVAL = 4;
const SEATED = 10;
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export async function setup({ stage, mobile, moment, params, timings }) {
  const framing = mobile ? 'mobile' : 'desktop';
  const shadowsLive = params.get('shadows') === 'live';
  const vw = stage.clientWidth;
  const vh = stage.clientHeight;

  RectAreaLightUniformsLib.init();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
  renderer.setSize(vw, vh);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = shadowsLive;
  renderer.autoClear = false;
  renderer.info.autoReset = false;

  let t0 = performance.now();
  const office = createOffice(moment);
  timings.buildSceneMs = round(performance.now() - t0);
  const { scene } = office;
  renderer.toneMappingExposure = office.moment.room.exposure;

  t0 = performance.now();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const skyEnv = pmrem.fromEquirectangular(skyTexture(moment)).texture;
  const roomEnv = pmrem.fromScene(roomEnvironmentScene(moment), 0.04, 0.05, 20, { position: new THREE.Vector3(0, 1.2, -0.4) }).texture;
  pmrem.dispose();
  timings.environmentMs = round(performance.now() - t0);

  const seat = makeCamera(framing);
  const camera = seat.clone();
  camera.aspect = vw / vh;
  camera.updateProjectionMatrix();

  // The sky behind the transparent canvas, from the top of the frame to the horizon.
  const sky = document.createElement('div');
  sky.className = 'sky';
  const stops = office.moment.sky.map((c, i, a) => `${c} ${(i / (a.length - 1)) * 100}%`).join(',');
  sky.style.background = `linear-gradient(${stops})`;
  stage.append(sky, renderer.domElement);

  // The HTML screen and pictures.
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  stage.append(overlay);
  const screen = document.createElement('div');
  screen.className = 'quad screen';
  screen.innerHTML = '<img src="media/clip-a.webp" alt=""><div class="taskbar"></div>';
  overlay.append(screen);
  const pictures = pictureCorners(scene).map((p, i) => {
    const el = document.createElement('div');
    el.className = 'quad picture';
    el.innerHTML = `<img src="media/clip-${'abc'[i % 3]}.webp" alt="">`;
    overlay.append(el);
    return { ...p, el, w: 400, h: Math.round(400 / p.ratio) };
  });
  screen.style.width = '640px';
  screen.style.height = '400px';
  for (const p of pictures) {
    p.el.style.width = p.w + 'px';
    p.el.style.height = p.h + 'px';
  }
  const screenWorld = screenCorners(office.desk.monitor);

  function placeOverlays() {
    camera.updateMatrixWorld();
    const behind = (pts) => pts.some((v) => v.clone().applyMatrix4(camera.matrixWorldInverse).z > -0.05);
    if (behind(screenWorld)) screen.style.visibility = 'hidden';
    else {
      screen.style.visibility = '';
      screen.style.transform = quadMatrix(640, 400, toPixels(screenWorld, camera, vw, vh));
    }
    for (const p of pictures) {
      if (behind(p.corners)) p.el.style.visibility = 'hidden';
      else {
        p.el.style.visibility = '';
        p.el.style.transform = quadMatrix(p.w, p.h, toPixels(p.corners, camera, vw, vh));
      }
    }
  }

  function horizonY() {
    const far = new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z - 1e5).project(camera);
    return ((1 - far.y) / 2) * vh;
  }

  // The arrival: from above the town, back through the window, down to the seat.
  const { win, wallZ } = ROOM;
  const outside = new THREE.Vector3((win.x0 + win.x1) / 2, 9, -90);
  const sill = new THREE.Vector3((win.x0 + win.x1) / 2, (win.y0 + win.y1) / 2, wallZ);
  const p = new THREE.Vector3();
  function pose(t) {
    if (t < ARRIVAL) {
      const k = ease(t / ARRIVAL);
      if (k < 0.75) p.lerpVectors(outside, sill, k / 0.75);
      else p.lerpVectors(sill, seat.position, (k - 0.75) / 0.25);
      camera.position.copy(p);
      camera.rotation.copy(seat.rotation);
    } else {
      const s = t - ARRIVAL;
      camera.position.copy(seat.position);
      camera.position.x += 0.02 * Math.sin(s * 0.9);
      camera.position.y += 0.008 * Math.sin(s * 1.3);
      camera.rotation.set(seat.rotation.x + 0.004 * Math.sin(s * 0.7), seat.rotation.y + 0.008 * Math.sin(s * 0.9), 0);
    }
  }

  let first = true;
  function render() {
    renderer.info.reset();
    renderer.clear();
    camera.layers.set(LAYERS.city);
    office.lights.exterior.visible = true;
    office.lights.interior.visible = false;
    scene.environment = skyEnv;
    scene.environmentIntensity = 1;
    renderer.render(scene, camera);
    camera.layers.set(LAYERS.room);
    camera.layers.enable(LAYERS.desk);
    office.lights.exterior.visible = false;
    office.lights.interior.visible = true;
    scene.environment = roomEnv;
    scene.environmentIntensity = 0.7;
    if (first) renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
    first = false;
  }

  // Warm-up (`warm=1`): compile every shader and upload every buffer before the arrival, by drawing the whole scene
  // once with frustum culling off, so that no object costs its first upload when it comes into view.
  if (params.get('warm') === '1') {
    t0 = performance.now();
    const culled = [];
    scene.traverse((o) => {
      if (o.isMesh && o.frustumCulled) {
        o.frustumCulled = false;
        culled.push(o);
      }
    });
    pose(0);
    render();
    pose(ARRIVAL);
    render();
    for (const o of culled) o.frustumCulled = true;
    renderer.getContext().finish();
    timings.warmupMs = round(performance.now() - t0);
  }

  return {
    duration: ARRIVAL + SEATED,
    phaseAt: (t) => (t < ARRIVAL ? 'arrivée' : 'assis'),
    frame(t) {
      pose(t);
      sky.style.transform = `translateY(${(horizonY() - vh).toFixed(1)}px)`;
      render();
      placeOverlays();
    },
    stats() {
      const gpu = sceneGpuBytes([scene]);
      const envMB = round((2 * (256 * 256 * 4 * 6 * 1.33 * 2)) / 1048576, 1);
      return {
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        ...gpu,
        framebufferMB: framebufferMB(renderer, [2048, 2048]),
        environmentMB: envMB,
        gpuTotalMB: round(gpu.geometryMB + gpu.texturesMB + framebufferMB(renderer, [2048, 2048]) + envMB, 1),
        pixelRatio: renderer.getPixelRatio(),
        canvas: `${renderer.domElement.width}×${renderer.domElement.height}`,
        shadows: shadowsLive ? 'recalculées à chaque image' : 'figées',
      };
    },
    hud: () => [`${renderer.info.render.calls} appels · ${(renderer.info.render.triangles / 1000).toFixed(0)} k tri.`],
    dispose() {
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

/**
 * Renders the office from the site's modules (plan §2.5), for `scripts/render-office-layers.ts`: one layer (city,
 * room, desk, every town window lit on black, or the desk's contact shadows) or a preview of the three over the sky,
 * with where things land in the picture. Query: moment, framing, layer (city | room | desk | windows | contact | preview
 * | room-depth | desk-depth | room-near<cm> | room-near<cm>-depth), scale, overscan. A depth layer holds each pixel's distance to the camera, in metres over
 * 16, on 16 bits (red then green), opaque where something is drawn: the office in relief (`src/scene/office/relief.ts`)
 * lifts its layers by it.
 */
import {
  ACESFilmicToneMapping,
  Fog,
  MeshBasicMaterial,
  PCFShadowMap,
  DoubleSide,
  ShaderMaterial,
  Vector3,
  SRGBColorSpace,
  WebGLRenderer,
  type Mesh,
} from 'three';
import { createOffice } from '../../src/scene/office/office';
import { bakeContactShadows, CONTACT } from '../../src/scene/office/contact';
import { LAYERS, isMesh } from '../../src/scene/office/common';
import { FRAMINGS, makeCamera, type Framing } from '../../src/scene/office/framings';
import { FRAMES } from '../../src/scene/office/frame';
import { allLitMaterials } from '../../src/scene/office/city';
import { anchorsOf, placement } from '../../src/scene/office/corners';
import { buildTownGeometry } from '../../src/scene/office/town';
import { loadPlanetModel } from '../../src/scene/planet/load';
import type { Moment } from '../../src/scene/time';

declare global {
  interface Window {
    __image?: string;
    __meta?: unknown;
    __done?: boolean;
    __error?: string;
  }
}

const q = new URLSearchParams(location.search);
const moment = (q.get('moment') ?? 'crepuscule') as Moment;
const framing = (q.get('framing') ?? 'desktop') as Framing;
const layer = q.get('layer') ?? 'preview';
const scale = Number(q.get('scale') ?? 1);
const overscan = Number(q.get('overscan') ?? 0);
const f = FRAMINGS[framing];
const W = Math.round(f.w * (1 + 2 * overscan));
const H = Math.round(f.h * (1 + 2 * overscan));

/** The depth, in metres from the camera's plane over `DEPTH_RANGE`, on 16 bits: red holds the high byte, green the low. */
const DEPTH_RANGE = 16;
const depthMaterial = new ShaderMaterial({
  // Both sides: the inside of the lamp's bell and the leaves are seen from their back.
  side: DoubleSide,
  vertexShader: `
    #include <common>
    varying float vDepth;
    void main() {
      #include <begin_vertex>
      #include <project_vertex>
      vDepth = -mvPosition.z;
    }`,
  fragmentShader: `
    varying float vDepth;
    void main() {
      float v = floor(clamp(vDepth / ${DEPTH_RANGE.toFixed(1)}, 0.0, 1.0) * 65535.0 + 0.5);
      float high = floor(v / 256.0);
      gl_FragColor = vec4(high / 255.0, (v - high * 256.0) / 255.0, 0.0, 1.0);
    }`,
});

async function main(): Promise<void> {
  const depth = layer.endsWith('-depth');
  // Without antialiasing for a depth layer: an edge's pixel would mix the two bytes of a near and a far depth.
  const renderer = new WebGLRenderer({ antialias: !depth, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(scale);
  renderer.setSize(W, H, false);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  document.body.append(renderer.domElement);

  const model = await loadPlanetModel('/models/petit-prince.glb');
  const office = await createOffice(renderer, moment, buildTownGeometry(), model.rose);
  const camera = makeCamera(framing, overscan);
  const meta = { moment, framing, w: W, h: H, overscan, scale, ...placement(office, camera, W, H) };
  const anchors = anchorsOf(office);
  // The room seen from near the window, as the arrival shows it on its way (`room-near<cm>`, `room-near<cm>-depth`): the
  // camera moved along the arrival's axis by that many centimetres. Faces the seat sees edge on (the lintel from below)
  // have their pixels there.
  const near = Number(/^room-near(\d+)/.exec(layer)?.[1] ?? 0) / 100;
  if (near) {
    const frame = FRAMES[framing];
    const rest = makeCamera(framing);
    const axis = new Vector3((frame.axis[0] / frame.w) * 2 - 1, 1 - (frame.axis[1] / frame.h) * 2, 0.5)
      .unproject(rest)
      .sub(rest.position)
      .normalize();
    camera.position.addScaledVector(axis, near);
    camera.updateMatrixWorld();
  }
  const pass = layer.replace(/-near\d+/, '').replace('-depth', '') as keyof typeof LAYERS;

  if (layer === 'contact') {
    // The desk's contact shadows, as the render target holds them (rows from the bottom): the same for every moment.
    const target = bakeContactShadows(renderer, office.desk.group);
    const pixels = new Uint8Array(CONTACT.width * CONTACT.height * 4);
    renderer.readRenderTargetPixels(target, 0, 0, CONTACT.width, CONTACT.height, pixels);
    const canvas = document.createElement('canvas');
    canvas.width = CONTACT.width;
    canvas.height = CONTACT.height;
    canvas.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(pixels), CONTACT.width), 0, 0);
    window.__image = canvas.toDataURL('image/png');
    window.__meta = meta;
    window.__done = true;
    return;
  }
  if (layer === 'windows') {
    // Every window of the town lit and nothing else, on black, fading with distance: the source of the windows that
    // light up now and then over the town.
    const lit = allLitMaterials();
    const black = new MeshBasicMaterial({ color: 0x000000 });
    office.city.group.traverse((node) => {
      if (!isMesh(node)) return;
      const mesh: Mesh = node;
      mesh.material = mesh === office.city.walls ? lit.walls : mesh === office.city.blocks ? lit.blocks : black;
    });
    const fog = office.scene.fog as Fog;
    office.scene.fog = new Fog(0x000000, fog.near, fog.far);
    office.lights.exterior.visible = false;
    office.lights.room.interior.visible = false;
    office.lights.desk.interior.visible = false;
    camera.layers.set(LAYERS.city);
    renderer.setClearColor(0x000000, 1);
    renderer.render(office.scene, camera);
  } else if (depth) {
    renderer.toneMapping = 0;
    // Only what stands in the room: not what is laid over it, as the contact shadows (`userData.noDepth`).
    // Nor what is seen through (the rose's glass bell, which writes no depth either): what is behind it gives the depth.
    office.scene.traverse((node) => {
      const material = (node as Partial<Mesh>).material;
      const seeThrough = !Array.isArray(material) && material?.transparent === true && !material.depthWrite;
      if (node.userData.noDepth || seeThrough) node.visible = false;
    });
    office.scene.overrideMaterial = depthMaterial;
    office.renderLayer(renderer, camera, pass);
    office.scene.overrideMaterial = null;
  } else if (layer === 'preview') {
    office.render(renderer, { city: camera, room: camera });
  } else {
    office.renderLayer(renderer, camera, pass);
  }
  window.__image = renderer.domElement.toDataURL('image/png');
  // The anchors in the scene's metres, for the office in relief, which projects them with its own camera.
  const xyz = (v: { x: number; y: number; z: number }): number[] => [v.x, v.y, v.z].map((n) => Number(n.toFixed(4)));
  window.__meta = {
    ...meta,
    anchors: {
      screen: anchors.screen.map(xyz),
      window: anchors.window.map(xyz),
      bulb: xyz(anchors.bulb),
      sun: anchors.sun && { centre: xyz(anchors.sun.centre), rim: xyz(anchors.sun.rim) },
      pictures: anchors.pictures.map((p) => ({ ...p, corners: p.corners.map(xyz) })),
      glowAzimuth: anchors.glowAzimuth,
    },
  };
  window.__done = true;
}

main().catch((error: unknown) => {
  window.__error = String(error);
  window.__done = true;
});

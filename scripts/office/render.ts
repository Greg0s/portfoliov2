/**
 * Renders the office from the site's modules (plan §2.5), for `scripts/render-office-layers.ts`: one layer (city,
 * room, desk, or every town window lit on black) or a preview of the three over the sky, with where things land in
 * the picture. Query: moment, framing, layer (city | room | desk | windows | preview), scale, overscan.
 */
import {
  ACESFilmicToneMapping,
  Fog,
  MeshBasicMaterial,
  PCFShadowMap,
  SRGBColorSpace,
  WebGLRenderer,
  type Mesh,
} from 'three';
import { createOffice } from '../../src/scene/office/office';
import { LAYERS, isMesh } from '../../src/scene/office/common';
import { FRAMINGS, makeCamera, type Framing } from '../../src/scene/office/framings';
import { allLitMaterials } from '../../src/scene/office/city';
import { placement } from '../../src/scene/office/corners';
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

async function main(): Promise<void> {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
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
  } else if (layer === 'preview') {
    office.render(renderer, { city: camera, room: camera });
  } else {
    office.renderLayer(renderer, camera, layer as keyof typeof LAYERS);
  }
  window.__image = renderer.domElement.toDataURL('image/png');
  window.__meta = meta;
  window.__done = true;
}

main().catch((error: unknown) => {
  window.__error = String(error);
  window.__done = true;
});

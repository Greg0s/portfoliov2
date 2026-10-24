/**
 * The town's meshes, on the main thread (office spec §3): the geometry the worker built (`town.ts`) under its
 * materials, with what is cheap to build here: the plain, our hill, the river between its quays, two bridges, the
 * landmarks, the park and the hills on five planes. The whole town is drawn on its own layer, under its own lights.
 */
import {
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Path,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  BoxGeometry,
  Vector2,
  Vector3,
  type CanvasTexture,
} from 'three';
import { box, canvasTexture, DEG, LAYERS, onLayer, rng, std } from './common';
import type { OfficeMoment } from './moments';
import {
  ACROSS,
  ALONG,
  at,
  CITY,
  footing,
  HALF,
  polar,
  relief,
  RIVER_TURN,
  type PackedGeometry,
  type TownGeometry,
} from './town';

/**
 * The windows of the facades, 8 × 8 cells of one bay and one floor each: classic windows with a sill, or the ribbon
 * windows of modern blocks.
 */
const WINDOWS = {
  classic: { x: 0.3, y: 0.24, w: 0.4, h: 0.52, glass: 'rgba(64,66,80,0.86)', sill: true },
  ribbon: { x: 0.02, y: 0.3, w: 0.96, h: 0.42, glass: 'rgba(58,66,82,0.9)', sill: false },
} as const;

function facadeTextures(
  seed: number,
  litRatio: number,
  style: keyof typeof WINDOWS = 'classic',
): { map: CanvasTexture; emissive: CanvasTexture } {
  const cols = 8;
  const rows = 8;
  const r = rng(seed);
  const lit: (string | null)[] = [];
  for (let i = 0; i < cols * rows; i += 1) lit.push(r() < litRatio ? (r() < 0.7 ? '#ffcf86' : '#ffe6b8') : null);
  const cell = 64;
  const win = WINDOWS[style];
  const draw =
    (emissive: boolean) =>
    (ctx: CanvasRenderingContext2D, w: number, h: number): void => {
      ctx.fillStyle = emissive ? '#000' : '#fff';
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          const px = x * cell + cell * win.x;
          const py = (rows - 1 - y) * cell + cell * win.y;
          const on = lit[y * cols + x];
          if (emissive) {
            if (on) {
              ctx.fillStyle = on;
              ctx.fillRect(px, py, cell * win.w, cell * win.h);
            }
          } else {
            ctx.fillStyle = win.glass;
            ctx.fillRect(px, py, cell * win.w, cell * win.h);
            if (win.sill) {
              ctx.fillStyle = 'rgba(255,255,255,0.4)';
              ctx.fillRect(px - 2, py + cell * win.h, cell * win.w + 4, 3);
            }
          }
        }
      }
    };
  return {
    map: canvasTexture(cols * cell, rows * cell, draw(false)),
    emissive: canvasTexture(cols * cell, rows * cell, draw(true)),
  };
}

export function unpack(packed: PackedGeometry): BufferGeometry {
  const geometry = new BufferGeometry();
  for (const [name, { array, itemSize }] of Object.entries(packed.attributes)) {
    geometry.setAttribute(name, new BufferAttribute(array, itemSize));
  }
  if (packed.index) geometry.setIndex(new BufferAttribute(packed.index, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

/** Facade materials whose lit windows can be swapped for the moment's ratio, and their every-window-lit version. */
export interface Facades {
  walls: MeshStandardMaterial;
  blocks: MeshStandardMaterial;
  dispose(): void;
}

function facadeMaterials(moment: OfficeMoment): Facades {
  const M = moment.city;
  const facade = facadeTextures(5, M.lit);
  const ribbon = facadeTextures(6, M.lit * 0.8, 'ribbon');
  const walls = new MeshStandardMaterial({
    vertexColors: true,
    map: facade.map,
    emissiveMap: facade.emissive,
    emissive: 0xffffff,
    emissiveIntensity: M.litGlow,
    roughness: 0.92,
  });
  const blocks = new MeshStandardMaterial({
    vertexColors: true,
    map: ribbon.map,
    emissiveMap: ribbon.emissive,
    emissive: 0xffffff,
    emissiveIntensity: M.litGlow,
    roughness: 0.9,
  });
  return {
    walls,
    blocks,
    dispose() {
      [facade.map, facade.emissive, ribbon.map, ribbon.emissive].forEach((t) => {
        t.dispose();
      });
    },
  };
}

/**
 * Hills on five planes, each paler than the one in front, lost at its foot in the mist that lies over the town; the
 * farthest nearly melt into the sky. Each silhouette is set by the angle at which it rises above the eye. The second
 * plane carries a slender metal tower. At dusk the sun sets far beyond them.
 */
function hillPlanes(moment: OfficeMoment): Group {
  const M = moment;
  const fog = new Color(M.city.fog);
  const haze = fog.clone().lerp(new Color(M.sky.at(-1) ?? M.city.fog), 0.35);
  const eye = 1.2;
  const g = new Group();
  const planes = [
    { d: 3000, lo: -0.8, hi: 1.6, seed: 31, haze: 0.04, freq: 1.4 },
    { d: 3900, lo: 0, hi: 2.4, seed: 8, haze: 0.22, freq: 1.2 },
    { d: 5000, lo: 0.6, hi: 3.1, seed: 3, haze: 0.4, freq: 1.1 },
    { d: 6300, lo: 1, hi: 3.7, seed: 17, haze: 0.56, freq: 1 },
    { d: 8000, lo: 1.4, hi: 4.3, seed: 23, haze: 0.72, freq: 0.9 },
  ];
  const steps = 360;
  const tops: [Vector2, number][][] = [];
  planes.forEach((pl) => {
    const rr = rng(pl.seed);
    const ph = [rr() * 6, rr() * 6, rr() * 6, rr() * 6] as const;
    const f = pl.freq;
    const top = new Color(M.city.hills).lerp(haze, pl.haze);
    const low = top.clone().lerp(fog, 0.6);
    const pos: number[] = [];
    const col: number[] = [];
    const line: [Vector2, number][] = [];
    for (let i = 0; i <= steps; i += 1) {
      const az = -62 + (124 * i) / steps;
      const k =
        0.5 +
        0.32 * Math.sin(az * 0.09 * f + ph[0]) +
        0.14 * Math.sin(az * 0.23 * f + ph[1]) +
        0.05 * Math.sin(az * 0.61 * f + ph[2]);
      const d = pl.d * (1 + 0.06 * Math.sin(az * 0.05 + ph[3]));
      const p = polar(az, d);
      const y = eye + Math.tan((pl.lo + (pl.hi - pl.lo) * k) * DEG) * d;
      const mist = Math.tan(0.9 * DEG) * d;
      pos.push(p.x, y, p.y, p.x, y - mist, p.y, p.x, CITY.land - 60, p.y);
      col.push(...top.toArray(), ...low.toArray(), ...fog.toArray());
      line.push([p, y]);
    }
    tops.push(line);
    const index: number[] = [];
    for (let i = 0; i < steps; i += 1) {
      for (let k = 0; k < 2; k += 1) {
        const a = i * 3 + k;
        const b = (i + 1) * 3 + k;
        index.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new Float32BufferAttribute(col, 3));
    geo.setIndex(index);
    const material = new MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false, side: DoubleSide });
    g.add(new Mesh(geo, material));
  });
  const towerFoot = tops[1]?.[Math.round(((-12 + 62) / 124) * steps)];
  if (towerFoot) {
    const [p, y] = towerFoot;
    const tower = new Mesh(
      new CylinderGeometry(0.8, 5, 90, 4),
      new MeshBasicMaterial({ color: new Color(M.city.hills).lerp(haze, 0.22), fog: false, toneMapped: false }),
    );
    tower.position.set(p.x * 0.995, y + 40, p.y * 0.995);
    g.add(tower);
  }
  // The setting sun, far beyond the last hills, which hide its lower part; paler at the top, warmer toward the bottom.
  if (M.sunDisc) {
    const d = 9500;
    const az = M.glow.azimuth * DEG;
    const el = M.sunDisc.elevation * DEG;
    const r = d * Math.tan((M.sunDisc.size / 2) * DEG);
    const geo = new CircleGeometry(r, 64);
    const top = new Color(0xffefc4);
    const low = new Color(0xffbf7a);
    const sp = geo.getAttribute('position');
    const tint = new Float32Array(sp.count * 3);
    for (let i = 0; i < sp.count; i += 1)
      low
        .clone()
        .lerp(top, (sp.getY(i) / r + 1) / 2)
        .toArray(tint, i * 3);
    geo.setAttribute('color', new BufferAttribute(tint, 3));
    const sun = new Mesh(geo, new MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false }));
    sun.position.set(Math.sin(az) * Math.cos(el) * d, eye + Math.sin(el) * d, -Math.cos(az) * Math.cos(el) * d);
    sun.lookAt(0, eye, 0);
    sun.name = 'sun';
    sun.userData.radius = r;
    g.add(sun);
  }
  return g;
}

function landmarks(g: Group): void {
  // A dome near the far quay, bell towers, and a small dome of green copper further away.
  const stone = std(0xdccab0, 0.88);
  const slate = std(0x6c7480, 0.6, 0.3);
  {
    const p = polar(-4, 560);
    const y = CITY.land + relief(p);
    const drum = new Mesh(new CylinderGeometry(9, 9, 10, 32), stone);
    drum.position.set(p.x, y + 24, p.y);
    const dome = new Mesh(new SphereGeometry(9.4, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), slate);
    dome.position.set(p.x, y + 29, p.y);
    dome.scale.y = 1.25;
    const lantern = new Mesh(new CylinderGeometry(1.4, 1.4, 4, 12), stone);
    lantern.position.set(p.x, y + 42, p.y);
    g.add(drum, dome, lantern);
  }
  (
    [
      [-15, 820, 38, 8],
      [7, 1150, 44, 8],
      [-9, 1600, 40, 8],
      [-14, 1050, 34, 7],
      [1.5, 980, 30, 7],
    ] as const
  ).forEach(([az, d, h, w]) => {
    const p = polar(az, d);
    const y = CITY.land + footing(p, w, w);
    g.add(box(w, h, w, stone, p.x, y + h / 2, p.y));
    const spire = new Mesh(new ConeGeometry(w * 0.7, h * 0.39, 4), slate);
    spire.rotation.y = Math.PI / 4 + RIVER_TURN;
    spire.position.set(p.x, y + h + h * 0.195, p.y);
    g.add(spire);
  });
  {
    const p = polar(-8.5, 1350);
    const y = CITY.land + relief(p);
    const drum = new Mesh(new CylinderGeometry(7, 7, 9, 28), stone);
    drum.position.set(p.x, y + 20, p.y);
    const dome = new Mesh(new SphereGeometry(7.3, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), std(0x6f9a8a, 0.55, 0.3));
    dome.position.set(p.x, y + 24.5, p.y);
    dome.scale.y = 1.2;
    g.add(drum, dome);
  }
}

function bridges(g: Group): void {
  // Two stone bridges with segmental arches.
  const bridgeMat = std(0xcfbea3, 0.85);
  for (const u of [90, 210]) {
    const len = HALF * 2 + 30;
    const s = new Shape();
    s.moveTo(-len / 2, -9);
    s.lineTo(len / 2, -9);
    s.lineTo(len / 2, 1.6);
    s.lineTo(-len / 2, 1.6);
    s.lineTo(-len / 2, -9);
    const arches = 5;
    const pier = 3;
    const span = (HALF * 2 - pier * (arches + 1)) / arches;
    const rise = 4.6;
    const R = (span * span) / 4 / (2 * rise) + rise / 2;
    const half = Math.asin(span / 2 / R);
    for (let i = 0; i < arches; i += 1) {
      const cx = -HALF + pier + span / 2 + i * (span + pier);
      const hole = new Path();
      hole.moveTo(cx - span / 2, -7);
      hole.lineTo(cx - span / 2, -6.5);
      hole.absarc(cx, -6.5 + rise - R, R, Math.PI / 2 + half, Math.PI / 2 - half, true);
      hole.lineTo(cx + span / 2, -7);
      hole.lineTo(cx - span / 2, -7);
      s.holes.push(hole);
    }
    const m = new Mesh(new ExtrudeGeometry(s, { depth: 14, bevelEnabled: false }).translate(0, 0, -7), bridgeMat);
    const c = at(u, 0);
    m.matrixAutoUpdate = false;
    m.matrix
      .makeBasis(new Vector3(ACROSS.x, 0, ACROSS.y), new Vector3(0, 1, 0), new Vector3(ALONG.x, 0, ALONG.y))
      .setPosition(c.x, CITY.land, c.y);
    g.add(m);
  }
}

export interface City {
  group: Group;
  facades: Facades;
  /** The town's walls and blocks, whose windows light up now and then. */
  walls: Mesh;
  blocks: Mesh;
  sun: Mesh | null;
}

/** Every window of the town lit, for the layer from which windows light up now and then. */
export function allLitMaterials(): { walls: MeshBasicMaterial; blocks: MeshBasicMaterial } {
  return {
    walls: new MeshBasicMaterial({ map: facadeTextures(5, 1).emissive }),
    blocks: new MeshBasicMaterial({ map: facadeTextures(6, 1, 'ribbon').emissive }),
  };
}

export function buildCity(town: TownGeometry, moment: OfficeMoment): City {
  const M = moment.city;
  const g = new Group();
  const facades = facadeMaterials(moment);
  const walls = new Mesh(unpack(town.parts.walls), facades.walls);
  const blocks = new Mesh(unpack(town.parts.blocks), facades.blocks);
  g.add(walls, blocks);
  g.add(
    new Mesh(
      unpack(town.parts.roofs),
      new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true }),
    ),
  );
  g.add(new Mesh(unpack(town.parts.chimneys), std(0xb9a58f, 0.9)));
  landmarks(g);

  // Ground: the plain of the town with the river cut out of it, the relief over it, and our hill.
  const earth = std(0x5a4f48, 0.95);
  const land = new Shape([
    new Vector2(-7000, -300),
    new Vector2(7000, -300),
    new Vector2(7000, 9000),
    new Vector2(-7000, 9000),
  ]);
  land.holes.push(
    new Path([at(-250, -HALF), at(3500, -HALF), at(3500, HALF), at(-250, HALF)].map((p) => new Vector2(p.x, -p.y))),
  );
  g.add(new Mesh(new ShapeGeometry(land).rotateX(-Math.PI / 2).translate(0, CITY.land, 0), earth));
  g.add(new Mesh(unpack(town.parts.ground), earth));
  const { top, flat, foot } = CITY.hill;
  const hill = new Mesh(new CylinderGeometry(flat, foot, top - CITY.land, 96, 1, true), std(0x4a5139, 0.95));
  hill.position.y = (top + CITY.land) / 2;
  g.add(hill);

  // The river between high stone quays.
  const mid = at(1625, 0);
  const waterMaterial = new MeshStandardMaterial({
    color: 0x262d3d,
    roughness: 0.07,
    metalness: 0,
    envMapIntensity: 1.8,
  });
  const water = new Mesh(new PlaneGeometry(3750, HALF * 2).rotateX(-Math.PI / 2), waterMaterial);
  water.rotation.y = RIVER_TURN;
  water.position.set(mid.x, CITY.water, mid.y);
  g.add(water);
  const quayStone = std(0xc3b39b, 0.9);
  for (const side of [1, -1]) {
    const wallH = CITY.land - CITY.water;
    const qw = new Mesh(new BoxGeometry(3750, wallH, 1.5), quayStone);
    const c = at(1625, side * (HALF + 0.75));
    qw.position.set(c.x, CITY.water + wallH / 2, c.y);
    qw.rotation.y = RIVER_TURN;
    const walk = new Mesh(new BoxGeometry(3750, 0.3, 9), quayStone);
    const cw = at(1625, side * (HALF + 6));
    walk.position.set(cw.x, CITY.land + 0.15, cw.y);
    walk.rotation.y = RIVER_TURN;
    g.add(qw, walk);
  }
  // The park: the pond raised a little above the lawn, itself above the ground, so that the depth buffer still tells
  // them apart from this far away.
  const pond = new Mesh(new CircleGeometry(1, 40).rotateX(-Math.PI / 2), waterMaterial);
  pond.scale.set(town.pond.ru, 1, town.pond.rv);
  pond.rotation.y = RIVER_TURN;
  pond.position.set(town.pond.center[0], CITY.land + 1.2, town.pond.center[1]);
  const lawn = new Mesh(
    new ShapeGeometry(new Shape(town.lawn.map(([x, z]) => new Vector2(x, -z)))).rotateX(-Math.PI / 2),
    std(0x7d9a5a, 0.95),
  );
  lawn.position.y = CITY.land + 0.6;
  g.add(pond, lawn);
  g.add(new Mesh(unpack(town.parts.trees), std(0x3a4a31, 0.95, 0, { flatShading: true })));
  g.add(
    new Mesh(unpack(town.parts.lamps), new MeshBasicMaterial({ color: new Color(0xffc472).multiplyScalar(M.lamps) })),
  );
  bridges(g);

  const hills = hillPlanes(moment);
  g.add(hills);
  onLayer(g, LAYERS.city, false);
  const sun = hills.getObjectByName('sun');
  return { group: g, facades, walls, blocks, sun: sun instanceof Mesh ? sun : null };
}

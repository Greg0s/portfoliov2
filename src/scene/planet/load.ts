/**
 * Loads the planet's web model (main spec §6.1): `GLTFLoader` with `MeshoptDecoder`. After quantization each mesh sits
 * on an unnamed child of its named node, so meshes are looked for inside the named nodes. The model's decor (stars,
 * glowing planets, rings) stays the opening's image, with its bloom: the live planet draws the planet, the
 * characters and the rose. The office (step 7) takes its rose from the same file.
 */
import { LoaderUtils, Mesh, PropertyBinding, Vector3, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { Calm } from '../workers/relief';

// Nodes left over from modelling: untransformed copies of the rose and the fox (one stem reaches y = 61).
const LEFTOVERS = [
  'Cube.004',
  'Cube.005',
  'Cube.006',
  'Cylinder.006',
  'Cylinder.007',
  'Cylinder.008',
  'Cylinder.009',
  'Cylinder.010',
  'Cylinder.011',
  'pétale save',
  'pétale save.002',
  'pétale.004',
  'pétale.005',
  'pétale.006',
];
// Hidden under the coat, without material; and the shooting star, which crosses the decor.
const HIDDEN = ['buste', 'bras droit', 'bras g', 'Cylinder'];
const DECOR = [
  'etoile',
  'etoile.001',
  'etoile.002',
  'etoile.003',
  'etoile.004',
  'planet',
  'planet.003',
  'planet.004',
  'planet.005',
  'planet.006',
  'planet.007',
  'planet.008',
  'planet.009',
  'Torus.001',
  'Torus.002',
  'Torus.003',
];

/** GLTFLoader sanitizes node names (spaces become underscores, dots are dropped). */
const sanitize = (names: readonly string[]): Set<string> =>
  new Set(names.map((name) => PropertyBinding.sanitizeNodeName(name)));

export interface PlanetModel {
  root: Object3D;
  planet: Mesh;
  hair: Mesh;
  scarf: Mesh | null;
  rose: Object3D | null;
  byName(name: string): Object3D | undefined;
  /** Where the prince, the fox and the rose stand, kept calm in the relief. */
  calm: Calm[];
}

/** Whether a node is a mesh, typed with the default mesh's geometry and materials. */
export function isMesh(node: Object3D): node is Mesh {
  return node instanceof Mesh;
}

export function meshIn(node: Object3D | undefined): Mesh | null {
  const found: Mesh[] = [];
  node?.traverse((child) => {
    if (isMesh(child)) found.push(child);
  });
  return found[0] ?? null;
}

/**
 * Loads the model at `url`. `beforeParse`, when given, runs between the download and the parsing, which holds the main
 * thread a while: the live planet waits there for the page at rest.
 */
export async function loadPlanetModel(url: string, beforeParse?: () => Promise<void>): Promise<PlanetModel> {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  let gltf;
  if (beforeParse) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`The planet model answered ${String(response.status)}.`);
    const data = await response.arrayBuffer();
    await beforeParse();
    gltf = await loader.parseAsync(data, LoaderUtils.extractUrlBase(url));
  } else {
    gltf = await loader.loadAsync(url);
  }
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const byName = (name: string): Object3D | undefined => root.getObjectByName(PropertyBinding.sanitizeNodeName(name));

  const planet = meshIn(byName('planet.002'));
  const hair = meshIn(byName('planet.001'));
  if (!planet || !hair) throw new Error('The planet model has no planet or hair.');
  // The generated geometry is in the node's own units: drop the dequantization transform of the unnamed child.
  for (const mesh of [planet, hair]) {
    if (mesh.parent && mesh.parent !== root) {
      mesh.position.set(0, 0, 0);
      mesh.quaternion.identity();
      mesh.scale.set(1, 1, 1);
    }
  }
  root.updateMatrixWorld(true);

  const toLocal = (name: string): [number, number, number] => {
    const point = byName(name)?.getWorldPosition(new Vector3()) ?? new Vector3(0, 1, 0);
    return planet.worldToLocal(point).normalize().toArray();
  };
  const calm: Calm[] = [
    { dir: toLocal('Cube.001'), radius: 0.42, floor: 0.15 },
    { dir: toLocal('Cube'), radius: 0.38, floor: 0.2 },
    { dir: toLocal('pétale.003'), radius: 0.25, floor: 0.3 },
  ];

  const hidden = sanitize([...LEFTOVERS, ...HIDDEN, ...DECOR]);
  const roseName = PropertyBinding.sanitizeNodeName('pétale.003');
  root.traverse((mesh) => {
    if (!isMesh(mesh)) return;
    let hide = false;
    let inRose = false;
    for (let n: Object3D | null = mesh; n && n !== root; n = n.parent) {
      if (hidden.has(n.name)) hide = true;
      if (n.name === roseName) inRose = true;
    }
    if (hide) {
      mesh.visible = false;
      return;
    }
    // The rose casts a hard spot on the planet that reads as a hole: it casts no shadow.
    mesh.castShadow = !inRose;
    mesh.receiveShadow = true;
  });
  // What is hidden is left out of the scene: no draw, no shader to compile.
  const out: Object3D[] = [];
  root.traverse((node) => {
    if (hidden.has(node.name)) out.push(node);
  });
  out.forEach((node) => node.removeFromParent());

  return { root, planet, hair, scarf: meshIn(byName('echarpe')), rose: byName('pétale.003') ?? null, byName, calm };
}

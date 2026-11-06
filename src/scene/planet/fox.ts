/**
 * The fox in the wind (Grégoire's wish, 5 November 2026), like the scarf and the rose: its ears sway a little, each
 * bending from its root, and its tail sways around its root. The tail is a mesh of its own, turned as a whole; the
 * ears belong to the head's mesh, so their vertices are bent on the CPU, a few hundred each frame (no new shader).
 */
import { BufferAttribute, Group, MathUtils, Quaternion, Vector3, type Mesh, type Object3D } from 'three';
import { isMesh, meshIn, type PlanetModel } from './load';

const HEAD = 'Cube';
const BODY = 'Cube.002';
const TAIL = 'Cube.003';

export type FoxPose = (tailDeg: number, earsDeg: readonly [number, number]) => void;

export function foxWind(model: PlanetModel, exaggerate = 1): FoxPose {
  const center = model.planet.getWorldPosition(new Vector3());
  const tail = tailSway(model, center);
  const ears = earSway(model, center);
  return (tailDeg, earsDeg) => {
    tail(tailDeg * exaggerate);
    ears(earsDeg[0] * exaggerate, earsDeg[1] * exaggerate);
  };
}

/** Points of a mesh, in the world. */
function worldPoints(mesh: Mesh): Vector3[] {
  const position = mesh.geometry.getAttribute('position');
  return Array.from({ length: position.count }, (_, i) =>
    new Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld),
  );
}

function centroid(points: readonly Vector3[]): Vector3 {
  const sum = new Vector3();
  points.forEach((p) => sum.add(p));
  return sum.divideScalar(Math.max(1, points.length));
}

/**
 * The tail turns around its root (its point nearest the body), around the fox's front-to-back axis: from above, as
 * the camera sees it, it swings from side to side.
 */
function tailSway(model: PlanetModel, center: Vector3): (degrees: number) => void {
  const tail = model.byName(TAIL);
  const body = meshIn(model.byName(BODY));
  const first = meshIn(tail);
  if (!tail?.parent || !body || !first) return () => undefined;
  const bodyCenter = centroid(worldPoints(body));
  const points: Vector3[] = [];
  tail.traverse((node) => {
    if (isMesh(node)) points.push(...worldPoints(node));
  });
  let root = points[0] ?? bodyCenter;
  points.forEach((p) => {
    if (p.distanceTo(bodyCenter) < root.distanceTo(bodyCenter)) root = p;
  });
  const up = bodyCenter.clone().sub(center).normalize();
  // From the root to the tail's middle, flattened on the ground: the way the tail points.
  const back = centroid(points).sub(root);
  back.addScaledVector(up, -back.dot(up)).normalize();
  const pivot: Object3D = new Group();
  pivot.position.copy(root);
  model.root.add(pivot);
  pivot.updateMatrixWorld(true);
  pivot.attach(tail);
  const axis = back;
  const turn = new Quaternion();
  return (degrees) => {
    pivot.quaternion.copy(turn.setFromAxisAngle(axis, MathUtils.degToRad(degrees)));
  };
}

interface Ear {
  /** Head vertices that move, with how much (0 at the root, 1 from a third of the ear up). */
  index: Uint32Array;
  weight: Float32Array;
  pivot: Vector3;
  axis: Vector3;
}

/**
 * The ears: the head is a sphere with two ears on top. Their tips are the head's highest points, one on each side; the
 * sphere is fitted on the rest of the head. An ear is what stands out of the sphere towards its tip; it bends from
 * where it leaves the sphere, around the axis that swings its tip from side to side.
 */
function earSway(model: PlanetModel, center: Vector3): (left: number, right: number) => void {
  const head = meshIn(model.byName(HEAD));
  if (!head) return () => undefined;
  const points = worldPoints(head);
  const middle = centroid(points);
  const up = middle.clone().sub(center).normalize();
  const height = points.map((p) => p.clone().sub(middle).dot(up));
  // The tips: the highest point, then the highest one well away from it (the ears stand about 0.4 apart).
  const highestOf = (keep: (p: Vector3) => boolean): Vector3 => {
    let best = -1;
    points.forEach((p, i) => {
      if (keep(p) && (best < 0 || (height[i] ?? 0) > (height[best] ?? 0))) best = i;
    });
    return points[best] ?? middle;
  };
  const a = highestOf(() => true);
  const b = highestOf((p) => p.distanceTo(a) > 0.2);
  const across = b.clone().sub(a);
  across.addScaledVector(up, -across.dot(up)).normalize();
  const side = (p: Vector3): number => p.clone().sub(middle).dot(across);
  const tips = [a, b];
  // The skull: the head below its middle height.
  const skull = roughSphere(points.filter((_, i) => (height[i] ?? 0) < 0.05));

  const ears: Ear[] = tips.map((tip, which) => {
    const along = tip.clone().sub(skull.center).normalize();
    const reach = tip.clone().sub(skull.center).dot(along);
    const from = skull.radius * 0.97;
    const full = skull.radius + (reach - skull.radius) * 0.35;
    const index: number[] = [];
    const weight: number[] = [];
    points.forEach((p, i) => {
      const d = p.clone().sub(skull.center);
      const s = d.dot(along);
      if (s <= from) return;
      if ((side(p) - side(skull.center)) * (which === 0 ? -1 : 1) < 0) return;
      index.push(i);
      weight.push(MathUtils.smoothstep(s, from, full));
    });
    const axis = new Vector3().crossVectors(along, across).normalize();
    return {
      index: Uint32Array.from(index),
      weight: Float32Array.from(weight),
      pivot: skull.center.clone().addScaledVector(along, skull.radius * 1.03),
      axis,
    };
  });

  // The head's attributes become plain floats, in the world: they are put back in the mesh's space after each bend.
  const geometry = head.geometry;
  const rest = geometry.getAttribute('position');
  const restNormal = geometry.getAttribute('normal');
  const count = rest.count;
  const position = new BufferAttribute(new Float32Array(count * 3), 3);
  const normal = new BufferAttribute(new Float32Array(count * 3), 3);
  for (let i = 0; i < count; i += 1) {
    position.setXYZ(i, rest.getX(i), rest.getY(i), rest.getZ(i));
    const n = new Vector3(restNormal.getX(i), restNormal.getY(i), restNormal.getZ(i)).normalize();
    normal.setXYZ(i, n.x, n.y, n.z);
  }
  geometry.setAttribute('position', position);
  geometry.setAttribute('normal', normal);
  const restPosition = Float32Array.from(position.array as Float32Array);
  const restNormals = Float32Array.from(normal.array as Float32Array);
  const toLocal = head.matrixWorld.clone().invert();
  // The ears' pivots and axes, in the mesh's space.
  const local = ears.map((ear) => ({
    ...ear,
    pivot: ear.pivot.clone().applyMatrix4(toLocal),
    axis: ear.axis.clone().transformDirection(toLocal),
  }));
  const v = new Vector3();
  const turn = new Quaternion();
  const posed = [NaN, NaN];

  return (left, right) => {
    [left, right].forEach((degrees, which) => {
      const ear = local[which];
      if (!ear || posed[which] === degrees) return;
      posed[which] = degrees;
      const angle = MathUtils.degToRad(degrees);
      ear.index.forEach((i, k) => {
        turn.setFromAxisAngle(ear.axis, angle * (ear.weight[k] ?? 0));
        v.fromArray(restPosition, i * 3)
          .sub(ear.pivot)
          .applyQuaternion(turn)
          .add(ear.pivot);
        position.setXYZ(i, v.x, v.y, v.z);
        v.fromArray(restNormals, i * 3).applyQuaternion(turn);
        normal.setXYZ(i, v.x, v.y, v.z);
      });
    });
    position.needsUpdate = true;
    normal.needsUpdate = true;
  };
}

/** The sphere around `points`: their centroid, and their median distance to it. */
function roughSphere(points: readonly Vector3[]): { center: Vector3; radius: number } {
  const center = centroid(points);
  const distances = points.map((p) => p.distanceTo(center)).sort((x, y) => x - y);
  return { center, radius: distances[Math.floor(distances.length / 2)] ?? 0 };
}

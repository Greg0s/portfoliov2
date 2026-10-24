/**
 * The journey's camera for Three.js (implementation plan §2.3): the CSS camera of `camera.ts`, as a projection matrix
 * and a world matrix, so that what WebGL draws lands on the same pixels as what the CSS draws.
 */
import { Matrix4, Vector3 } from 'three';
import type { Sway } from './camera';
import type { View } from './layout';

const still: Sway = { dx: 0, dy: 0, roll: 0, tiltX: 0, tiltY: 0 };

/**
 * The same camera for Three.js. World units are CSS px, with y up and the origin at the vanishing point on the focus
 * plane; the camera sits `perspective` px in front of it, looking down −z, and its frustum is off-centre so that the
 * vanishing point lands where the CSS puts it.
 */
export function projectionMatrix(view: View, near = 1, far = 100_000): Matrix4 {
  const k = near / view.perspective;
  return new Matrix4().makePerspective(
    -view.vpX * k,
    (view.width - view.vpX) * k,
    view.vpY * k,
    -(view.height - view.vpY) * k,
    near,
    far,
  );
}

/** The camera's position in the Three.js world, for `projectionMatrix`. */
export function cameraPosition(view: View): Vector3 {
  return new Vector3(0, 0, view.perspective);
}

/** The swayed world matrix of the Three.js scene: the drift and the tilt of `cssTransform`, in Three.js axes. */
export function swayMatrix(sway: Sway): Matrix4 {
  const rad = Math.PI / 180;
  // CSS has y down: in Three.js axes a CSS rotateX(θ) is a rotation of −θ around x, rotateY(θ) of θ around y, and
  // a CSS rotate(θ) of −θ around z.
  return new Matrix4()
    .makeTranslation(sway.dx, -sway.dy, 0)
    .multiply(new Matrix4().makeRotationZ(-sway.roll * rad))
    .multiply(new Matrix4().makeRotationX(-sway.tiltX * rad))
    .multiply(new Matrix4().makeRotationY(sway.tiltY * rad));
}

/** Where Three.js draws a CSS point (`x`, `y` px from the vanishing point, `z` perspective units forward). */
export function projectThree(
  x: number,
  y: number,
  z: number,
  view: View,
  sway: Sway = still,
): { x: number; y: number } {
  const point = new Vector3(x, -y, z * view.perspective)
    .applyMatrix4(swayMatrix(sway))
    .sub(cameraPosition(view))
    .applyMatrix4(projectionMatrix(view));
  return { x: ((point.x + 1) / 2) * view.width, y: ((1 - point.y) / 2) * view.height };
}

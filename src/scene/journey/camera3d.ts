/**
 * The journey's camera for WebGL (implementation plan §2.3): the CSS camera of `camera.ts`, as a projection matrix
 * and a world matrix, so that what WebGL draws lands on the same pixels as what the CSS draws. Plain 4×4 matrices,
 * column-major as WebGL takes them, without Three.js: the stars, the only ones to use them, draw without it.
 */
import type { Sway } from './camera';
import type { View } from './layout';

/** A 4×4 matrix, column-major. */
export type Mat4 = Float32Array;

const still: Sway = { dx: 0, dy: 0, roll: 0, tiltX: 0, tiltY: 0 };

function identity(): Mat4 {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

/** `a × b`. */
export function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col += 1)
    for (let row = 0; row < 4; row += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) sum += (a[k * 4 + row] ?? 0) * (b[col * 4 + k] ?? 0);
      out[col * 4 + row] = sum;
    }
  return out;
}

function translation(x: number, y: number, z: number): Mat4 {
  const m = identity();
  m[12] = x;
  m[13] = y;
  m[14] = z;
  return m;
}

function rotation(axis: 'x' | 'y' | 'z', angle: number): Mat4 {
  const m = identity();
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const [i, j] = axis === 'x' ? [1, 2] : axis === 'y' ? [2, 0] : [0, 1];
  m[i * 4 + i] = c;
  m[j * 4 + j] = c;
  m[i * 4 + j] = s;
  m[j * 4 + i] = -s;
  return m;
}

/**
 * The camera's projection. World units are CSS px, with y up and the origin at the vanishing point on the focus plane;
 * the camera sits `perspective` px in front of it, looking down −z, and its frustum is off-centre so that the
 * vanishing point lands where the CSS puts it.
 */
export function projectionMatrix(view: View, near = 1, far = 100_000): Mat4 {
  const k = near / view.perspective;
  const left = -view.vpX * k;
  const right = (view.width - view.vpX) * k;
  const top = view.vpY * k;
  const bottom = -(view.height - view.vpY) * k;
  const m = new Float32Array(16);
  m[0] = (2 * near) / (right - left);
  m[5] = (2 * near) / (top - bottom);
  m[8] = (right + left) / (right - left);
  m[9] = (top + bottom) / (top - bottom);
  m[10] = -(far + near) / (far - near);
  m[11] = -1;
  m[14] = (-2 * far * near) / (far - near);
  return m;
}

/** The camera's view matrix: `perspective` px in front of the focus plane, looking down −z. */
export function viewMatrix(view: View): Mat4 {
  return translation(0, 0, -view.perspective);
}

/** The swayed world matrix of the scene: the drift and the tilt of `cssTransform`, in WebGL axes. */
export function swayMatrix(sway: Sway): Mat4 {
  const rad = Math.PI / 180;
  // CSS has y down: in WebGL axes a CSS rotateX(θ) is a rotation of −θ around x, rotateY(θ) of θ around y, and a CSS
  // rotate(θ) of −θ around z.
  return [rotation('z', -sway.roll * rad), rotation('x', -sway.tiltX * rad), rotation('y', sway.tiltY * rad)].reduce(
    multiply,
    translation(sway.dx, -sway.dy, 0),
  );
}

/** Where WebGL draws a CSS point (`x`, `y` px from the vanishing point, `z` perspective units forward). */
export function projectThree(
  x: number,
  y: number,
  z: number,
  view: View,
  sway: Sway = still,
): { x: number; y: number } {
  const m = multiply(projectionMatrix(view), multiply(viewMatrix(view), swayMatrix(sway)));
  const p = [x, -y, z * view.perspective, 1];
  const at = (row: number): number => p.reduce((sum, v, col) => sum + (m[col * 4 + row] ?? 0) * v, 0);
  const w = at(3);
  return { x: ((at(0) / w + 1) / 2) * view.width, y: ((1 - at(1) / w) / 2) * view.height };
}

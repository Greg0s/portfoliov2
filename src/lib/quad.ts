/**
 * The CSS `matrix3d` that maps a w × h box (with `transform-origin: 0 0`) onto four corners in pixels: top-left,
 * top-right, bottom-right, bottom-left. This is how the screen and the pictures of the office sit in perspective over
 * the scene (from `docs/prototypes/perf/src/quad.js`).
 */
export type Point = readonly [number, number];
export type Quad = readonly [Point, Point, Point, Point];

/** The projective map of the unit square onto the quad, as [a, b, c, d, e, f, g, h] (x = (a·u + b·v + c) / w…). */
export function squareToQuad([[x0, y0], [x1, y1], [x2, y2], [x3, y3]]: Quad): number[] {
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const sx = x0 - x1 + x2 - x3;
  const sy = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / den;
  const h = (dx1 * sy - sx * dy1) / den;
  return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h];
}

export function quadMatrix(w: number, h: number, corners: Quad): string {
  const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0, g = 0, i = 0] = squareToQuad(corners);
  // Scale the unit square to the box first.
  const m = [a / w, d / w, 0, g / w, b / h, e / h, 0, i / h, 0, 0, 1, 0, c, f, 0, 1];
  return `matrix3d(${m.map((v) => Number(v.toFixed(8)).toString()).join(', ')})`;
}

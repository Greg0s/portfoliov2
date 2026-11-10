/**
 * The resolution the WebGL scenes draw at: the stars' pixel ratio, capped (2, and 1.5 on phones), and the live scenes'
 * (the planet, the office), which a lagging device lowers once before any fallback (main spec §6.4). Free of Three.js:
 * the journey asks for it from its first frame, long before the renderer's code has loaded.
 */

/** The device pixel ratio the renderer draws at: at most 2, and 1.5 on phones. */
export function cappedPixelRatio(devicePixelRatio: number, mobile: boolean): number {
  return Math.min(devicePixelRatio, mobile ? 1.5 : 2);
}

/**
 * The live scenes' resolution, as a share of their pixel ratio: lowered once when a scene lags, before any fallback
 * (main spec §6.4). Only a dense screen gives anything up: the ratio never goes under 1.
 */
const LOWER_RESOLUTION = 0.75;
const RESOLUTION_KEY = 'portfolio:resolution';
let resolution = ((): number => {
  try {
    return sessionStorage.getItem(RESOLUTION_KEY) === 'lower' ? LOWER_RESOLUTION : 1;
  } catch {
    return 1;
  }
})();

/** The pixel ratio a live scene (the planet, the office) draws at. */
export function scenePixelRatio(devicePixelRatio: number, mobile: boolean): number {
  const capped = cappedPixelRatio(devicePixelRatio, mobile);
  return Math.max(Math.min(1, capped), capped * resolution);
}

/**
 * Lowers the live scenes' resolution for the rest of the visit; says whether that changes anything on this screen
 * (false once lowered already, or when the ratio is already 1).
 */
export function lowerResolution(devicePixelRatio: number, mobile: boolean): boolean {
  if (resolution < 1) return false;
  const before = scenePixelRatio(devicePixelRatio, mobile);
  resolution = LOWER_RESOLUTION;
  try {
    sessionStorage.setItem(RESOLUTION_KEY, 'lower');
  } catch {
    // Without storage, it holds until the page is left.
  }
  return scenePixelRatio(devicePixelRatio, mobile) < before;
}

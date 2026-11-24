/**
 * The live planet, posed one part at a time, for its loops (`scripts/render-planet-loops.ts`): the site's own scene,
 * drawn on a transparent square of `size` px. `__bounds` finds where a part's motion reaches, `__crops` draws a pose
 * and reads the given rectangles, `__still` gives the whole square at rest.
 */
import { createPlanet, type PartTimes } from '../../src/scene/planet/planet';
import { LOOPS } from '../../src/scene/planet/wind';

type Part = keyof PartTimes;
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

declare global {
  interface Window {
    __ready?: boolean;
    __error?: string;
    __bounds?: (part: Part, samples: number) => Rect | null;
    __crops?: (times: PartTimes, rects: Rect[]) => string[];
    __still?: () => string;
  }
}

const size = Number(new URLSearchParams(location.search).get('size') ?? '900');
const REST: PartTimes = { scarf: 0, rose: 0, tail: 0, ears: 0 };
/** A channel changing by more than this, out of 255, is motion; less is the renderer's rounding. */
const MOVED = 2;

/** Whether the pixel at `i` differs between two drawings by more than the renderer's rounding. */
function moved(a: Uint8ClampedArray, b: Uint8ClampedArray, i: number): boolean {
  for (let c = 0; c < 4; c += 1) if (Math.abs((a[i + c] ?? 0) - (b[i + c] ?? 0)) > MOVED) return true;
  return false;
}

async function main(): Promise<void> {
  const host = document.createElement('div');
  host.style.cssText = `position: absolute; left: 0; top: 0; width: ${String(size)}px; height: ${String(size)}px`;
  document.body.append(host);
  const planet = await createPlanet(host, {
    modelUrl: '/models/petit-prince.glb',
    forced: true,
    mobile: false,
    size,
  });
  if (!planet.renderPose) throw new Error('The planet cannot be posed.');
  const { canvas } = planet;
  canvas.style.cssText = 'width: 100%; height: 100%';
  const copy = document.createElement('canvas');
  copy.width = canvas.width;
  copy.height = canvas.height;
  const context = copy.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('No 2D context.');
  // Drawn and read in the same task: the WebGL canvas keeps no drawing buffer after it.
  const draw = (times: PartTimes): void => {
    planet.renderPose?.(times);
    context.clearRect(0, 0, copy.width, copy.height);
    context.drawImage(canvas, 0, 0);
  };
  const toBase64 = (bytes: Uint8ClampedArray): string => {
    let text = '';
    for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(text);
  };

  window.__bounds = (part, samples) => {
    draw(REST);
    const rest = context.getImageData(0, 0, copy.width, copy.height).data;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let k = 1; k < samples; k += 1) {
      draw({ ...REST, [part]: (k * LOOPS[part]) / samples });
      const now = context.getImageData(0, 0, copy.width, copy.height).data;
      for (let i = 0; i < now.length; i += 4) {
        if (moved(now, rest, i)) {
          const p = i / 4;
          const x = p % copy.width;
          const y = Math.floor(p / copy.width);
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
      }
    }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  };
  window.__crops = (times, rects) => {
    draw(times);
    return rects.map((rect) => toBase64(context.getImageData(rect.x, rect.y, rect.w, rect.h).data));
  };
  window.__still = () => {
    draw(REST);
    return copy.toDataURL('image/png');
  };
  window.__ready = true;
}

main().catch((error: unknown) => {
  window.__error = String(error);
  window.__ready = true;
});

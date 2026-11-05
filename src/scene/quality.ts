/**
 * The quality decisions (implementation plan §2.8, main spec §6.4): the frame rate is measured on the visitor's
 * device, never guessed from its kind. Falling back is a last resort: a scene gives way only when its usual frame stays
 * slow for several windows in a row. Each window is judged on its median frame, so the hitches of a fast scroll, an
 * image decoded or a program linked in the background never count; a device whose browser caps the frame rate at 30
 * (a battery saver, a 30 Hz screen) keeps everything. The decisions hold for the visit (the tab's session).
 */

/** A live scene (the planet, the office) gives way when its median frame stays under this rate, in frames per second. */
export const SCENE_MIN_FPS = 28;
/** The journey gives way to the list when its median frame stays under this rate, in frames per second. */
export const JOURNEY_MIN_FPS = 20;
/** How much frame time a window measures, in ms. */
export const WINDOW_TIME = 1500;
/** How many slow windows in a row make a device slow. */
export const SLOW_WINDOWS = 3;
/** A frame this long or longer is a pause (a hidden tab, a stalled page), not the device's pace: it is left out. */
const PAUSE_MS = 1000;

export type Verdict = 'measuring' | 'lagging' | 'fast' | 'slow';

export interface FrameSampler {
  /**
   * Adds a frame of `delta` ms. At the end of each window: `fast` once a window keeps the rate, `lagging` for a slow
   * window, `slow` once `windows` slow windows came in a row; `measuring` in between.
   */
  add(delta: number): Verdict;
  /** The median rate of the last window measured, in frames per second (0 before the first). */
  readonly rate: number;
  /** Starts again from nothing: after a pause the page asked for, what came before no longer tells. */
  reset(): void;
}

/** The median of `values` (not empty). */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? (sorted[middle] ?? 0) : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/** Measures frames by windows of `window` ms, and says whether their median keeps `minFps`. */
export function frameSampler(minFps = SCENE_MIN_FPS, window = WINDOW_TIME, windows = SLOW_WINDOWS): FrameSampler {
  let frames: number[] = [];
  let elapsed = 0;
  let slow = 0;
  let rate = 0;
  return {
    add(delta) {
      if (!(delta > 0) || delta >= PAUSE_MS) return 'measuring';
      frames.push(delta);
      elapsed += delta;
      if (elapsed < window) return 'measuring';
      rate = 1000 / median(frames);
      frames = [];
      elapsed = 0;
      if (rate >= minFps) {
        slow = 0;
        return 'fast';
      }
      slow += 1;
      return slow >= windows ? 'slow' : 'lagging';
    },
    get rate() {
      return rate;
    },
    reset() {
      frames = [];
      elapsed = 0;
      slow = 0;
    },
  };
}

/** Whether a WebGL context draws in software (no GPU, or a blocked one): far too slow for a live scene. */
export function isSoftwareRenderer(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
  return /swiftshader|llvmpipe|softpipe|software/i.test(name);
}

const KEY = 'portfolio:slow';

/** Whether a scene was found too slow on this device during the visit. */
export function isSlow(scene: string): boolean {
  try {
    return (sessionStorage.getItem(KEY) ?? '').split(',').includes(scene);
  } catch {
    return false;
  }
}

/** Remembers that a scene is too slow on this device, for the rest of the visit. */
export function markSlow(scene: string): void {
  try {
    const scenes = new Set((sessionStorage.getItem(KEY) ?? '').split(',').filter(Boolean));
    scenes.add(scene);
    sessionStorage.setItem(KEY, [...scenes].join(','));
  } catch {
    // Without storage, the decision holds until the page is left.
  }
}

/** What `drawsInSoftware()` found, kept for the page's life: the device does not change. */
let software: boolean | null = null;

/**
 * Notes what draws a WebGL 2 context the page already made (the journey's stars): `drawsInSoftware()` then answers
 * from it, without making a context of its own, which takes long (seconds on a page drawn in software).
 */
export function noteContext(gl: WebGL2RenderingContext): void {
  software ??= isSoftwareRenderer(gl);
}

/** Whether this device draws WebGL 2 in software, or not at all: a live scene would hold the page. */
export function drawsInSoftware(): boolean {
  if (software !== null) return software;
  const probe = document.createElement('canvas').getContext('webgl2');
  if (!probe) return (software = true);
  software = isSoftwareRenderer(probe);
  probe.getExtension('WEBGL_lose_context')?.loseContext();
  return software;
}

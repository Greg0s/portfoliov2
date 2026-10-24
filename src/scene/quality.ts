/**
 * The quality decisions (implementation plan §2.8, main spec §6.4): the frame rate is measured on the visitor's
 * device, never guessed from its kind. A live scene that stays under 40 frames per second over its first seconds
 * gives way to its fallback: the planet freezes on its image. The decision holds for the visit (the tab's session).
 */

/** The rate under which a scene gives way, in frames per second, and how long it is measured, in ms. */
export const MIN_FPS = 40;
export const SAMPLE_TIME = 3000;

export interface FrameSampler {
  /** Adds a frame of `delta` ms; returns the verdict once enough time is measured. */
  add(delta: number): 'measuring' | 'fast' | 'slow';
}

/** Measures frames over `duration` ms and says whether they kept `minFps`. */
export function frameSampler(duration = SAMPLE_TIME, minFps = MIN_FPS): FrameSampler {
  let elapsed = 0;
  let frames = 0;
  return {
    add(delta) {
      elapsed += delta;
      frames += 1;
      if (elapsed < duration) return 'measuring';
      return (1000 * frames) / elapsed >= minFps ? 'fast' : 'slow';
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

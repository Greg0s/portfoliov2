/**
 * The environments' prefiltering, light enough for a modest GPU. three.js prefilters each level of roughness with a
 * GGX shader that loops over 256 samples: on Windows, Direct3D's compiler unrolls the loop, and that one shader held
 * the page for 0.6 to 1.1 s on a laptop's Intel chip (29 October 2026). The levels are blurred here with three's own
 * spiral Gaussian blur instead (20 samples a pass), as three did before its GGX filter: the reflections, faint and
 * rough in these scenes, look the same.
 */
import { PMREMGenerator, type WebGLRenderer, type WebGLRenderTarget } from 'three';

/** The prefiltering's levels of detail under the cube's own, as three lays them out. */
const LOD_MIN = 4;
/** The blur of the extra levels, at the smallest size, from the roughest down (three's former values). */
const EXTRA_LOD_SIGMA = [0.125, 0.215, 0.35, 0.446, 0.526, 0.582];

/** The parts of three's generator this one uses, which its types leave out. */
interface Internals {
  _renderer: WebGLRenderer;
  _lodMax: number;
  _sizeLods: number[];
  _blur(target: WebGLRenderTarget, lodIn: number, lodOut: number, sigma: number): void;
}

export class LightPMREMGenerator extends PMREMGenerator {
  /** Overrides three's GGX filtering: each level is the one above it, blurred by the difference of their blurs. */
  _applyPMREM(target: WebGLRenderTarget): void {
    const self = this as unknown as Internals;
    const renderer = self._renderer;
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    const sigmas = self._sizeLods.map((size, i) => {
      if (i === 0) return 0;
      if (i > self._lodMax - LOD_MIN) return EXTRA_LOD_SIGMA[i - self._lodMax + LOD_MIN - 1] ?? 0.582;
      return 1 / size;
    });
    for (let i = 1; i < sigmas.length; i += 1) {
      const sigma = Math.sqrt((sigmas[i] ?? 0) ** 2 - (sigmas[i - 1] ?? 0) ** 2);
      self._blur(target, i - 1, i, sigma);
    }
    renderer.autoClear = autoClear;
  }
}

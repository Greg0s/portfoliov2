/**
 * Preparing the live office (plan step 7), from the middle of the journey on, or at once on `#contact`: the town is
 * built in the town's worker while the rose comes from the planet's model, then the scene is assembled, its shaders
 * compiled without blocking the page, its textures and shadow maps uploaded by one draw, out of sight. Its layers, the
 * fallback and a phone's office, are prepared by `warmup-layers.ts`, which needs neither three.js nor this module.
 */
import { loadPlanetModel } from '../planet/load';
import { drawsInSoftware } from '../quality';
import type { Moment } from '../time';
import { runTown } from '../workers/client';
import { startStep } from './common';
import { FRAMES, framingOf } from './frame';
import { createLiveOffice, SlowOffice, type OfficeScene } from './live';
import type { OfficeView } from './view';
import { viewOffice } from './warmup-layers';

// Thrown when the device draws WebGL in software, or links its programs too slowly: the layers stand in.
export { SlowOffice };
// The framing a section's width calls for, which a kept scene must share.
export { framingOf };
// The layers, and the HTML laid over a scene, for a journey that loaded this module.
export { prepareLayers, prepareLayersScene, viewOffice } from './warmup-layers';

export interface OfficeOptions {
  modelUrl: string;
  moment: Moment;
  still: boolean;
  /** Prepare it even on a software renderer (`?office=live`). */
  forced: boolean;
  /** Stops the preparation (its layers played the arrival): it rejects with the signal's reason. */
  signal?: AbortSignal;
}

export async function prepareOffice(
  section: HTMLElement,
  host: HTMLElement,
  options: OfficeOptions,
): Promise<OfficeView> {
  return viewOffice(section, host, await prepareOfficeScene(section, options), options);
}

/**
 * The live scene alone, without the HTML laid over it: the costly part (the town, the programs linked, the textures on
 * the GPU), which the journey keeps from one visit of the home to the next (`src/scene/keep.ts`).
 */
export async function prepareOfficeScene(section: HTMLElement, options: OfficeOptions): Promise<OfficeScene> {
  if (!options.forced && drawsInSoftware()) throw new SlowOffice();
  const framing = framingOf(section.clientWidth);
  const [reply, model] = await Promise.all([runTown(), loadPlanetModel(options.modelUrl)]);
  startStep();
  const live = await createLiveOffice({
    moment: options.moment,
    framing,
    frame: FRAMES[framing],
    town: reply.town,
    rose: model.rose,
    size: { width: section.clientWidth, height: section.clientHeight },
    forced: options.forced,
    signal: options.signal,
  });
  if (options.signal?.aborted) {
    live.dispose();
    throw options.signal.reason;
  }
  return live;
}

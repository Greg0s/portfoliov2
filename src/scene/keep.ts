/**
 * The scenes kept from one visit of the home to the next, within the page's document (the client router swaps the
 * pages, the scripts stay): the WebGL renderer of the stars, the live planet, and the office's scene (live, or its
 * layers). A case study and back would otherwise prepare them all again, the slowest wait of a visit (main spec §6.4).
 * They are paused while kept: nothing draws them until the home takes them back.
 *
 * Each one is taken back once, and only if it still fits (the same framing, the same moment of the day); one that no
 * longer fits is let go. `dropKept` lets everything go, when the home comes back without its journey.
 */
import type { LivePlanet } from './planet/planet';
import type { OfficeScene } from './office/live';
import type { Framing } from './office/framings';
import type { Renderer } from './renderer';
import type { Moment } from './time';

export interface KeptOffice {
  scene: OfficeScene;
  framing: Framing;
  moment: Moment;
  /** The live scene, or its layers. */
  kind: 'live' | 'layers';
}

/** Notes what is kept and taken back, for the measurement run (`?mesure=visite`). */
const note = (what: string): void => {
  performance.mark(`keep:${what}`);
};

let renderer: Renderer | null = null;
let planet: LivePlanet | null = null;
let office: KeptOffice | null = null;

export function keepRenderer(kept: Renderer): void {
  renderer?.dispose();
  kept.canvas.remove();
  renderer = kept;
  note('renderer');
}

export function takeRenderer(): Renderer | null {
  const taken = renderer;
  renderer = null;
  if (!taken) return null;
  // Its context lost while it was kept, and not back: a new one is made.
  if (taken.lost) {
    note('lost-renderer');
    taken.dispose();
    return null;
  }
  note('take-renderer');
  return taken;
}

export function keepPlanet(kept: LivePlanet): void {
  if (planet !== kept) planet?.dispose();
  kept.canvas.remove();
  planet = kept;
  note('planet');
}

export function takePlanet(): LivePlanet | null {
  const taken = planet;
  planet = null;
  if (!taken) return null;
  // Its context lost while it was kept: it is put together again.
  if (taken.isLost()) {
    note('lost-planet');
    taken.dispose();
    return null;
  }
  note('take-planet');
  return taken;
}

export function keepOffice(kept: KeptOffice): void {
  if (office?.scene !== kept.scene) office?.scene.dispose();
  kept.scene.element.remove();
  office = kept;
  note(`office-${kept.kind}`);
}

/** The office's scene kept, if it fits `framing`, `moment` and `kind`; one that does not is let go. */
export function takeOffice(framing: Framing, moment: Moment, kind: KeptOffice['kind']): OfficeScene | null {
  const taken = office;
  office = null;
  if (!taken) return null;
  // Its context lost while it was kept: it is prepared again.
  if (taken.scene.isLost()) {
    note('lost-office');
    taken.scene.dispose();
    return null;
  }
  if (taken.framing === framing && taken.moment === moment && taken.kind === kind) {
    note('take-office');
    return taken.scene;
  }
  note(`misfit-office-${taken.kind}-for-${kind}`);
  taken.scene.dispose();
  return null;
}

/** Whether anything is kept (for the tests). */
export function hasKept(): { renderer: boolean; planet: boolean; office: KeptOffice['kind'] | null } {
  return { renderer: renderer !== null, planet: planet !== null, office: office?.kind ?? null };
}

export function dropKept(): void {
  if (renderer || planet || office) note('drop');
  renderer?.dispose();
  planet?.dispose();
  office?.scene.dispose();
  renderer = planet = null;
  office = null;
}

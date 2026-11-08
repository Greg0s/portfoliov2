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

let renderer: Renderer | null = null;
let planet: LivePlanet | null = null;
let office: KeptOffice | null = null;

export function keepRenderer(kept: Renderer): void {
  renderer?.dispose();
  kept.canvas.remove();
  renderer = kept;
}

export function takeRenderer(): Renderer | null {
  const taken = renderer;
  renderer = null;
  return taken;
}

export function keepPlanet(kept: LivePlanet): void {
  if (planet !== kept) planet?.dispose();
  kept.canvas.remove();
  planet = kept;
}

export function takePlanet(): LivePlanet | null {
  const taken = planet;
  planet = null;
  return taken;
}

export function keepOffice(kept: KeptOffice): void {
  if (office?.scene !== kept.scene) office?.scene.dispose();
  kept.scene.element.remove();
  office = kept;
}

/** The office's scene kept, if it fits `framing`, `moment` and `kind`; one that does not is let go. */
export function takeOffice(framing: Framing, moment: Moment, kind: KeptOffice['kind']): OfficeScene | null {
  const taken = office;
  office = null;
  if (!taken) return null;
  if (taken.framing === framing && taken.moment === moment && taken.kind === kind) return taken.scene;
  taken.scene.dispose();
  return null;
}

/** Whether anything is kept (for the tests). */
export function hasKept(): { renderer: boolean; planet: boolean; office: KeptOffice['kind'] | null } {
  return { renderer: renderer !== null, planet: planet !== null, office: office?.kind ?? null };
}

export function dropKept(): void {
  renderer?.dispose();
  planet?.dispose();
  office?.scene.dispose();
  renderer = planet = null;
  office = null;
}

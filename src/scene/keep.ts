/**
 * The scenes kept from one visit of the home to the next, within the page's document (the client router swaps the
 * pages, the scripts stay): the WebGL renderer of the stars (with their field, whose program the new field shares),
 * the ring's sky in WebGL (its two canvases and their linked programs), the live planet, and the office's scene (live,
 * or its layers). A case study and back would otherwise prepare them all again, the slowest wait of a visit (main spec §6.4).
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
import type { SkyPainter } from './showcase/sky';
import type { StarField } from './stars/stars';

/** A canvas of the ring's sky and its WebGL painter. */
export interface KeptSkyCanvas {
  canvas: HTMLCanvasElement;
  painter: SkyPainter;
}

/** The ring's sky: its near canvas, and its far one (under the planet) if the ring had a planet. */
export interface KeptSky {
  near: KeptSkyCanvas;
  far: KeptSkyCanvas | null;
}

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
let stars: StarField | null = null;
let sky: KeptSky | null = null;
let planet: LivePlanet | null = null;
let office: KeptOffice | null = null;

/**
 * Keeps the renderer, with its stars' field still in its scene: the field of the next visit is made before this one is
 * let go (`takeStars()`), so that it finds their program already linked, rather than link it again on its first frame.
 */
export function keepRenderer(kept: Renderer, field: StarField | null = null): void {
  stars?.dispose();
  renderer?.dispose();
  kept.canvas.remove();
  renderer = kept;
  stars = field;
  note('renderer');
}

/** The former visit's stars' field, to let go once the new one has been drawn (null if none). */
export function takeStars(): StarField | null {
  const taken = stars;
  stars = null;
  return taken;
}

export function takeRenderer(): Renderer | null {
  const taken = renderer;
  renderer = null;
  if (!taken) {
    stars?.dispose();
    stars = null;
    return null;
  }
  // Its context lost while it was kept, and not back: a new one is made.
  if (taken.lost) {
    note('lost-renderer');
    stars?.dispose();
    stars = null;
    taken.dispose();
    return null;
  }
  note('take-renderer');
  return taken;
}

const disposeSky = (kept: KeptSky): void => {
  kept.near.painter.dispose();
  kept.far?.painter.dispose();
};

/** Keeps the ring's sky drawn in WebGL: the next ring takes its canvases and painters back, linked already. */
export function keepSky(kept: KeptSky): void {
  if (sky && sky !== kept) disposeSky(sky);
  kept.near.canvas.remove();
  kept.far?.canvas.remove();
  kept.near.painter.whenLost(null);
  kept.far?.painter.whenLost(null);
  sky = kept;
  note('sky');
}

/** The ring's sky kept, if any and still whole; one whose context was lost meanwhile is let go. */
export function takeSky(): KeptSky | null {
  const taken = sky;
  sky = null;
  if (!taken) return null;
  if (taken.near.painter.lost || taken.far?.painter.lost) {
    note('lost-sky');
    disposeSky(taken);
    return null;
  }
  note('take-sky');
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
export function hasKept(): {
  renderer: boolean;
  sky: boolean;
  planet: boolean;
  office: KeptOffice['kind'] | null;
} {
  return { renderer: renderer !== null, sky: sky !== null, planet: planet !== null, office: office?.kind ?? null };
}

export function dropKept(): void {
  if (renderer || sky || planet || office) note('drop');
  stars?.dispose();
  renderer?.dispose();
  if (sky) disposeSky(sky);
  planet?.dispose();
  office?.scene.dispose();
  renderer = planet = null;
  stars = null;
  sky = null;
  office = null;
}

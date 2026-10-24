/**
 * The journey, as the rest of the site sees it: the navigation asks it to land on an anchor in the dark (header,
 * menu, a case study's Contact link), rather than scrolling to the anchor's element.
 */

export interface JourneyHandle {
  /** Whether `id` is one of the journey's fragments (the opening, the projects, a project, the contact). */
  has(id: string): boolean;
  /** Whether the camera is already on the anchor of `id`. */
  isAt(id: string): boolean;
  /** Lands at once on the anchor of `id`. */
  jumpTo(id: string): void;
  /** Glides to the anchor at `index` (0 is the opening, the last one the contact), as a key press would. */
  glideTo(index: number): void;
}

let active: JourneyHandle | null = null;

export function setJourney(handle: JourneyHandle | null): void {
  active = handle;
}

/** The journey playing on this page, if any. */
export function currentJourney(): JourneyHandle | null {
  return active;
}

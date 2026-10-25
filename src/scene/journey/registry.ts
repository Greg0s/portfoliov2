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
  /**
   * The dive (journey spec §6): the card of project `id` flies onto the case study's opening media, full width and
   * flush with the top, while the rest fades out. Resolves once it is there, where it stays; null if `id` is no project.
   */
  dive(id: string): Promise<void> | null;
  /** The way back: drawn at once on the opening media, the card flies back to its place while the rest fades in. */
  undive(id: string): Promise<void> | null;
}

let active: JourneyHandle | null = null;

export function setJourney(handle: JourneyHandle | null): void {
  active = handle;
}

/** The journey playing on this page, if any. */
export function currentJourney(): JourneyHandle | null {
  return active;
}

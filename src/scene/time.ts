/**
 * The visitor's moment (main spec §5.3): dawn before noon, dusk from noon on, in the visitor's local time. The
 * `?heure=aube|crepuscule` URL parameter forces one, for tests and screenshots.
 */

export const moments = ['aube', 'crepuscule'] as const;
export type Moment = (typeof moments)[number];

/** The moment at a given local time. */
export function momentAt(date: Date): Moment {
  return date.getHours() < 12 ? 'aube' : 'crepuscule';
}

/** The moment forced by the URL, if any. */
export function momentFromSearch(search: string): Moment | undefined {
  const value = new URLSearchParams(search).get('heure');
  return moments.find((moment) => moment === value);
}

/** The moment a page shows: the URL's, or else the clock's. */
export function currentMoment(date: Date, search: string): Moment {
  return momentFromSearch(search) ?? momentAt(date);
}

/** Milliseconds until the moment changes next (noon or midnight). */
export function msUntilNextChange(date: Date): number {
  const next = new Date(date);
  next.setHours(date.getHours() < 12 ? 12 : 24, 0, 0, 0);
  return next.getTime() - date.getTime();
}

/**
 * Calls `listener` with the new moment each time it changes during the visit. Returns a function that stops
 * listening. A moment forced by the URL never changes.
 */
export function onMomentChange(listener: (moment: Moment) => void, search = location.search): () => void {
  if (momentFromSearch(search)) return () => undefined;
  let timer: ReturnType<typeof setTimeout>;
  const schedule = (): void => {
    // A few seconds past the hour, so that a slightly early timer does not miss the change.
    timer = setTimeout(
      () => {
        listener(momentAt(new Date()));
        schedule();
      },
      msUntilNextChange(new Date()) + 1000,
    );
  };
  schedule();
  return () => {
    clearTimeout(timer);
  };
}

/**
 * Sets `data-moment` on the root element. Self-contained: Base.astro inlines its source in the page head so that the
 * tint is right on the first paint, before any module loads.
 */
export function applyMoment(): void {
  const forced = new URLSearchParams(location.search).get('heure');
  const moment =
    forced === 'aube' || forced === 'crepuscule' ? forced : new Date().getHours() < 12 ? 'aube' : 'crepuscule';
  document.documentElement.dataset.moment = moment;
}

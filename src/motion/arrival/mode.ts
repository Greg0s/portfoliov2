/**
 * The arrival proposals (to be chosen by Grégoire): how the home's opening appears on a visitor's arrival. Each one
 * is tried with `?arrivee=1` to `?arrivee=6`; without it, the opening stays as it is.
 *
 * 1. The words that stay: "Bonjour", then the welcome, then the job, land one after the other and keep floating.
 * 2. The words that fly away: the same words land, stay a moment and fly off in the wind, then the card shows.
 * 3. The words from the planet: spoken from the Little Prince, they come to the visitor, then pass by the camera.
 * 4. The cartel: the night museum's spotlight turns on over the planet, then its cartel introduces the author.
 * 5. The approach: from the point of light B 612, the camera flies to the planet, then the card shows.
 * 6. The line: a pen of light draws the planet's outline, which comes to life, then writes "Bonjour".
 *
 * `applyArrivalMode` is self-contained: the opening inlines its source before its content, so that the first paint
 * already hides what the arrival will show.
 */
export function applyArrivalMode(): void {
  const root = document.documentElement;
  const asked = new URLSearchParams(location.search).get('arrivee') ?? '';
  if (root.dataset.journey === 'on' && ['1', '2', '3', '4', '5', '6'].includes(asked)) root.dataset.arrival = asked;
  else delete root.dataset.arrival;
}

export type ArrivalVariant = '1' | '2' | '3' | '4' | '5' | '6';

/** The proposal shown on this page, if any. */
export function arrivalVariant(): ArrivalVariant | null {
  const value = document.documentElement.dataset.arrival;
  return value === '1' || value === '2' || value === '3' || value === '4' || value === '5' || value === '6'
    ? value
    : null;
}

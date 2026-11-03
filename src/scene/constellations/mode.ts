/**
 * The constellation proposals (Grégoire, 2 November 2026): on desktop, the projects no longer pass one by one but
 * share one sky, as two constellations (personal and professional projects). Each proposal is shown with
 * `?constellations=1` to `5`; without it, the journey stays as it is. Phones keep the journey project by project.
 */

/** How many proposals there are. */
export const SKY_VARIANTS = 5;

/** The proposal asked for in the URL, or null. */
export function skyVariant(search: string): number | null {
  const asked = Number(new URLSearchParams(search).get('constellations'));
  return Number.isInteger(asked) && asked >= 1 && asked <= SKY_VARIANTS ? asked : null;
}

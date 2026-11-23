/**
 * Render proposals for the office, to compare before choosing (`?rendu=1`, `?rendu=2`…): nothing changes without the
 * parameter. Each proposal adds to the one before.
 */

/** The proposal asked for in the URL, 0 for none. */
export function renderProposal(search = typeof location === 'undefined' ? '' : location.search): number {
  const value = Number(new URLSearchParams(search).get('rendu'));
  return Number.isInteger(value) && value > 0 ? value : 0;
}

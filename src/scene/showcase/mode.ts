/**
 * Which showcase proposal plays (see `designs.ts`): `?projets=1` to `5`, kept for the rest of the visit in this tab
 * (so that it is still there back from a case study); `?projets=0` goes back to the journey project by project. Only
 * on desktop: phones keep the journey project by project.
 */
import { designs } from './designs';

const KEY = 'portfolio:projets';

/** The proposal asked for, or null. */
export function showcaseVariant(search: string): number | null {
  const asked = new URLSearchParams(search).get('projets');
  try {
    if (asked !== null) {
      const id = Number(asked);
      if (designs.some((design) => design.id === id)) sessionStorage.setItem(KEY, String(id));
      else sessionStorage.removeItem(KEY);
    }
    const kept = Number(sessionStorage.getItem(KEY));
    return designs.some((design) => design.id === kept) ? kept : null;
  } catch {
    const id = Number(asked);
    return designs.some((design) => design.id === id) ? id : null;
  }
}

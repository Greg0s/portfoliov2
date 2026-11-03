/**
 * The header says, discreetly, which part of the home the visitor is in: the opening (the name), the projects or the
 * contact (main spec §4). The section is read from the journey when it plays (the anchor nearest the scroll),
 * otherwise from the sections' place on screen (the list, "reduce motion", no WebGL). The header carries
 * `data-section`, and the header's and the menu's links to it `aria-current="location"`; on a computer, the current
 * link glows softly and the others dim (Header.astro). A phone shows nothing.
 */
import { fragments } from '../i18n/routes';
import { currentJourney } from '../scene/journey/registry';

export type Section = 'opening' | 'projects' | 'contact';

const openingIds = new Set<string>(Object.values(fragments.opening));
const contactIds = new Set<string>(Object.values(fragments.contact));
const projectsIds = new Set<string>(Object.values(fragments.projects));

/** The section of a journey fragment: the opening, the contact for the office, the projects otherwise. */
export function sectionOf(fragment: string | null): Section | null {
  if (!fragment) return null;
  if (openingIds.has(fragment)) return 'opening';
  if (contactIds.has(fragment)) return 'contact';
  return 'projects';
}

const firstElement = (ids: Set<string>): HTMLElement | undefined =>
  [...ids].map((id) => document.getElementById(id)).find((element) => element !== null) ?? undefined;

/** Where the visitor is: from the journey when it plays, otherwise from the sections on screen. */
function locate(): Section | null {
  const journey = currentJourney();
  if (journey) return sectionOf(journey.here());
  // The list: a section counts once its top passes the upper 40 % of the screen.
  const line = window.innerHeight * 0.4;
  const contact = firstElement(contactIds);
  if (contact && contact.getBoundingClientRect().top <= line) return 'contact';
  const projects = firstElement(projectsIds);
  if (projects && projects.getBoundingClientRect().top <= line) return 'projects';
  return firstElement(openingIds) ? 'opening' : null;
}

function apply(section: Section | null): void {
  const header = document.querySelector<HTMLElement>('[data-site-header]');
  if (!header || (header.dataset.section ?? null) === section) return;
  if (section) header.dataset.section = section;
  else delete header.dataset.section;
  for (const link of document.querySelectorAll<HTMLElement>('[data-section-link]')) {
    if (link.dataset.sectionLink === section) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
}

// The section is read in the event (the scroll, a timer), where the layout is still clean, and written in the next
// frame, which reads nothing: a frame of the journey must never force a layout (tests/e2e/journey.spec.ts).
let frame = 0;
let pending: Section | null = null;
function schedule(): void {
  pending = locate();
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    apply(pending);
  });
}

export function initSection(): void {
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('hashchange', schedule);
  document.addEventListener('astro:page-load', () => {
    schedule();
    // The journey starts a moment after the page: read again once it plays.
    setTimeout(schedule, 300);
    setTimeout(schedule, 1200);
  });
  schedule();
}

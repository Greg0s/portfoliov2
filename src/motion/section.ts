/**
 * The header says, discreetly, which part of the home the visitor is in: the opening (the name), the projects or the
 * contact. The section is read from the journey when it plays (the anchor nearest the scroll), otherwise from the
 * sections' place on screen (the list, "reduce motion", no WebGL). The header and the menu mark their link with
 * `aria-current="location"`, and the header carries `data-section` and, through the projects, the project's number.
 *
 * Proposals (header thread, 2 November 2026): `?entete=1` to `?entete=6` pick how the header shows it.
 */
import { fragments } from '../i18n/routes';
import { currentJourney } from '../scene/journey/registry';

export type Section = 'opening' | 'projects' | 'contact';

const VARIANTS = ['1', '2', '3', '4', '5', '6'];
const DEFAULT_VARIANT = '6';

/** The variant asked for in the address, kept for the rest of the visit. */
let variant = DEFAULT_VARIANT;

function readVariant(): void {
  const asked = new URLSearchParams(location.search).get('entete');
  if (asked && VARIANTS.includes(asked)) variant = asked;
}

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

interface Place {
  section: Section | null;
  /** The project shown, from 1, and how many there are; 0 when not on a project. */
  index: number;
  total: number;
}

function projectPlace(fragment: string | null, projects: HTMLElement[]): number {
  if (!fragment) return 0;
  if (projectsIds.has(fragment)) return projects.length > 0 ? 1 : 0;
  return projects.findIndex((item) => item.id === fragment) + 1;
}

/** Where the visitor is: from the journey when it plays, otherwise from the sections on screen. */
function locate(): Place {
  const projects = [...document.querySelectorAll<HTMLElement>('[data-project]')];
  const total = projects.length;
  const journey = currentJourney();
  if (journey) {
    const here = journey.here();
    const section = sectionOf(here);
    return { section, index: section === 'projects' ? projectPlace(here, projects) : 0, total };
  }
  // The list: a section counts once its top passes the upper 40 % of the screen.
  const line = window.innerHeight * 0.4;
  const contact = [...contactIds].map((id) => document.getElementById(id)).find(Boolean);
  if (contact && contact.getBoundingClientRect().top <= line) return { section: 'contact', index: 0, total };
  const list = [...projectsIds].map((id) => document.getElementById(id)).find(Boolean);
  if (list && list.getBoundingClientRect().top <= line) {
    let index = 1;
    projects.forEach((item, i) => {
      if (item.getBoundingClientRect().top <= line) index = i + 1;
    });
    return { section: 'projects', index, total };
  }
  const opening = [...openingIds].some((id) => document.getElementById(id));
  return { section: opening ? 'opening' : null, index: 0, total };
}

const pad = (n: number): string => String(n).padStart(2, '0');

let last = '';

function apply(): void {
  const header = document.querySelector<HTMLElement>('[data-site-header]');
  if (!header) return;
  header.dataset.indicator = variant;
  const { section, index, total } = locate();
  const key = `${variant}|${section ?? ''}|${String(index)}|${String(total)}`;
  if (key === last && header.dataset.sectionReady === 'true') return;
  last = key;
  header.dataset.sectionReady = 'true';
  if (section) header.dataset.section = section;
  else delete header.dataset.section;
  header.style.setProperty('--project-count', `"${index > 0 ? `${pad(index)} / ${pad(total)}` : ''}"`);
  for (const link of document.querySelectorAll<HTMLElement>('[data-section-link]')) {
    if (link.dataset.sectionLink === section) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
  // The sliding mark (variant 4) follows the current link's place and width.
  const current = header.querySelector<HTMLElement>(`.links [data-section-link="${section ?? ''}"]`);
  const links = header.querySelector<HTMLElement>('.links');
  if (current && links) {
    const box = current.getBoundingClientRect();
    const from = links.getBoundingClientRect();
    header.style.setProperty('--mark-x', `${String(box.left - from.left)}px`);
    header.style.setProperty('--mark-width', `${String(box.width)}px`);
  }
}

let frame = 0;
function schedule(): void {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    apply();
  });
}

export function initSection(): void {
  readVariant();
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('hashchange', schedule);
  document.addEventListener('astro:page-load', () => {
    last = '';
    schedule();
    // The journey starts a moment after the page: read again once it plays.
    setTimeout(schedule, 300);
    setTimeout(schedule, 1200);
  });
  schedule();
}

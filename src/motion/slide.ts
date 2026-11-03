/**
 * The case studies side by side (main spec §5.4, decided on 2 November 2026). Going from one case study to another, by
 * the next project's link, a swipe (swipe.ts) or the browser's history, the page slides sideways and the other one
 * comes in from beside it: the next one from the right, the previous one from the left, the shorter way round the
 * ring. The header stays, its number changing in place, and the page that comes in shows at once, without its opening
 * rise. A swipe hands its offset over, so that the page goes on from where the finger left it, quicker and easing out.
 * With "reduce motion", the router's fade (base.css).
 */
import { moveDots } from './dots';
import { prefersReducedMotion } from './reducedMotion';
import { sideOf, type Side } from '../lib/ring';

/** From rest, by the link or the history: the dive's ease, a little longer than a dive for a whole screen's width. */
const FROM_REST = { duration: '760ms', ease: 'cubic-bezier(0.65, 0, 0.35, 1)' };
/** Going on from a finger already moving the page: easing out, as a fling does. */
const FROM_SWIPE = { duration: '520ms', ease: 'cubic-bezier(0.22, 1, 0.36, 1)' };
const PROPERTIES = ['--slide-old-to', '--slide-new-from', '--slide-duration', '--slide-ease'];

interface Slide {
  side: Side;
  /** How far a swipe moved the page already, in pixels: negative to the left. */
  offset: number;
  /** The case study left, in the ring's order: its dot hands over to the one that comes in. */
  from: number;
  /** How far the swipe carried the dots' light toward the case study that comes in, from 0 to 1 (dots.ts). */
  dots: number;
}

let ready = false;
/** A swipe's offset and dots, for the navigation it starts. */
let handed: { offset: number; dots: number } | null = null;
/** The slide of the navigation under way, from its preparation to its swap. */
let slide: Slide | null = null;
let sliding = false;

/** The swipe's offset and how far it carried the dots' light, for the navigation it is about to start. */
export function handOver(offset: number, dots = 0): void {
  handed = { offset, dots };
}

/** Whether a slide is playing: a swipe waits for it. */
export function isSliding(): boolean {
  return sliding;
}

/** The case studies' pages in the ring's order, as the case study page lists them; empty on any other page. */
function ring(): string[] {
  const raw = document.querySelector<HTMLElement>('[data-ring]')?.dataset.ring;
  if (!raw) return [];
  try {
    const paths: unknown = JSON.parse(raw);
    return Array.isArray(paths) ? paths.filter((path): path is string => typeof path === 'string') : [];
  } catch {
    return [];
  }
}

/** Whether `path` is one of the case studies this case study sits beside: false on any other page. */
export function inRing(path: string): boolean {
  return ring().includes(path);
}

/** Sets the slide on the root element, where the view transition's pseudo-elements read it (base.css). */
function apply({ side, offset }: Slide): void {
  const html = document.documentElement;
  const width = html.clientWidth;
  const sign = side === 'next' ? -1 : 1;
  const { duration, ease } = offset === 0 ? FROM_REST : FROM_SWIPE;
  html.dataset.slide = side;
  // The page leaves by the screen's width, less what the finger moved it already; the other comes in right beside it.
  html.style.setProperty('--slide-old-to', `${String(sign * width - offset)}px`);
  html.style.setProperty('--slide-new-from', `${String(-sign * width + offset)}px`);
  html.style.setProperty('--slide-duration', duration);
  html.style.setProperty('--slide-ease', ease);
}

function clear(): void {
  const html = document.documentElement;
  delete html.dataset.slide;
  for (const property of PROPERTIES) html.style.removeProperty(property);
}

export function initSlide(): void {
  if (ready) return;
  ready = true;

  document.addEventListener('astro:before-preparation', (event) => {
    const { offset, dots } = handed ?? { offset: 0, dots: 0 };
    handed = null;
    const paths = ring();
    const side = sideOf(paths, event.from.pathname, event.to.pathname);
    slide = side && !prefersReducedMotion() ? { side, offset, from: paths.indexOf(event.from.pathname), dots } : null;
    // Set before the old page is captured: its cover leaves with it, its header stays (CaseStudy.astro).
    if (slide) apply(slide);
    else clear();
  });

  document.addEventListener('astro:before-swap', (event) => {
    if (!slide) return;
    sliding = true;
    const done = (): void => {
      sliding = false;
      clear();
    };
    event.viewTransition.finished.then(done, done);
  });

  document.addEventListener('astro:after-swap', () => {
    if (!slide) return;
    // The router has just given the root element the new page's attributes: the slide is set again, before the new
    // page is captured, and the page shows in place, without its opening rise.
    apply(slide);
    document.documentElement.dataset.slid = '';
    moveDots(
      slide.from,
      Number.parseFloat(slide.offset === 0 ? FROM_REST.duration : FROM_SWIPE.duration),
      slide.offset === 0 ? 0 : slide.dots,
    );
    slide = null;
  });
}

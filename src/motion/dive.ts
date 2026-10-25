/**
 * The dive into a case study (journey spec §6, main spec §7.4): a click on the sharp card, or on the next project at the
 * end of a case study, flies its picture in 0.9 s straight onto the place of the case study's opening media, full width
 * and flush with the top, keeping its format, while the rest fades out in 0.3 s; then the client router shows the case
 * study around it, a named view transition handing the picture over to the opening media. In the journey, the card
 * itself flies, out of its 3D turn (see `journey.ts`). "Back to projects" and the browser's Back button play it the
 * other way: the home comes back with only the picture, on the opening media's place, the journey lands on the same
 * project, and the card flies back into its place while the rest fades in. With "reduce motion", the router's fade
 * replaces it (main spec §5.6). The home's URL carries the project's fragment before leaving, so that coming back, by
 * either way, finds the journey on the same project.
 */
import { navigate } from 'astro:transitions/client';
import { prefersReducedMotion } from './reducedMotion';
import { currentJourney } from '../scene/journey/registry';

const DIVE_MS = 900;
const FADE_MS = 300;
const EASE = 'cubic-bezier(0.65, 0, 0.35, 1)';
/** How long the way back waits for the journey to rest on the project before giving up on the shrink. */
const WAIT_MS = 4000;

let ready = false;
let diving = false;
/** The project whose case study the visitor is leaving for the home. */
let returning: string | null = null;

function isPlainClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

const frame = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
  radius: string;
}

/** Where a case study's opening media sits when it opens: full width, flush with the top, in 16:9 like the cards. */
const openingMedia = (): Box => {
  const width = document.documentElement.clientWidth;
  return { left: 0, top: 0, width, height: (width * 9) / 16, radius: '0px' };
};
const boxOf = (element: Element): Box => {
  const rect = element.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    radius: getComputedStyle(element).borderRadius || '0px',
  };
};
const keyframe = (box: Box): Keyframe => ({
  left: `${String(box.left)}px`,
  top: `${String(box.top)}px`,
  width: `${String(box.width)}px`,
  height: `${String(box.height)}px`,
  borderRadius: box.radius,
});

/** The picture, alone over a dark backdrop, fixed at `box`. */
function overlay(
  image: HTMLImageElement,
  box: Box,
): { root: HTMLElement; backdrop: HTMLElement; picture: HTMLElement } {
  const root = document.createElement('div');
  root.className = 'dive';
  root.setAttribute('aria-hidden', 'true');
  const backdrop = document.createElement('div');
  backdrop.className = 'dive-backdrop';
  const picture = document.createElement('div');
  picture.className = 'dive-picture';
  Object.assign(picture.style, keyframe(box));
  const copy = document.createElement('img');
  copy.alt = '';
  copy.src = image.currentSrc || image.src;
  copy.style.objectPosition = image.style.objectPosition;
  picture.append(copy);
  root.append(backdrop, picture);
  document.body.append(root);
  return { root, backdrop, picture };
}

/** The site's header, which fades with the rest of the home. */
const siteHeader = (): HTMLElement | null => document.querySelector<HTMLElement>('body > .header');

/**
 * Flies `image` onto the opening media's place, then opens `href`; from the home, `slug` is the project whose
 * fragment the home keeps, and whose card the journey flies.
 */
async function dive(href: string, image: HTMLImageElement, slug: string | null, target: string): Promise<void> {
  if (diving) return;
  diving = true;
  try {
    if (slug) history.replaceState(history.state, '', `#${slug}`);
    const flight = slug ? currentJourney()?.dive(slug) : null;
    if (flight) {
      siteHeader()?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: 'linear', fill: 'both' });
      await flight;
      // The card is on the opening media's place: a flat copy takes over from it, for the router.
      const { backdrop, picture } = overlay(image, openingMedia());
      backdrop.style.opacity = '0';
      picture.style.viewTransitionName = `cover-${target}`;
    } else {
      const from = boxOf(image.parentElement ?? image);
      const { backdrop, picture } = overlay(image, from);
      backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: 'linear', fill: 'both' });
      await picture.animate([keyframe(from), keyframe(openingMedia())], {
        duration: DIVE_MS,
        easing: EASE,
        fill: 'forwards',
      }).finished;
      // The router's view transition hands the picture over to the case study's opening media.
      picture.style.viewTransitionName = `cover-${target}`;
    }
    await navigate(href);
  } finally {
    diving = false;
  }
}

/**
 * The way back: the home shows only the picture, on the opening media's place, until the journey rests on the
 * project; then its card takes over and flies back into place. In the list, the picture itself flies into the card.
 */
async function shrink(slug: string): Promise<void> {
  const item = document.getElementById(slug);
  const image = item?.querySelector<HTMLImageElement>('.card img');
  if (!item || !image) return;
  const { root, backdrop, picture } = overlay(image, openingMedia());
  // The router's view transition hands the case study's opening media over to it.
  picture.style.viewTransitionName = `cover-${slug}`;
  const header = siteHeader();
  header?.style.setProperty('opacity', '0');
  const fadeHeaderIn = (): void => {
    header?.style.removeProperty('opacity');
    header?.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: FADE_MS,
      delay: DIVE_MS - FADE_MS,
      easing: 'linear',
      fill: 'backwards',
    });
  };
  const start = performance.now();
  // The journey starts once the home has loaded, then lands on the project's fragment; the list only needs a frame.
  for (;;) {
    await frame();
    if (!root.isConnected) return;
    const journey = currentJourney();
    if (journey?.isAt(slug)) {
      await frame();
      picture.style.viewTransitionName = '';
      const back = journey.undive(slug);
      if (back) {
        root.remove();
        fadeHeaderIn();
        await back;
        return;
      }
      break;
    }
    if (document.documentElement.dataset.journey !== 'on' || performance.now() - start > WAIT_MS) break;
  }
  await frame();
  picture.style.viewTransitionName = '';
  fadeHeaderIn();
  backdrop.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: FADE_MS,
    delay: DIVE_MS - FADE_MS,
    easing: 'linear',
    fill: 'both',
  });
  await picture.animate([keyframe(openingMedia()), keyframe(boxOf(image.parentElement ?? image))], {
    duration: DIVE_MS,
    easing: EASE,
    fill: 'forwards',
  }).finished;
  root.remove();
}

export function initDive(): void {
  if (ready) return;
  ready = true;
  // On the root element, which the router keeps: after the journey's own handling (a blurred card comes into focus
  // first), before the router's.
  document.documentElement.addEventListener('click', (event) => {
    if (event.defaultPrevented || !isPlainClick(event) || prefersReducedMotion()) return;
    const target = event.target instanceof Element ? event.target : null;
    const link = target?.closest<HTMLAnchorElement>('a.card, a[data-dive]');
    const image = link?.querySelector<HTMLImageElement>('img');
    const slug = link?.dataset.slug;
    if (!link || !image || !slug) return;
    event.preventDefault();
    const fromHome = link.classList.contains('card');
    void dive(link.href, image, fromHome ? (link.closest('[data-project]')?.id ?? null) : null, slug);
  });

  // A view transition the browser skips (the viewport changed meanwhile, as a phone's address bar does) is no error:
  // the page has changed, without the animation. The router leaves that rejection unhandled.
  window.addEventListener('unhandledrejection', (event) => {
    const reason: unknown = event.reason;
    if (reason instanceof DOMException && reason.message.startsWith('Transition was')) event.preventDefault();
  });

  // Leaving a case study for the home: the picture comes back over it.
  document.addEventListener('astro:before-preparation', () => {
    returning = document.querySelector<HTMLElement>('[data-case-slug]')?.dataset.caseSlug ?? null;
  });
  document.addEventListener('astro:after-swap', () => {
    const slug = returning;
    returning = null;
    if (!slug || prefersReducedMotion() || !document.getElementById(slug)?.matches('[data-project]')) return;
    void shrink(slug);
  });
}

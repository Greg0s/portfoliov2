/**
 * Swiping from one case study to the next on a touch screen (main spec §5.4, decided on 2 November 2026). A finger
 * moving sideways takes the page with it, the neighbour's name coming in from the edge, as if the case studies lay side
 * by side; let go far enough, or quickly enough, the page goes on sliding there (slide.ts), round the ring, else it
 * springs back. A finger moving up or down scrolls, as ever. On the first two case studies a visitor opens on a touch
 * screen, until a first swipe, the page leans once toward the next one, showing its name: the hint that it is there.
 */
import { prefetch } from 'astro:prefetch';
import { navigate } from 'astro:transitions/client';
import { prefersReducedMotion } from './reducedMotion';
import { handOver, isSliding } from './slide';
import type { Side } from '../lib/ring';

/** How far a finger moves before the gesture is read as sideways or not. */
const SLOP = 10;
/** Let go beyond this share of the screen's width, the swipe leads to the neighbour. */
const COMMIT = 0.25;
/** Or quicker than this, in pixels per millisecond, once past `FLICK_MIN`. */
const FLICK = 0.4;
const FLICK_MIN = 32;
const SPRING_MS = 360;
const SPRING_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
/** How long the swipe waits for the neighbour's cover, so that its page slides in with it. */
const COVER_WAIT_MS = 250;
/** The hint: how far the page leans, how long it takes, when it starts, and on how many case studies. */
const NUDGE_PX = 56;
const NUDGE_MS = 1400;
const NUDGE_DELAY_MS = 1600;
const NUDGES = 2;
const STORE = { nudges: 'portfolio:swipe-hints', swiped: 'portfolio:swiped' };

interface Gesture {
  id: number;
  x: number;
  y: number;
  dragging: boolean;
  /** The finger's recent positions, for its speed when it lets go. */
  samples: { x: number; t: number }[];
}

let ready = false;
let gesture: Gesture | null = null;
let offset = 0;
let leaving = false;
let nudgeTimer = 0;

const onCaseStudy = (): boolean => document.querySelector('[data-case-slug]') !== null;
const touchScreen = (): boolean => matchMedia('(pointer: coarse)').matches;

/** What moves with the finger: the page and its footer; the header stays. */
function moving(): HTMLElement[] {
  return [document.querySelector<HTMLElement>('main'), document.querySelector<HTMLElement>('.case-footer')].filter(
    (element): element is HTMLElement => element !== null,
  );
}

function peek(side: Side): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-peek="${side}"]`);
}

const width = (): number => document.documentElement.clientWidth;

/** Puts the page `x` pixels sideways, and the neighbour it reveals beside it. */
function place(x: number): void {
  offset = x;
  const transform = x === 0 ? '' : `translateX(${String(x)}px)`;
  for (const element of moving()) element.style.transform = transform;
  for (const side of ['previous', 'next'] as const) {
    const element = peek(side);
    if (!element) continue;
    const revealed = side === 'next' ? -x : x;
    element.style.transform = transform;
    element.style.opacity = String(Math.min(1, Math.max(0, revealed / (width() * COMMIT))));
    element.toggleAttribute('data-armed', revealed >= width() * COMMIT);
  }
}

/** Brings the page back into place. */
function springBack(): void {
  const from = offset;
  place(0);
  if (from === 0) return;
  const frames = [{ transform: `translateX(${String(from)}px)` }, { transform: 'none' }];
  for (const element of moving()) element.animate(frames, { duration: SPRING_MS, easing: SPRING_EASE });
  for (const side of ['previous', 'next'] as const) {
    const element = peek(side);
    const revealed = side === 'next' ? -from : from;
    if (!element || revealed <= 0) continue;
    element.animate(
      [
        { transform: `translateX(${String(from)}px)`, opacity: Math.min(1, revealed / (width() * COMMIT)) },
        { transform: 'none', opacity: 0 },
      ],
      { duration: SPRING_MS, easing: SPRING_EASE },
    );
  }
}

function remember(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Without storage, the hint may come again: no harm.
  }
}

function recall(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Starts loading the neighbour's page and cover, so that it slides in whole. Resolves once the cover is ready. */
function warm(side: Side): Promise<void> {
  const element = peek(side);
  const href = element?.dataset.href;
  if (!element || !href) return Promise.resolve();
  prefetch(href, { ignoreSlowConnection: true });
  const image = new Image();
  image.sizes = '100vw';
  image.srcset = element.dataset.srcset ?? '';
  image.src = element.dataset.src ?? '';
  return image.decode().catch(() => undefined);
}

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** Leaves for the neighbour on `side`, the page going on from where the finger left it. */
async function leave(side: Side): Promise<void> {
  const href = peek(side)?.dataset.href;
  if (!href || leaving) {
    springBack();
    return;
  }
  leaving = true;
  remember(STORE.swiped, '1');
  try {
    await Promise.race([warm(side), wait(COVER_WAIT_MS)]);
    handOver(prefersReducedMotion() ? 0 : offset);
    await navigate(href);
    // Still here (the navigation was dropped): the page comes back into place.
    if (moving().some((element) => element.style.transform)) springBack();
  } finally {
    leaving = false;
  }
}

/** The finger's speed over its last moves, in pixels per millisecond. */
function speed(samples: Gesture['samples']): number {
  const last = samples.at(-1);
  const first = samples.find(({ t }) => last && last.t - t <= 100);
  if (!last || !first || last.t === first.t) return 0;
  return (last.x - first.x) / (last.t - first.t);
}

function release(event: PointerEvent): void {
  const current = gesture;
  gesture = null;
  if (!current?.dragging) return;
  const dx = event.clientX - current.x;
  const velocity = speed(current.samples);
  const far = Math.abs(dx) >= width() * COMMIT;
  const flung = Math.abs(dx) >= FLICK_MIN && Math.abs(velocity) >= FLICK && Math.sign(velocity) === Math.sign(dx);
  if (far || flung) void leave(dx < 0 ? 'next' : 'previous');
  else springBack();
}

/** The hint: once the page has settled, it leans toward the next case study and comes back. */
function nudge(): void {
  window.clearTimeout(nudgeTimer);
  if (!onCaseStudy() || !touchScreen() || prefersReducedMotion() || recall(STORE.swiped)) return;
  const shown = Number(recall(STORE.nudges) ?? '0');
  if (shown >= NUDGES) return;
  nudgeTimer = window.setTimeout(() => {
    if (gesture || leaving || offset !== 0 || !onCaseStudy()) return;
    remember(STORE.nudges, String(shown + 1));
    const lean = `translateX(${String(-NUDGE_PX)}px)`;
    const options = { duration: NUDGE_MS, easing: 'cubic-bezier(0.45, 0, 0.55, 1)' };
    const frames = [
      { transform: 'none' },
      { transform: lean, offset: 0.4 },
      { transform: lean, offset: 0.55 },
      { transform: 'none' },
    ];
    for (const element of moving()) element.animate(frames, options);
    peek('next')?.animate(
      [
        { transform: 'none', opacity: 0 },
        { transform: lean, opacity: 1, offset: 0.4 },
        { transform: lean, opacity: 1, offset: 0.55 },
        { transform: 'none', opacity: 0 },
      ],
      options,
    );
  }, NUDGE_DELAY_MS);
}

/** Stops the hint, should a finger come first. */
function stopNudge(): void {
  window.clearTimeout(nudgeTimer);
  for (const element of [...moving(), peek('next')]) {
    for (const animation of element?.getAnimations() ?? []) animation.cancel();
  }
}

export function initSwipe(): void {
  if (ready) return;
  ready = true;

  document.addEventListener(
    'pointerdown',
    (event) => {
      if (event.pointerType !== 'touch' || !event.isPrimary || isSliding() || leaving || !onCaseStudy()) return;
      stopNudge();
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false, samples: [] };
    },
    { passive: true },
  );

  document.addEventListener(
    'pointermove',
    (event) => {
      if (gesture?.id !== event.pointerId) return;
      const dx = event.clientX - gesture.x;
      const dy = event.clientY - gesture.y;
      if (!gesture.dragging) {
        if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
        // Up or down: the browser scrolls, the gesture is not a swipe.
        if (Math.abs(dx) <= Math.abs(dy)) {
          gesture = null;
          return;
        }
        gesture.dragging = true;
        // Both ways: the finger may still turn back.
        void warm('next');
        void warm('previous');
      }
      gesture.samples.push({ x: event.clientX, t: event.timeStamp });
      if (gesture.samples.length > 12) gesture.samples.shift();
      if (!prefersReducedMotion()) place(Math.max(-width(), Math.min(width(), dx)));
    },
    { passive: true },
  );

  document.addEventListener('pointerup', release, { passive: true });
  document.addEventListener(
    'pointercancel',
    () => {
      // The browser took the finger over (a scroll, a pinch): the page goes back into place.
      if (gesture?.dragging) springBack();
      gesture = null;
    },
    { passive: true },
  );

  document.addEventListener('astro:page-load', () => {
    gesture = null;
    offset = 0;
    nudge();
  });
}

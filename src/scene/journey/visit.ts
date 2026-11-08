/**
 * The full-visit measurement run (`?mesure=visite`): on a real device, a first visit plays itself from the opening to
 * the office's screen, through a case study and back, as a hurried visitor would, and lists every wait a visitor could
 * see on the way. Where `?mesure=rapide` stops at the contact, this run crosses the client router's page changes: it
 * lives as long as the document, not as long as the home.
 *
 * The visit: a glance at the opening, the ring turned card by card, the dive into the project in front, two "Next
 * project", the way back to the ring, two more cards, the contact, then each page of the office's screen. Every
 * program is linked as if the browser had never seen it (`src/scene/renderer.ts`).
 *
 * What it reports, from the page's start: the frame times of each step and the worst frames with what held them; the
 * loading pauses; each page change (how long it took, whether the case study's cover was decoded when it showed);
 * when the live planet and the live office were ready, after the first load and after the way back; what played each
 * arrival at the office (live, layers or still image); whether each screen capture was ready when its page opened.
 */
import { anchors } from './anchors';
import { currentJourney } from './registry';
import { gpu, panel, slowScenes, summarize, type LongFrame } from './measure';

const HITCH_MS = 100;
const MAX_HITCHES = 25;

const round = (x: number): number => Math.round(x);
const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** A page change: from the click to the new page's load, and whether its picture was there when it showed. */
interface PageChange {
  step: string;
  to: string;
  atMs: number;
  ms: number;
  coverReady: boolean | null;
}

/** A screen page: whether its capture was decoded when Firefox opened it, or how long it took after. */
interface ScreenPage {
  page: string;
  readyMs: number | null;
}

let running = false;

/** Starts the run, once per document. */
export function startVisit(): void {
  if (running) return;
  running = true;
  void run();
}

async function run(): Promise<void> {
  const out = panel();
  // The panel lives in the body, which each page change replaces: it follows.
  document.addEventListener('astro:after-swap', () => {
    out.reattach();
  });

  let step = 'attente';
  const frames = new Map<string, number[]>();
  const hitches: { step: string; start: number; ms: number }[] = [];
  const longFrames: LongFrame[] = [];
  const changes: PageChange[] = [];
  const screen: ScreenPage[] = [];
  let loads = 0;
  document.addEventListener('astro:page-load', () => {
    loads += 1;
  });

  if (PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')) {
    new PerformanceObserver((list) => {
      longFrames.push(...(list.getEntries() as LongFrame[]).filter((entry) => entry.duration >= HITCH_MS - 20));
    }).observe({ type: 'long-animation-frame' });
  }

  let last = 0;
  const tick = (now: number): void => {
    if (last) {
      frames.get(step)?.push(now - last);
      if (now - last >= HITCH_MS) hitches.push({ step, start: last, ms: now - last });
    }
    last = now;
    requestAnimationFrame(tick);
  };
  const enter = (name: string): void => {
    step = name;
    if (!frames.has(name)) frames.set(name, []);
    out.show(`mesure de la visite : ${name}…`);
  };
  const until = async (test: () => boolean, timeout = 30_000): Promise<boolean> => {
    const start = performance.now();
    while (!test()) {
      if (performance.now() - start > timeout) return false;
      await wait(50);
    }
    return true;
  };
  const root = (): HTMLElement | null => document.querySelector<HTMLElement>('[data-journey-root]');
  const anchorIs = (index: number): boolean => root()?.dataset.anchor === String(index);

  /** Clicks `link`, waits for the next page, and notes how long it took and whether its cover was there. */
  const change = async (link: HTMLElement | null, name: string): Promise<boolean> => {
    if (!link) return false;
    const before = loads;
    const start = performance.now();
    link.click();
    if (!(await until(() => loads > before))) return false;
    const cover = document.querySelector<HTMLImageElement>('[data-case-slug] .cover img');
    changes.push({
      step: name,
      to: location.pathname,
      atMs: round(start),
      ms: round(performance.now() - start),
      coverReady: cover ? cover.complete && cover.naturalWidth > 0 : null,
    });
    return true;
  };

  /** The journey's ring, turned `cards` times, a short glance at each card. */
  const turnRing = async (cards: number): Promise<void> => {
    const journey = currentJourney();
    if (!journey) return;
    for (let card = 0; card < cards; card += 1) {
      journey.turn(1);
      await until(() => journey.turned());
      await wait(150);
    }
  };

  // ---- The visit.
  out.show('mesure de la visite : début…');
  if (!(await until(() => currentJourney() !== null))) {
    out.show('mesure de la visite : pas de parcours sur cette page.');
    return;
  }
  requestAnimationFrame(tick);
  enter('ouverture');
  await wait(1000);
  currentJourney()?.glideTo(1);
  await until(() => anchorIs(1));

  enter('anneau');
  const projects = document.querySelectorAll('[data-project]').length;
  await turnRing(projects - 1);

  enter('plongée');
  await change(document.querySelector<HTMLElement>('[data-project].lit a.card'), 'plongée');
  await wait(1500);
  scrollBy({ top: innerHeight, behavior: 'smooth' });
  await wait(1500);

  for (const name of ['suivant 1', 'suivant 2']) {
    enter(name);
    await change(document.querySelector<HTMLElement>('nav.next a'), name);
    await wait(2000);
  }

  enter('retour');
  const back = performance.now();
  await change(document.querySelector<HTMLElement>('.case-header a.back'), 'retour');
  await until(() => currentJourney() !== null && anchorIs(1));
  await wait(1000);
  await turnRing(2);

  enter('contact');
  const journey = currentJourney();
  journey?.glideTo(anchors.length - 1);
  await until(() => anchorIs(anchors.length - 1));
  // The arrival plays for a few seconds.
  await wait(6000);
  const arrival = document.documentElement.dataset.officeArrival ?? '';

  enter('écran');
  const mobile = matchMedia('(pointer: coarse)').matches;
  const element = document.querySelector<HTMLElement>('.office-screen .desktop');
  if (mobile && element) {
    // A tap opens a page, the next one closes it.
    for (let page = 0; page < 4; page += 1) {
      element.click();
      screen.push(await captureReady(`tap ${String(page + 1)}`));
      await wait(1500);
      element.click();
      await wait(600);
    }
  } else {
    for (const link of document.querySelectorAll<HTMLElement>('[data-screen-page]')) {
      const name = link.dataset.screenPage ?? '';
      if (name === 'Email') continue;
      link.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
      screen.push(await captureReady(name));
      await wait(1500);
      link.dispatchEvent(new PointerEvent('pointerout', { bubbles: true }));
      await wait(800);
    }
  }
  step = 'fin';

  // ---- The report.
  const marks = (name: string): number[] => performance.getEntriesByName(name, 'mark').map((e) => round(e.startTime));
  const explain = (start: number, ms: number): string | null => {
    const entry = longFrames.find((e) => e.startTime < start + ms && e.startTime + e.duration > start + ms / 2);
    if (!entry) return null;
    const scripts = [...entry.scripts]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 2)
      .map((s) => `${String(round(s.duration))} ${s.sourceFunctionName || '?'}@${s.sourceURL.split('/').pop() ?? ''}`);
    return [`block ${String(round(entry.blockingDuration))}`, ...scripts].join(' | ');
  };
  const result = {
    date: new Date().toISOString(),
    userAgent: navigator.userAgent,
    screen: `${String(innerWidth)} × ${String(innerHeight)} @${String(devicePixelRatio)}`,
    ...gpu(),
    steps: Object.fromEntries([...frames].map(([name, times]) => [name, summarize(times)])),
    // The waits a visitor could see.
    holds: performance
      .getEntriesByType('measure')
      .filter((entry) => entry.name.startsWith('journey:hold-'))
      .map((entry) => ({ reason: entry.name.slice(13), atMs: round(entry.startTime), ms: round(entry.duration) })),
    pages: changes,
    planetReadyMs: marks('journey:planet-ready'),
    officeReadyMs: marks('journey:office-ready'),
    backAtMs: round(back),
    arrival,
    arrivalsMs: marks('journey:arrival'),
    screenPages: screen,
    slow: slowScenes(),
    hitches: [...hitches]
      .sort((a, b) => b.ms - a.ms)
      .slice(0, MAX_HITCHES)
      .sort((a, b) => a.start - b.start)
      .map(({ step: name, start, ms }) => ({ step: name, atMs: round(start), ms: round(ms), why: explain(start, ms) })),
  };
  const text = JSON.stringify(result, null, 2);
  console.info('mesure de la visite', result);
  out.show(text);
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.textContent = 'Copier';
  Object.assign(copy.style, { display: 'block', marginTop: '8px', font: 'inherit', padding: '4px 10px' });
  copy.addEventListener('click', () => {
    void navigator.clipboard.writeText(text).then(() => {
      copy.textContent = 'Copié';
    });
  });
  out.append(copy);
}

/** Whether the screen page just opened shows its capture: at once (0), after how long, or not within 3 s (null). */
async function captureReady(page: string): Promise<ScreenPage> {
  const start = performance.now();
  await wait(0);
  const image = (): HTMLImageElement | null =>
    document.querySelector<HTMLImageElement>(
      '.office-screen .desktop[data-open] .page[data-active] img:not([data-src])',
    );
  while (performance.now() - start < 3000) {
    const shown = image();
    if (shown?.complete && shown.naturalWidth > 0) {
      const ms = round(performance.now() - start);
      return { page, readyMs: ms < 20 ? 0 : ms };
    }
    await wait(20);
  }
  return { page, readyMs: null };
}

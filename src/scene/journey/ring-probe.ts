/**
 * The ring's probe (`?mesure=anneau`): on a real device, the ring turns card by card again and again, each time with
 * one part of the page hidden, to tell which part costs the frames there. Built for Firefox on phones, where the
 * ring draws at about 23 frames a second when Chrome reaches 60 on the same phone, and the profilers of a computer
 * don't reproduce it.
 *
 * For each pass: the frame times, and the time the page's own frame callbacks took (the scripts), so that what is
 * left of a frame is the browser's own work (style, layout, painting and compositing).
 */
import { currentJourney } from './registry';
import { gpu, panel, summarize } from './measure';

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
const round = (x: number, digits = 1): number => Number(x.toFixed(digits));

/**
 * Each pass: its name, the parts whose drawing stops (`data-probe`, read by the journey) and the styles that hide
 * them, or hide one part of the page, while the ring turns. The last but one pass doesn't turn: the ring at rest.
 */
const NOTHING =
  '.showcase-sky, [data-journey-root] .project, .cartel, .showcase-ui, .planet-canvas { display: none !important; }';
const PASSES: readonly (readonly [string, string, string])[] = [
  ['tout', '', ''],
  ['sans ciel (ni dessin)', 'ciel', '.showcase-sky { display: none !important; }'],
  ['sans étoiles (ni dessin)', 'etoiles', ''],
  ['sans planète 3D (ni dessin)', 'planete', '.planet-canvas { display: none !important; }'],
  ['sans cartes (retirées)', '', '[data-journey-root] .project { display: none !important; }'],
  [
    'cartes sans ombre ni flou',
    '',
    '[data-journey-root] .card { box-shadow: none !important; filter: none !important; }',
  ],
  ['sans aucun dessin', 'ciel etoiles planete', '.showcase-sky, .planet-canvas { display: none !important; }'],
  ['sans rien', 'ciel etoiles planete', NOTHING],
  ['à l’arrêt', '', ''],
  ['tout de nouveau', '', ''],
];

let running = false;

/** Starts the probe, once per document. */
export function startRingProbe(): void {
  if (running) return;
  running = true;
  void run();
}

async function run(): Promise<void> {
  const out = panel();
  const until = async (test: () => boolean, timeout = 30_000): Promise<boolean> => {
    const start = performance.now();
    while (!test()) {
      if (performance.now() - start > timeout) return false;
      await wait(50);
    }
    return true;
  };
  out.show('mesure de l’anneau : début…');
  if (!(await until(() => currentJourney() !== null))) {
    out.show('mesure de l’anneau : pas de parcours sur cette page.');
    return;
  }

  // The page's frame callbacks, timed: every one asked for from now on.
  let scripts = 0;
  const native = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (callback) =>
    native((time) => {
      const start = performance.now();
      try {
        callback(time);
      } finally {
        scripts += performance.now() - start;
      }
    });

  let frames: number[] | null = null;
  let scriptTimes: number[] = [];
  let last = 0;
  let scriptsBefore = 0;
  const tick = (now: number): void => {
    if (frames && last) {
      frames.push(now - last);
      scriptTimes.push(scripts - scriptsBefore);
    }
    scriptsBefore = scripts;
    last = now;
    native(tick);
  };
  native(tick);

  const root = (): HTMLElement | null => document.querySelector<HTMLElement>('[data-journey-root]');
  currentJourney()?.glideTo(1);
  await until(() => root()?.dataset.anchor === '1');
  await wait(1500);

  const style = document.createElement('style');
  document.head.append(style);
  const projects = document.querySelectorAll('[data-project]').length;
  const passes: Record<string, unknown> = {};
  const html = document.documentElement;
  for (const [name, parts, css] of PASSES) {
    out.show(`mesure de l’anneau : ${name}…`);
    style.textContent = css;
    if (parts) html.dataset.probe = parts;
    else delete html.dataset.probe;
    await wait(600);
    const journey = currentJourney();
    if (!journey) break;
    frames = [];
    scriptTimes = [];
    if (name === 'à l’arrêt') await wait(4000);
    else
      for (let card = 0; card < projects; card += 1) {
        journey.turn(1);
        await until(() => journey.turned());
        await wait(150);
      }
    const sorted = [...scriptTimes].sort((a, b) => a - b);
    const total = scriptTimes.reduce((sum, time) => sum + time, 0);
    const { frames: count, fps, medianMs, p95Ms, slowPct } = summarize(frames);
    passes[name] = {
      frames: count,
      fps,
      medianMs,
      p95Ms,
      slowPct,
      scriptMedianMs: round(sorted[Math.floor(sorted.length / 2)] ?? 0),
      scriptMeanMs: round(count > 0 ? total / count : 0),
    };
    frames = null;
  }
  style.remove();
  delete html.dataset.probe;

  const result = {
    date: new Date().toISOString(),
    userAgent: navigator.userAgent,
    screen: `${String(innerWidth)} × ${String(innerHeight)} @${String(devicePixelRatio)}`,
    ...gpu(),
    passes,
  };
  console.info('mesure de l’anneau', result);
  out.report(JSON.stringify(result, null, 2));
}

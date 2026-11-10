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
 * Each pass: its name, the parts whose drawing stops (`data-probe`, read by the journey and the ring: `ciel`,
 * `etoiles`, `planete`, `perspective` for the cards' own perspective on Firefox, `cartes` for the cards held still),
 * the styles that hide one part of the page while the ring turns, and the ratio the sky is drawn at (0: as usual).
 * The last but one pass doesn't turn: the ring at rest.
 *
 * The run of 10 November 2026 on Grégoire's phone (Firefox, Mali-T760) said: the sky's canvas costs the most (41 fps
 * without it, 27 with), then the cards' shadows and blurs (40 fps without), the live planet (32) and the stars (29);
 * with nothing drawn, 56 to 60. These passes split those two costs further.
 */
const PASSES: readonly (readonly [string, string, string, number])[] = [
  ['tout', '', '', 0],
  ['ciel à ×1,5', '', '', 1.5],
  ['ciel à ×1', '', '', 1],
  ['sans ciel (ni dessin)', 'ciel', '.showcase-sky { display: none !important; }', 0],
  ['cartes sans ombre', '', '[data-journey-root] .card { box-shadow: none !important; }', 0],
  ['cartes sans flou', '', '[data-journey-root] .card { filter: none !important; }', 0],
  ['cartes sans perspective propre', 'perspective', '', 0],
  ['cartes figées', 'cartes', '', 0],
  ['sans cartes (retirées)', '', '[data-journey-root] .project { display: none !important; }', 0],
  ['à l’arrêt', '', '', 0],
  ['tout de nouveau', '', '', 0],
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
  for (const [name, parts, css, ratio] of PASSES) {
    out.show(`mesure de l’anneau : ${name}…`);
    style.textContent = css;
    if (parts) html.dataset.probe = parts;
    else delete html.dataset.probe;
    if (ratio > 0) html.dataset.probeRatio = String(ratio);
    else delete html.dataset.probeRatio;
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
  delete html.dataset.probeRatio;

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

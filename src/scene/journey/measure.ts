/**
 * The measurement run (`?mesure=1`, implementation plan §3): on a real device, the journey plays itself from the
 * opening to the contact and records its frame times with the phases of the step 1 bench
 * (`docs/prototypes/perf/src/meter.js`): the opening, the projects, the end, and a rest on a project. The result
 * shows on the page as text to copy into the bench. Headless Chromium never proves a frame rate: only devices count.
 * Each frame over 100 ms is listed too, with what the browser says held it where it can (Chromium's long animation
 * frames: the scripts that ran, the style and layout, the rendering), and the office's state at the end: whether the
 * live scene stayed, or gave way to its layers.
 */
import { anchors } from './anchors';
import { currentJourney } from './registry';

type Phase = 'ouverture' | 'projets' | 'fin' | 'repos';

interface Summary {
  frames: number;
  seconds: number;
  fps: number;
  medianMs: number;
  p95Ms: number;
  p99Ms: number;
  worstMs: number;
  /** Frames that missed the 60 Hz deadline by more than half a frame. */
  slowPct: number;
}

/** A long animation frame, as Chromium reports it (not yet in TypeScript's DOM types). */
interface LongFrame extends PerformanceEntry {
  blockingDuration: number;
  renderStart: number;
  styleAndLayoutStart: number;
  scripts: {
    duration: number;
    invoker: string;
    sourceFunctionName: string;
    sourceURL: string;
    sourceCharPosition: number;
    forcedStyleAndLayoutDuration: number;
  }[];
}

/** A frame over 100 ms: in which phase, how far into it, and what held it. */
interface Hitch {
  phase: Phase;
  atMs: number;
  ms: number;
  /** What the browser says: blocking time, then the rendering, the style and layout, and the longest scripts. */
  why: string | null;
}

const HITCH_MS = 100;
const MAX_HITCHES = 20;

/** The scenes found too slow during the visit (`src/scene/quality.ts`). */
function slowScenes(): string {
  try {
    return sessionStorage.getItem('portfolio:slow') ?? '';
  } catch {
    return '';
  }
}

const round = (x: number, digits = 0): number => Math.round(x * 10 ** digits) / 10 ** digits;

/** The summary of a phase's frame times, as the bench writes it. */
export function summarize(times: readonly number[]): Summary {
  const sorted = [...times].sort((a, b) => a - b);
  const total = times.reduce((sum, time) => sum + time, 0);
  const pick = (q: number): number => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
  return {
    frames: times.length,
    seconds: round(total / 1000, 1),
    fps: total > 0 ? round((1000 * times.length) / total, 1) : 0,
    medianMs: round(pick(0.5), 1),
    p95Ms: round(pick(0.95), 1),
    p99Ms: round(pick(0.99), 1),
    worstMs: round(sorted.at(-1) ?? 0, 1),
    slowPct: times.length > 0 ? round((100 * times.filter((time) => time > 25).length) / times.length, 1) : 0,
  };
}

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** The display's refresh rate: the median of a second of frames. */
function refreshRate(): Promise<number> {
  return new Promise((resolve) => {
    const times: number[] = [];
    let last = 0;
    const start = performance.now();
    const step = (now: number): void => {
      if (last) times.push(now - last);
      last = now;
      if (now - start < 1000) requestAnimationFrame(step);
      else resolve(round(1000 / (summarize(times).medianMs || 16.7)));
    };
    requestAnimationFrame(step);
  });
}

/** The GPU's name, when the browser tells it. */
function gpu(): string {
  const gl = document.createElement('canvas').getContext('webgl');
  const info = gl?.getExtension('WEBGL_debug_renderer_info');
  return gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'unknown';
}

function panel(): { show(text: string): void; append(node: Node): void; remove(): void } {
  const box = document.createElement('div');
  box.setAttribute('role', 'status');
  Object.assign(box.style, {
    position: 'fixed',
    zIndex: '1000',
    left: '12px',
    bottom: '12px',
    maxWidth: 'calc(100vw - 24px)',
    maxHeight: '70vh',
    overflow: 'auto',
    padding: '10px 12px',
    font: '12px/1.4 ui-monospace, monospace',
    color: '#f3f3f1',
    background: 'rgb(0 0 0 / 80%)',
    borderRadius: '6px',
    whiteSpace: 'pre-wrap',
  });
  document.body.append(box);
  return {
    show: (text) => {
      box.textContent = text;
    },
    append: (node) => {
      box.append(node);
    },
    remove: () => {
      box.remove();
    },
  };
}

/** Plays the journey and records it; returns a function that stops the run. */
export function startMeasure(root: HTMLElement): () => void {
  let stopped = false;
  let phase: Phase | null = null;
  const phases = new Map<Phase, number[]>();
  let last = 0;
  let frame = 0;
  /** When each phase began (its first entry, for the projects that come back after the rest). */
  const phaseStarts = new Map<Phase, number>();
  const hitches: { phase: Phase; start: number; ms: number }[] = [];
  const longFrames: LongFrame[] = [];
  const out = panel();

  let observer: PerformanceObserver | null = null;
  if (PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')) {
    observer = new PerformanceObserver((list) => {
      longFrames.push(...(list.getEntries() as LongFrame[]).filter((entry) => entry.duration >= HITCH_MS - 20));
    });
    observer.observe({ type: 'long-animation-frame' });
  }

  const tick = (now: number): void => {
    if (phase && last) {
      phases.get(phase)?.push(now - last);
      if (now - last >= HITCH_MS) hitches.push({ phase, start: last, ms: now - last });
    }
    last = now;
    frame = requestAnimationFrame(tick);
  };

  /** What held a hitch, from the long animation frame that ends with it. */
  const explain = (start: number, ms: number): string | null => {
    const entry = longFrames.find((e) => e.startTime < start + ms && e.startTime + e.duration > start + ms / 2);
    if (!entry) return null;
    const finish = entry.startTime + entry.duration;
    const scripts = [...entry.scripts]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 3)
      .map((script) => {
        const file = script.sourceURL.split('/').pop() ?? '';
        const where = `${script.sourceFunctionName || '?'}@${file}:${String(script.sourceCharPosition)}`;
        const forced =
          script.forcedStyleAndLayoutDuration >= 1
            ? ` +${String(round(script.forcedStyleAndLayoutDuration))} layout`
            : '';
        return `${String(round(script.duration))} ${script.invoker.slice(0, 40)} ${where}${forced}`;
      });
    return [
      `block ${String(round(entry.blockingDuration))}`,
      `render ${String(round(entry.renderStart ? finish - entry.renderStart : 0))}`,
      `style ${String(round(entry.styleAndLayoutStart ? finish - entry.styleAndLayoutStart : 0))}`,
      ...scripts,
    ].join(' | ');
  };

  const anchorIs = (index: number): boolean => root.dataset.anchor === String(index);
  const until = async (test: () => boolean, timeout = 20_000): Promise<void> => {
    const start = performance.now();
    while (!test() && !stopped && performance.now() - start < timeout) await wait(50);
  };
  const enter = (name: Phase): void => {
    phase = name;
    if (!phases.has(name)) phases.set(name, []);
    last = 0;
    if (!phaseStarts.has(name)) phaseStarts.set(name, performance.now());
    out.show(`mesure : ${name}…`);
  };

  const run = async (): Promise<void> => {
    out.show('mesure : fréquence de l’écran…');
    const refresh = await refreshRate();
    const journey = currentJourney();
    if (!journey) {
      out.show('mesure : pas de parcours sur cette page.');
      return;
    }
    journey.glideTo(0);
    await until(() => anchorIs(0));
    // Let the page load what it loads late (Three.js, the stars) before the first phase.
    await wait(2500);
    frame = requestAnimationFrame(tick);
    const contact = anchors.length - 1;
    for (let index = 1; index <= contact && !stopped; index += 1) {
      enter(index === 1 ? 'ouverture' : index === contact ? 'fin' : 'projets');
      journey.glideTo(index);
      await until(() => anchorIs(index));
      if (index === 4) {
        // A rest on a project: the cards float, the stars twinkle.
        enter('repos');
        await wait(3000);
      }
    }
    phase = null;
    cancelAnimationFrame(frame);
    observer?.disconnect();
    if (stopped) return;
    const result = {
      date: new Date().toISOString(),
      page: location.href,
      userAgent: navigator.userAgent,
      screen: `${String(innerWidth)} × ${String(innerHeight)} @${String(devicePixelRatio)}`,
      refreshHz: refresh,
      gpu: gpu(),
      phases: Object.fromEntries([...phases].map(([name, times]) => [name, summarize(times)])),
      office: document.documentElement.dataset.office ?? '',
      slow: slowScenes(),
      // The worst ones, in the order they came.
      hitches: [...hitches]
        .sort((a, b) => b.ms - a.ms)
        .slice(0, MAX_HITCHES)
        .sort((a, b) => a.start - b.start)
        .map(({ phase: name, start, ms }): Hitch => {
          const begun = phaseStarts.get(name) ?? start;
          return { phase: name, atMs: round(start - begun), ms: round(ms), why: explain(start, ms) };
        }),
    };
    const text = JSON.stringify(result, null, 2);
    console.info('mesure', result);
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
  };
  void run();

  return () => {
    stopped = true;
    cancelAnimationFrame(frame);
    out.remove();
  };
}

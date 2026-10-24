/**
 * The measurement run (`?mesure=1`, implementation plan §3): on a real device, the journey plays itself from the
 * opening to the contact and records its frame times with the phases of the step 1 bench
 * (`docs/prototypes/perf/src/meter.js`): the opening, the projects, the end, and a rest on a project. The result
 * shows on the page as text to copy into the bench. Headless Chromium never proves a frame rate: only devices count.
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
  const out = panel();

  const tick = (now: number): void => {
    if (phase && last) phases.get(phase)?.push(now - last);
    last = now;
    frame = requestAnimationFrame(tick);
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
    if (stopped) return;
    const result = {
      date: new Date().toISOString(),
      page: location.href,
      userAgent: navigator.userAgent,
      screen: `${String(innerWidth)} × ${String(innerHeight)} @${String(devicePixelRatio)}`,
      refreshHz: refresh,
      gpu: gpu(),
      phases: Object.fromEntries([...phases].map(([name, times]) => [name, summarize(times)])),
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

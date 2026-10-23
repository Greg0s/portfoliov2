// Runs one test in this page (run.html?test=…): measures the refresh rate, loads and sets the test up, plays its
// scripted sequence while recording every frame, then sends the result to the launcher (or shows it when alone).
import { createMeter, measureRefresh, jsHeapMB, round } from './meter.js';

const TESTS = {
  'office-live': { load: () => import('./office-live.js'), title: 'Bureau en temps réel, ombres figées' },
  'office-live-shadows': { load: () => import('./office-live.js'), title: 'Bureau en temps réel, ombres recalculées', params: { shadows: 'live' } },
  'office-layers': { load: () => import('./office-layers.js'), title: 'Bureau en couches pré-rendues' },
  'journey-css': { load: () => import('./journey.js'), title: 'Parcours, cartes en CSS', variant: 'css' },
  'journey-webgl': { load: () => import('./journey.js'), title: 'Parcours, cartes en WebGL', variant: 'webgl' },
};

const q = new URLSearchParams(location.search);
const id = q.get('test') || 'office-live';
const def = TESTS[id];
const stage = document.getElementById('stage');
const mobile = q.has('mobile') ? q.get('mobile') === '1' : innerWidth < innerHeight;
const moment = q.get('moment') || 'crepuscule';
const params = new URLSearchParams({ ...(def.params ?? {}), ...Object.fromEntries(q) });

const send = (msg) => {
  if (parent !== window) parent.postMessage({ source: 'perf-run', ...msg }, '*');
};
const status = (text) => send({ type: 'status', text });

let longTaskMs = 0;
let longTasks = 0;
try {
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      longTaskMs += e.duration;
      longTasks++;
    }
  }).observe({ type: 'longtask', buffered: true });
} catch {
  longTaskMs = null;
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(r));

function transferred() {
  const out = { scriptKB: 0, modelKB: 0, imagesKB: 0, videoKB: 0, otherKB: 0 };
  for (const e of performance.getEntriesByType('resource')) {
    const kb = (e.transferSize || e.encodedBodySize || 0) / 1024;
    if (/\.js(\?|$)/.test(e.name)) out.scriptKB += kb;
    else if (/glb/.test(e.name)) out.modelKB += kb;
    else if (/\.(webp|png|jpg|avif)/.test(e.name)) out.imagesKB += kb;
    else if (/\.mp4/.test(e.name)) out.videoKB += kb;
    else out.otherKB += kb;
  }
  for (const k in out) out[k] = Math.round(out[k]);
  return out;
}

async function main() {
  const result = { test: id, title: def.title, mobileFraming: mobile, moment, viewport: `${innerWidth}×${innerHeight}`, devicePixelRatio: devicePixelRatio };
  const heapBefore = jsHeapMB();
  status('Mesure de la fréquence de l’écran…');
  result.refreshHz = round(await measureRefresh(), 0);

  status('Chargement…');
  const timings = {};
  let t0 = performance.now();
  const mod = await def.load();
  timings.importMs = round(performance.now() - t0);
  t0 = performance.now();
  const test = await mod.setup({ stage, mobile, moment, variant: def.variant, params, timings });
  timings.setupMs = round(performance.now() - t0);
  t0 = performance.now();
  test.frame(0);
  await nextFrame();
  timings.firstFrameMs = round(performance.now() - t0);
  const longBefore = longTaskMs;

  const meter = createMeter();
  meter.setExtra(test.hud);
  status('Mesure en cours');
  const start = performance.now();
  let interrupted = false;
  let lastNow = start;
  await new Promise((resolve) => {
    const step = (now) => {
      if (now - lastNow > 1000) interrupted = true;
      lastNow = now;
      const t = (now - start) / 1000;
      if (t > test.duration) return resolve();
      const phase = test.phaseAt(t);
      meter.phase(phase);
      meter.frame(now);
      test.frame(t);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });

  Object.assign(result, {
    interrupted,
    timings,
    longTasks: longTaskMs === null ? null : { count: longTasks, loadMs: round(longBefore), runMs: round(longTaskMs - longBefore) },
    phases: meter.result(),
    stats: test.stats(),
    jsHeapMB: heapBefore === null ? null : { before: round(heapBefore, 1), after: round(jsHeapMB(), 1) },
    transferredKB: transferred(),
  });
  meter.remove();
  test.dispose();
  window.__result = result;
  send({ type: 'result', result });
  if (parent === window) {
    const pre = document.createElement('pre');
    pre.className = 'alone';
    pre.textContent = JSON.stringify(result, null, 2);
    document.body.append(pre);
  }
}

main().catch((e) => {
  console.error(e);
  window.__result = { error: String(e && e.stack ? e.stack : e) };
  send({ type: 'error', test: id, message: String(e && e.message ? e.message : e) });
  const pre = document.createElement('pre');
  pre.className = 'alone';
  pre.textContent = 'Erreur : ' + (e && e.stack ? e.stack : e);
  document.body.append(pre);
});

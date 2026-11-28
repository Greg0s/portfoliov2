/**
 * The loading pause's proposals (`?chargement=1` to `5`, 28 November 2026): what the journey's loading pause
 * (`src/scene/journey/journey.ts`, `root[data-loading]`) shows instead of its "Loading" pill. Without the parameter, or
 * with `?chargement=0`, the pill stays.
 *
 * The pause lasts 0.6 s at least and 3 s at most, and only ever comes on the ring. Each proposal is a moment of the
 * site's world rather than a sign that something loads, and none of them ever cuts short: what started when the pause
 * began plays to its natural end (a shooting star finishes its flight, the wind falls back), so a pause of a blink
 * still looks like a moment of the sky, and a longer one gets more of it. Everything moves by `transform` and
 * `opacity` (Web Animations, run by the compositor), so that it keeps its pace while the page finishes a scene.
 *
 * 1. The wind: a held gust over the planet (scarf, rose, fox), and dust blown past it.
 * 2. Shooting stars over the planet, one every 1.3 s while the pause lasts.
 * 3. A comet going round the ring of projects, along its line, from the project in front.
 * 4. The museum: a light sweeps over the card in front, and a line under its title fills as a cartel being lit.
 * 5. B 612: the favicon's little prince and fox, in pixels, the scarf in the wind, where the pill was.
 */
import { setStorm } from '../scene/planet/wind';

export type LoadingStyle = 0 | 1 | 2 | 3 | 4 | 5;

/** The proposal asked for by `?chargement=`, or 0: the pill. */
export function loadingStyle(search: string): LoadingStyle {
  const value = Number(new URLSearchParams(search).get('chargement') ?? 0);
  return ([1, 2, 3, 4, 5] as const).find((n) => n === value) ?? 0;
}

export interface Orbit {
  x: number[];
  y: number[];
  z: number[];
  planet: { x: number; y: number; r: number } | null;
}

interface Hooks {
  /** The ring's line as drawn, in CSS px (`Showcase.orbit`). */
  orbit(): Orbit | null;
}

interface Proposal {
  start(): void;
  end(): void;
  stop(): void;
}

const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';

function el(tag: string, className: string, parent: Element): HTMLElement {
  const made = document.createElement(tag);
  made.className = className;
  parent.append(made);
  return made;
}

/** Fades `element` out over `ms`, then lets `done` clean up. */
function fadeOut(element: HTMLElement, ms: number, done: () => void): Animation {
  const fade = element.animate([{ opacity: getComputedStyle(element).opacity }, { opacity: 0 }], {
    duration: ms,
    easing: 'ease',
    fill: 'forwards',
  });
  fade.onfinish = done;
  return fade;
}

/** The planet's disc on screen, as a box: the ring's (`Showcase.orbit`). */
function planetRect(hooks: Hooks): { left: number; top: number; width: number; height: number } | null {
  const disc = hooks.orbit()?.planet;
  if (!disc) return null;
  return { left: disc.x - disc.r, top: disc.y - disc.r, width: 2 * disc.r, height: 2 * disc.r };
}

// ---------- 1. The wind ----------

function wind(hooks: Hooks, layer: HTMLElement): Proposal {
  let box: HTMLElement | null = null;
  let fading: Animation | null = null;
  const GRAINS = 14;
  return {
    start() {
      setStorm(true);
      fading?.cancel();
      box?.remove();
      const rect = planetRect(hooks);
      if (!rect) return;
      box = el('div', 'ls-wind', layer);
      Object.assign(box.style, {
        left: `${String(rect.left)}px`,
        top: `${String(rect.top)}px`,
        width: `${String(rect.width)}px`,
        height: `${String(rect.height)}px`,
      });
      const w = rect.width;
      for (let i = 0; i < GRAINS; i += 1) {
        const grain = el('span', 'ls-grain', box);
        // Spread over the planet's upper two thirds, where the scarf flies; each its own size, speed and moment.
        const y = (0.12 + 0.55 * ((i * 0.618) % 1)) * rect.height;
        const size = 2 + ((i * 7) % 5) * 0.5;
        // A streak of dust, drawn out by the wind.
        grain.style.width = `${(size * 7).toFixed(1)}px`;
        grain.style.height = `${(size * 0.6).toFixed(1)}px`;
        const duration = 900 + ((i * 337) % 600);
        grain.animate(
          [
            { transform: `translate(${String(-0.45 * w)}px, ${y.toFixed(0)}px)`, opacity: 0 },
            { opacity: 0.9, offset: 0.25 },
            { opacity: 0.6, offset: 0.75 },
            { transform: `translate(${String(1.25 * w)}px, ${(y + 0.12 * w).toFixed(0)}px)`, opacity: 0 },
          ],
          { duration, delay: (i * 173) % 900, iterations: Infinity, easing: 'cubic-bezier(0.3, 0, 0.6, 1)' },
        );
      }
      box.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease' });
    },
    end() {
      setStorm(false);
      const leaving = box;
      if (!leaving) return;
      box = null;
      fading = fadeOut(leaving, 700, () => {
        leaving.remove();
      });
    },
    stop() {
      setStorm(false);
      box?.remove();
    },
  };
}

// ---------- 2. Shooting stars ----------

/** Where each star crosses, relative to the planet's box: start and end, in planet widths from its centre. */
const FLIGHTS = [
  { x0: -1.6, y0: -0.75, x1: 0.2, y1: -0.35 },
  { x0: -0.2, y0: -0.95, x1: 1.5, y1: -0.55 },
  { x0: -1.3, y0: -0.45, x1: 0.6, y1: -0.05 },
];
const STAR_MS = 1000;
const STAR_EVERY = 1300;

function stars(hooks: Hooks, layer: HTMLElement): Proposal {
  let timer = 0;
  let count = 0;
  const flying = new Set<HTMLElement>();
  function launch(): void {
    const rect = planetRect(hooks);
    const flight = FLIGHTS[count % FLIGHTS.length];
    count += 1;
    if (!rect || !flight) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const s = Math.min(rect.width, 520);
    const x0 = cx + flight.x0 * s;
    const y0 = cy + flight.y0 * s;
    const x1 = cx + flight.x1 * s;
    const y1 = cy + flight.y1 * s;
    const angle = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI;
    const star = el('span', 'ls-star', layer);
    const length = Math.round(s * 0.7);
    // Its head (the right end, where it turns and scales) on the point it flies through.
    star.style.width = `${String(length)}px`;
    star.style.marginLeft = `${String(-length)}px`;
    flying.add(star);
    const at = (x: number, y: number, k: number): string =>
      `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${angle.toFixed(1)}deg) scaleX(${String(k)})`;
    const flight$ = star.animate(
      [
        { transform: at(x0, y0, 0.05), opacity: 0 },
        { opacity: 1, offset: 0.2 },
        { transform: at(x0 + (x1 - x0) * 0.7, y0 + (y1 - y0) * 0.7, 1), opacity: 0.9, offset: 0.7 },
        { transform: at(x1, y1, 0.2), opacity: 0 },
      ],
      { duration: STAR_MS, easing: 'cubic-bezier(0.3, 0.4, 0.4, 1)', fill: 'forwards' },
    );
    flight$.onfinish = () => {
      flying.delete(star);
      star.remove();
    };
  }
  return {
    start() {
      count = 0;
      launch();
      timer = window.setInterval(launch, STAR_EVERY);
    },
    end() {
      clearInterval(timer);
    },
    stop() {
      clearInterval(timer);
      flying.forEach((star) => {
        star.remove();
      });
      flying.clear();
    },
  };
}

// ---------- 3. The comet ----------

const LAP_MS = 2600;
const TAIL = 14;

function comet(layer: HTMLElement, hooks: Hooks): Proposal {
  let box: HTMLElement | null = null;
  let fading: Animation | null = null;
  return {
    start() {
      fading?.cancel();
      box?.remove();
      const orbit = hooks.orbit();
      if (!orbit) return;
      box = el('div', 'ls-comet', layer);
      const { x, y, z, planet } = orbit;
      const last = x.length - 1;
      const frames: Keyframe[] = x.map((px, k) => {
        const pz = z[k] ?? 0;
        const py = y[k] ?? 0;
        const behind = pz < 0 && planet !== null && Math.hypot(px - planet.x, py - planet.y) < planet.r * 0.94;
        // Brighter on the ring's front, as its dust is.
        const front = 0.55 + 0.45 * (0.5 + 0.5 * Math.cos((2 * Math.PI * k) / last));
        return {
          offset: k / last,
          transform: `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)`,
          opacity: behind ? 0 : front,
        };
      });
      for (let i = TAIL; i >= 0; i -= 1) {
        const outer = el('span', 'ls-comet-dot', box);
        const inner = el('span', i === 0 ? 'ls-comet-head' : 'ls-comet-tail', outer);
        inner.style.opacity = String(i === 0 ? 1 : 0.8 * (1 - i / (TAIL + 1)));
        inner.style.scale = String(i === 0 ? 1 : 0.9 - (0.6 * i) / TAIL);
        outer.animate(frames, {
          duration: LAP_MS,
          delay: i * 22,
          iterations: Infinity,
          easing: 'linear',
          fill: 'backwards',
        });
      }
      box.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250, easing: 'ease' });
    },
    end() {
      const leaving = box;
      if (!leaving) return;
      box = null;
      fading = fadeOut(leaving, 550, () => {
        leaving.remove();
      });
    },
    stop() {
      box?.remove();
    },
  };
}

// ---------- 4. The museum ----------

const SWEEP_MS = 1500;

function museum(root: HTMLElement): Proposal {
  let parts: HTMLElement[] = [];
  let line: HTMLElement | null = null;
  let fill: Animation | null = null;
  return {
    start() {
      const front = root.querySelector('.project.lit');
      const card = front?.querySelector('.card');
      const title = front?.querySelector('.cartel h3');
      if (card) {
        const sheen = el('span', 'ls-sheen', card);
        const band = el('span', 'ls-sheen-band', sheen);
        band.animate(
          [
            { transform: 'translateX(-130%) skewX(-12deg)', offset: 0 },
            { transform: 'translateX(330%) skewX(-12deg)', offset: 0.75 },
            { transform: 'translateX(330%) skewX(-12deg)', offset: 1 },
          ],
          { duration: SWEEP_MS, iterations: Infinity, easing: 'cubic-bezier(0.45, 0, 0.3, 1)' },
        );
        sheen.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
        parts.push(sheen);
      }
      if (title) {
        line = document.createElement('span');
        line.className = 'ls-line';
        title.append(line);
        // Fills fast, then slower and slower: never full before the pause ends.
        fill = line.animate(
          [
            { transform: 'scaleX(0)' },
            { transform: 'scaleX(0.55)', offset: 0.25 },
            { transform: 'scaleX(0.8)', offset: 0.6 },
            { transform: 'scaleX(0.9)' },
          ],
          { duration: 3000, easing: 'ease-out', fill: 'forwards', delay: 150 },
        );
        parts.push(line);
      }
    },
    end() {
      const ending = parts;
      parts = [];
      const filled = line;
      line = null;
      // The sweep under way finishes its pass; the line fills up, then all fade.
      if (filled && fill) {
        const now = getComputedStyle(filled).transform;
        fill.cancel();
        filled.animate([{ transform: now === 'none' ? 'scaleX(0)' : now }, { transform: 'scaleX(1)' }], {
          duration: 260,
          easing: EASE_OUT,
          fill: 'forwards',
        });
      }
      window.setTimeout(() => {
        ending.forEach((part) => {
          fadeOut(part, 420, () => {
            part.remove();
          });
        });
      }, 300);
    },
    stop() {
      parts.forEach((part) => {
        part.remove();
      });
      parts = [];
      line = null;
    },
  };
}

// ---------- 5. B 612 ----------

const B612_DELAY = 250;
const B612_MIN = 700;

function b612(root: HTMLElement): Proposal {
  const pill = root.querySelector<HTMLElement>('.loading');
  let shownAt = 0;
  let showTimer = 0;
  let hideTimer = 0;
  return {
    start() {
      clearTimeout(hideTimer);
      showTimer = window.setTimeout(() => {
        shownAt = performance.now();
        pill?.classList.add('ls-on');
      }, B612_DELAY);
    },
    end() {
      clearTimeout(showTimer);
      if (!shownAt) return;
      // Once shown, it stays long enough to be seen, never a flash.
      const left = Math.max(0, B612_MIN - (performance.now() - shownAt));
      hideTimer = window.setTimeout(() => {
        shownAt = 0;
        pill?.classList.remove('ls-on');
      }, left);
    },
    stop() {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      pill?.classList.remove('ls-on');
    },
  };
}

/**
 * Plays proposal `style` at each of the journey's loading pauses in `root`; the layer of the sky's proposals goes just
 * before `space` (above the ring's sky and the planet, under the cards). Returns a function that stops it.
 */
export function startLoading(root: HTMLElement, space: HTMLElement, style: LoadingStyle, hooks: Hooks): () => void {
  if (style === 0) return () => undefined;
  root.dataset.loadingStyle = String(style);
  const layer = document.createElement('div');
  layer.className = 'ls-layer';
  layer.setAttribute('aria-hidden', 'true');
  space.before(layer);
  const proposal =
    style === 1
      ? wind(hooks, layer)
      : style === 2
        ? stars(hooks, layer)
        : style === 3
          ? comet(layer, hooks)
          : style === 4
            ? museum(root)
            : b612(root);
  let on = false;
  const observer = new MutationObserver(() => {
    const loading = root.hasAttribute('data-loading');
    if (loading === on) return;
    on = loading;
    if (on) proposal.start();
    else proposal.end();
  });
  observer.observe(root, { attributes: true, attributeFilter: ['data-loading'] });
  return () => {
    observer.disconnect();
    proposal.stop();
    layer.remove();
    delete root.dataset.loadingStyle;
  };
}

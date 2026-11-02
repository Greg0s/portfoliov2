/**
 * Plays an arrival proposal (see `mode.ts`) on the home's opening. The words and the card are Web Animations, so that
 * they run on the compositor while the page loads; the scene's moves (the approach, the pen) follow the site's one
 * loop. A gesture (wheel, finger, key, click) plays the rest six times faster. The proposals are tried with
 * `?arrivee=…`; `&attendre=1` waits for an `arrival:go` event, for the frame-by-frame recordings.
 */
import { bonjour, hello, type Handwriting } from './handwriting';
import { hash, splitLetters } from './letters';
import type { ArrivalVariant } from './mode';
import { arrivalScene } from './scene';
import { onTick } from '../ticker';

const EASE_UI = 'cubic-bezier(0.23, 1, 0.32, 1)';
const EASE_FLOAT = 'cubic-bezier(0.37, 0, 0.63, 1)';
/** How much faster the rest of the arrival plays after a gesture. */
const SKIP_SPEED = 6;

interface Context {
  html: HTMLElement;
  opening: HTMLElement;
  mobile: boolean;
  anims: Animation[];
  stops: (() => void)[];
  speed: number;
}

function play(ctx: Context, element: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions): Animation {
  const animation = element.animate(keyframes, { fill: 'both', ...options });
  ctx.anims.push(animation);
  return animation;
}

/** A chunk of the card: it rises 14 px into place, sharpening (motion-craft's staged entrance). */
function reveal(ctx: Context, element: Element | null, delay: number, duration = 800): void {
  if (!element) return;
  play(
    ctx,
    element,
    [
      { opacity: 0, transform: 'translateY(14px)', filter: 'blur(6px)' },
      { opacity: 1, transform: 'none', filter: 'blur(0px)' },
    ],
    { delay, duration, easing: EASE_UI },
  );
}

/** The header and the call to action, once the arrival has spoken. */
function chrome(ctx: Context, delay: number): void {
  const header = document.querySelector('.header');
  const parts = ctx.opening.querySelectorAll('.cta > *');
  if (header) play(ctx, header, [{ opacity: 0 }, { opacity: 1 }], { delay, duration: 900, easing: 'ease' });
  parts.forEach((part, i) => {
    play(ctx, part, [{ opacity: 0 }, { opacity: 1 }], { delay: delay + 150 + 120 * i, duration: 900, easing: 'ease' });
  });
}

/** The card (name, job, description), one chunk after the other. */
function card(ctx: Context, delay: number): void {
  reveal(ctx, ctx.opening.querySelector('.intro h1'), delay);
  reveal(ctx, ctx.opening.querySelector('.intro .job'), delay + 130);
  reveal(ctx, ctx.opening.querySelector('.intro .lede'), delay + 260);
}

interface Phrase {
  element: HTMLElement;
  float: HTMLElement;
  letters: HTMLSpanElement[];
}

function phrases(ctx: Context): Phrase[] {
  return [...ctx.opening.querySelectorAll<HTMLElement>('.parole')].flatMap((element) => {
    const float = element.querySelector<HTMLElement>('.float');
    const text = element.querySelector<HTMLElement>('.text');
    if (!float || !text) return [];
    return [{ element, float, letters: splitLetters(text) }];
  });
}

/** The letters land one after the other: each rises into place, turning back straight and sharpening. */
function land(ctx: Context, letters: HTMLSpanElement[], delay: number, stagger: number, seed: number): void {
  letters.forEach((letter, i) => {
    const dx = (hash(i * 7 + seed) - 0.5) * 0.3;
    const dy = 0.45 + hash(i * 3 + seed) * 0.35;
    const r = (hash(i * 11 + seed) - 0.5) * 36;
    play(
      ctx,
      letter,
      [
        {
          opacity: 0,
          transform: `translate(${dx.toFixed(3)}em, ${dy.toFixed(3)}em) rotate(${r.toFixed(1)}deg) scale(0.9)`,
          filter: 'blur(5px)',
        },
        { opacity: 1, transform: 'none', filter: 'blur(0px)' },
      ],
      { delay: delay + i * stagger, duration: 1100, easing: EASE_UI },
    );
  });
}

/**
 * The letters fly away in the wind, up and to the right like the prince's scarf: the last one first, so that none
 * crosses the letters still there.
 */
function flyAway(ctx: Context, letters: HTMLSpanElement[], delay: number, stagger: number, seed: number): void {
  const last = letters.length - 1;
  letters.forEach((letter, i) => {
    const dx = 0.2 + hash(i * 5 + seed) * 0.7;
    const dy = -(1.3 + hash(i * 13 + seed) * 1.4);
    const r = (hash(i * 17 + seed) - 0.3) * 70;
    play(
      ctx,
      letter,
      [
        { opacity: 1, transform: 'none', filter: 'blur(0px)' },
        { opacity: 1, offset: 0.3 },
        {
          opacity: 0,
          transform: `translate(${dx.toFixed(3)}em, ${dy.toFixed(3)}em) rotate(${r.toFixed(1)}deg) scale(1.05)`,
          filter: 'blur(4px)',
        },
      ],
      {
        delay: delay + (last - i) * stagger,
        duration: 1300,
        easing: 'cubic-bezier(0.45, 0, 0.75, 0.6)',
        fill: 'forwards',
      },
    );
  });
}

/** A slow float, like the cards': a few px and a fraction of a degree, there and back. */
function float(ctx: Context, element: HTMLElement, delay: number, k: number): void {
  const fx = (k % 2 ? 1 : -1) * (3 + k);
  const fy = -(6 + 2 * k);
  const fr = (k % 2 ? -1 : 1) * 0.6;
  play(
    ctx,
    element,
    [
      { transform: 'translate(0px, 0px) rotate(0deg)' },
      { transform: `translate(${String(fx)}px, ${String(fy)}px) rotate(${String(fr)}deg)` },
    ],
    { delay, duration: 6800 + k * 1300, direction: 'alternate', iterations: Infinity, easing: EASE_FLOAT },
  );
}

function letterStagger(letters: HTMLSpanElement[], total: number, most: number): number {
  return Math.min(most, total / Math.max(1, letters.length - 1));
}

// ---------- 1. The words that stay ----------

function wordsThatStay(ctx: Context): number {
  const starts = [500, 1650, 3150];
  phrases(ctx).forEach(({ element, float: floater, letters }, k) => {
    const at = starts[k] ?? 0;
    land(ctx, letters, at, letterStagger(letters, 900, 55), k * 101);
    play(ctx, element, [{ transform: 'translateY(16px)' }, { transform: 'none' }], {
      delay: at,
      duration: 2600,
      easing: EASE_UI,
    });
    float(ctx, floater, at + 1200, k);
  });
  chrome(ctx, 4300);
  return 5600;
}

// ---------- 2. The words that fly away, then the card ----------

function wordsThatFly(ctx: Context): number {
  const times = [
    { at: 400, out: 2100 },
    { at: 2400, out: 5000 },
    { at: 5300, out: 7400 },
  ];
  phrases(ctx).forEach(({ element, letters }, k) => {
    const { at, out } = times[k] ?? { at: 0, out: 0 };
    land(ctx, letters, at, letterStagger(letters, 800, 50), k * 101);
    play(ctx, element, [{ transform: 'translateY(16px)' }, { transform: 'translateY(-6px)' }], {
      delay: at,
      duration: out - at + 400,
      easing: 'cubic-bezier(0.25, 0.5, 0.4, 1)',
    });
    flyAway(ctx, letters, out, letterStagger(letters, 600, 35), k * 53);
  });
  card(ctx, 8300);
  chrome(ctx, 9100);
  return 10200;
}

// ---------- 3. The words from the planet ----------

interface Point {
  x: number;
  y: number;
}

function wordsFromPlanet(ctx: Context): number {
  const planet = ctx.opening.querySelector('.planet-image')?.getBoundingClientRect();
  const box = ctx.opening.getBoundingClientRect();
  if (!planet) return 0;
  // Where the prince speaks from (his head, in the planet's square), and the scene's vanishing point.
  const source: Point = {
    x: planet.left + planet.width * 0.54 - box.left,
    y: planet.top + planet.height * 0.2 - box.top,
  };
  const vanishing: Point = { x: box.width / 2, y: box.height * (ctx.mobile ? 0.29 : 0.5) };
  const times = [
    { at: 400, out: 2700 },
    { at: 2500, out: 5700 },
    { at: 5400, out: 7900 },
  ];
  const lags = [45, 14, 30];
  const all = phrases(ctx);
  // Measured before anything moves.
  const places = all.map(({ element, letters }) => {
    const rect = element.getBoundingClientRect();
    const target: Point = { x: rect.left + rect.width / 2 - box.left, y: rect.top + rect.height / 2 - box.top };
    const offsets = letters.map((letter) => {
      const r = letter.getBoundingClientRect();
      return { x: r.left + r.width / 2 - box.left - target.x, y: r.top + r.height / 2 - box.top - target.y };
    });
    return { target, offsets };
  });
  all.forEach(({ element, float: floater, letters }, k) => {
    const { at, out } = times[k] ?? { at: 0, out: 0 };
    const place = places[k];
    if (!place) return;
    const { target, offsets } = place;
    // The wind lifts the words on their way out: an arc above both ends (to the right on a phone, where the words
    // land under the planet).
    const control: Point = ctx.mobile
      ? { x: Math.min(box.width - 40, source.x + 170), y: (source.y + target.y) / 2 - 60 }
      : { x: source.x + (target.x - source.x) * 0.35, y: Math.min(source.y, target.y) - 150 };
    const steps = 14;
    letters.forEach((letter, i) => {
      const offset = offsets[i] ?? { x: 0, y: 0 };
      const frames: Keyframe[] = [];
      for (let j = 0; j <= steps; j += 1) {
        const p = j / steps;
        const q = 1 - p;
        const bx = q * q * source.x + 2 * q * p * control.x + p * p * target.x;
        const by = q * q * source.y + 2 * q * p * control.y + p * p * target.y;
        // Seen in perspective: far at the planet, at its size where it lands.
        const s = 1 / (1 + 7 * q);
        const x = bx + offset.x * s - (target.x + offset.x);
        const y = by + offset.y * s - (target.y + offset.y);
        frames.push({
          offset: p,
          opacity: Math.min(1, p * 4),
          transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${s.toFixed(3)})`,
          filter: `blur(${(7 * Math.pow(1 - s, 1.5)).toFixed(2)}px)`,
        });
      }
      // The last letter leaves first, so that the ribbon reads on its way, the word gathering from its end.
      const order = letters.length - 1 - i;
      play(ctx, letter, frames, {
        delay: at + order * (lags[k] ?? 20),
        duration: 1500,
        easing: 'cubic-bezier(0.3, 0.1, 0.25, 1)',
      });
    });
    // It drifts toward the visitor while it is read, then passes by the camera, away from the vanishing point.
    play(ctx, floater, [{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }], {
      delay: at + 1200,
      duration: out - at - 1200,
      easing: 'linear',
      fill: 'forwards',
    });
    const away = { x: (target.x - vanishing.x) * 0.9, y: (target.y - vanishing.y) * 0.9 };
    play(
      ctx,
      element,
      [
        { opacity: 1, transform: 'translate(0px, 0px) scale(1)', filter: 'blur(0px)' },
        { opacity: 1, offset: 0.25 },
        {
          opacity: 0,
          transform: `translate(${away.x.toFixed(1)}px, ${away.y.toFixed(1)}px) scale(2.6)`,
          filter: 'blur(16px)',
        },
      ],
      { delay: out, duration: 1100, easing: 'cubic-bezier(0.55, 0, 0.85, 0.35)', fill: 'forwards' },
    );
  });
  card(ctx, 8600);
  chrome(ctx, 9400);
  return 10500;
}

// ---------- 4. The cartel ----------

function cartel(ctx: Context): number {
  const planet = ctx.opening.querySelector('.planet-image');
  const decor = ctx.opening.querySelector('.planet');
  const spot = ctx.opening.querySelector('.spot');
  const night = ctx.opening.querySelector('.night');
  // The spotlight turns on with a flicker, as an old one does, then warms up a little past its light.
  const flicker: [number, number][] = [
    [0, 0],
    [1, 0.05],
    [0.2, 0.1],
    [0.85, 0.17],
    [0.45, 0.23],
    [1, 0.42],
  ];
  const on = (peak: number): Keyframe[] => [
    ...flicker.map(([value, offset]) => ({ opacity: value * peak, offset })),
    { opacity: peak },
  ];
  if (planet) {
    play(ctx, planet, on(1), { delay: 600, duration: 1500, easing: 'linear' });
    play(
      ctx,
      planet,
      [{ filter: 'brightness(1.25)' }, { filter: 'brightness(1.25)', offset: 0.3 }, { filter: 'brightness(1)' }],
      { delay: 600, duration: 2600, easing: 'ease-out' },
    );
  }
  if (spot) play(ctx, spot, on(1), { delay: 600, duration: 1500, easing: 'linear' });
  // The eyes get used to the dark: the room, the decor and the stars come out slowly.
  if (night) play(ctx, night, [{ opacity: 1 }, { opacity: 0 }], { delay: 1700, duration: 2800, easing: EASE_FLOAT });
  if (decor) play(ctx, decor, [{ opacity: 0 }, { opacity: 0.6 }], { delay: 1700, duration: 2800, easing: EASE_FLOAT });
  // The cartel: its rule draws, then its lines come one after the other.
  const museum = ctx.opening.querySelector('.museum');
  const rule = museum?.querySelector('.rule');
  if (rule) {
    play(ctx, rule, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], {
      delay: 2400,
      duration: 900,
      easing: EASE_UI,
    });
  }
  museum?.querySelectorAll(':scope > p').forEach((line, i) => {
    play(
      ctx,
      line,
      [
        { opacity: 0, transform: 'translateY(8px)', filter: 'blur(3px)' },
        { opacity: 1, transform: 'none', filter: 'blur(0px)' },
      ],
      { delay: 2600 + 120 * i, duration: 700, easing: EASE_UI },
    );
  });
  chrome(ctx, 3900);
  return 5000;
}

// ---------- 5. The approach to B 612 ----------

/** A cubic Bézier easing, like CSS's: progress for a time `t` from 0 to 1. */
function bezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const at = (a: number, b: number, s: number): number =>
    3 * a * s * (1 - s) * (1 - s) + 3 * b * s * s * (1 - s) + s * s * s;
  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i += 1) {
      const mid = (lo + hi) / 2;
      if (at(x1, x2, mid) < t) lo = mid;
      else hi = mid;
    }
    return at(y1, y2, (lo + hi) / 2);
  };
}

/** Runs `step` with the arrival's time (ms) at each frame until it returns false. */
function timeline(ctx: Context, step: (time: number) => boolean): void {
  let start = -1;
  let time = 0;
  let last = 0;
  const stop = onTick((now) => {
    if (start < 0) {
      start = now;
      last = now;
    }
    time += (now - last) * ctx.speed;
    last = now;
    if (!step(time)) stop();
  });
  ctx.stops.push(stop);
}

function approach(ctx: Context): number {
  const FAR = 0.012;
  const START = 1000;
  const DURATION = 2900;
  const STARS = 3;
  const ease = bezier(0.55, 0, 0.12, 1);
  const depthOf = (scale: number): number => Math.pow(scale, -1 / 1.3) - 1;
  arrivalScene.moving = true;
  arrivalScene.planetDepth = depthOf(FAR);
  arrivalScene.starsDepth = STARS;
  timeline(ctx, (time) => {
    const q = ease((time - START) / DURATION);
    arrivalScene.planetDepth = depthOf(Math.pow(FAR, 1 - q));
    arrivalScene.starsDepth = STARS * (1 - q);
    if (time < START + DURATION) return true;
    arrivalScene.planetDepth = 0;
    arrivalScene.starsDepth = 0;
    arrivalScene.moving = false;
    return false;
  });
  ctx.stops.push(() => {
    arrivalScene.planetDepth = 0;
    arrivalScene.starsDepth = 0;
    arrivalScene.moving = false;
  });
  const label = ctx.opening.querySelector('.b612');
  if (label) {
    play(
      ctx,
      label,
      [
        { opacity: 0, transform: 'translateY(4px)' },
        { opacity: 1, transform: 'none', offset: 0.35 },
        { opacity: 1, transform: 'none', offset: 0.75 },
        { opacity: 0, transform: 'none' },
      ],
      { delay: 250, duration: 1150, easing: 'ease' },
    );
  }
  card(ctx, 3500);
  chrome(ctx, 4300);
  return 5400;
}

// ---------- 6. The line ----------

const SVG = 'http://www.w3.org/2000/svg';

function pathOf(points: Point[]): string {
  return points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
}

function line(ctx: Context, locale: string): number {
  const svg = ctx.opening.querySelector<SVGSVGElement>('.trait');
  const pen = ctx.opening.querySelector<HTMLElement>('.pen');
  const slot = ctx.opening.querySelector<HTMLElement>('.bonjour-slot');
  const planetElement = ctx.opening.querySelector<HTMLElement>('.planet-image');
  const planet = planetElement?.getBoundingClientRect();
  if (!svg || !pen || !slot || !planet || !planetElement) return 0;
  const box = ctx.opening.getBoundingClientRect();
  svg.setAttribute('viewBox', `0 0 ${box.width.toFixed(0)} ${box.height.toFixed(0)}`);

  // The planet's outline, drawn by hand: a little wobbly, a little wider than the sphere, overshooting its start.
  const center: Point = {
    x: planet.left + planet.width * 0.5 - box.left,
    y: planet.top + planet.height * 0.622 - box.top,
  };
  const radius = planet.width * 0.33;
  const from = (-150 * Math.PI) / 180;
  const turn = Math.PI * 2 + (28 * Math.PI) / 180;
  const ring: Point[] = [];
  for (let i = 0; i <= 160; i += 1) {
    const p = i / 160;
    const a = from + turn * p;
    const r =
      radius * (1 + 0.014 * Math.sin(3 * a + 1) + 0.008 * Math.sin(5 * a + 2) - 0.035 * Math.max(0, p - 0.9) * 10);
    ring.push({ x: center.x + r * Math.cos(a) * 1.01, y: center.y + r * Math.sin(a) });
  }

  // The word, in the slot over the name.
  const word: Handwriting = locale === 'en' ? hello : bonjour;
  const slotBox = slot.getBoundingClientRect();
  const [left, top, width, height] = word.box;
  const k = Math.min(slotBox.height / height, slotBox.width / width);
  const ox = slotBox.left - box.left - left * k;
  const oy = slotBox.top - box.top - top * k;
  const group = document.createElementNS(SVG, 'g');
  group.setAttribute('transform', `translate(${ox.toFixed(1)} ${oy.toFixed(1)}) scale(${k.toFixed(5)})`);
  const strokes = word.strokes.map((d) => {
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', d);
    path.setAttribute('class', 'ink');
    group.append(path);
    return path;
  });

  const circle = document.createElementNS(SVG, 'path');
  circle.setAttribute('d', pathOf(ring));
  circle.setAttribute('class', 'ink ring');
  const end = ring[ring.length - 1] ?? center;
  const firstStroke = strokes[0];
  svg.replaceChildren(circle, group);
  const startOfWord = firstStroke ? firstStroke.getPointAtLength(0) : { x: 0, y: 0 };
  const wordStart: Point = { x: ox + startOfWord.x * k, y: oy + startOfWord.y * k };
  // From the outline to the word: a flourish over the planet, which leaves no trace.
  const bridge = document.createElementNS(SVG, 'path');
  const c1: Point = { x: end.x - 60, y: end.y - (ctx.mobile ? 90 : 230) };
  const c2: Point = ctx.mobile
    ? { x: wordStart.x - 120, y: wordStart.y - 160 }
    : { x: wordStart.x - 260, y: wordStart.y - 220 };
  bridge.setAttribute(
    'd',
    `M${end.x.toFixed(1)} ${end.y.toFixed(1)} C${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${wordStart.x.toFixed(1)} ${wordStart.y.toFixed(1)}`,
  );
  bridge.setAttribute('class', 'ink bridge');
  svg.append(bridge);

  const ringLength = circle.getTotalLength();
  const bridgeLength = bridge.getTotalLength();
  const lengths = strokes.map((path) => path.getTotalLength() * k);
  [circle, bridge].forEach((path) => {
    path.style.strokeDasharray = `${String(path.getTotalLength())} 100000`;
    path.style.strokeDashoffset = String(path.getTotalLength());
  });
  strokes.forEach((path) => {
    const length = path.getTotalLength();
    path.style.strokeDasharray = `${String(length)} 100000`;
    path.style.strokeDashoffset = String(length);
  });

  // The pen's schedule: the outline, the flourish, then the word at a writing hand's pace, with short lifts.
  const RING_AT = 400;
  const RING_MS = 1500;
  const BRIDGE_MS = 600;
  const SPEED = (ctx.mobile ? 0.5 : 0.75) * 1;
  const LIFT = 50;
  const wordAt = RING_AT + RING_MS + BRIDGE_MS;
  const strokeTimes: { at: number; ms: number }[] = [];
  let t = wordAt;
  lengths.forEach((length) => {
    const ms = Math.max(90, length / SPEED);
    strokeTimes.push({ at: t, ms });
    t += ms + LIFT;
  });
  const wordEnd = t;
  const inOut = bezier(0.45, 0, 0.55, 1);
  const tail = 0.38;

  // The drawing comes to life: the planet appears inside its outline, which fades away.
  const closing = RING_AT + RING_MS - 150;
  const frame = ctx.opening.querySelector<HTMLElement>('.planet-frame');
  const decor = ctx.opening.querySelector('.planet');
  play(
    ctx,
    planetElement,
    [
      { filter: 'opacity(0) brightness(1.6)' },
      { filter: 'opacity(1) brightness(1.25)', offset: 0.35 },
      { filter: 'opacity(1) brightness(1)' },
    ],
    { delay: closing, duration: 1400, easing: 'ease-out' },
  );
  if (frame) {
    frame.style.transformOrigin = `${center.x.toFixed(1)}px ${center.y.toFixed(1)}px`;
    play(ctx, frame, [{ transform: 'scale(0.94)' }, { transform: 'scale(1)' }], {
      delay: closing,
      duration: 1400,
      easing: EASE_UI,
    });
  }
  if (decor)
    play(ctx, decor, [{ opacity: 0 }, { opacity: 1 }], { delay: closing + 300, duration: 1800, easing: EASE_FLOAT });
  play(ctx, circle, [{ opacity: 1 }, { opacity: 0 }], { delay: closing + 250, duration: 900, easing: 'ease-in' });

  const place = (p: Point, opacity: number): void => {
    pen.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
    pen.style.opacity = opacity.toFixed(3);
  };
  timeline(ctx, (time) => {
    if (time < RING_AT) {
      place(ring[0] ?? center, 0);
      return true;
    }
    if (time < RING_AT + RING_MS) {
      const p = inOut((time - RING_AT) / RING_MS);
      circle.style.strokeDashoffset = String(ringLength * (1 - p));
      place(circle.getPointAtLength(ringLength * p), Math.min(1, (time - RING_AT) / 200));
      return true;
    }
    circle.style.strokeDashoffset = '0';
    if (time < wordAt) {
      const p = inOut((time - RING_AT - RING_MS) / BRIDGE_MS);
      // Only a tail of the flourish shows, behind the pen.
      const head = (1 + tail) * p;
      bridge.style.strokeDasharray = `${String(bridgeLength * tail)} 100000`;
      bridge.style.strokeDashoffset = String(bridgeLength * (tail - head));
      place(bridge.getPointAtLength(bridgeLength * Math.min(1, p)), 1);
      return true;
    }
    bridge.style.opacity = '0';
    let writing = false;
    for (const [i, path] of strokes.entries()) {
      const slotTime = strokeTimes[i];
      if (!slotTime) continue;
      const length = path.getTotalLength();
      const p = Math.max(0, Math.min(1, (time - slotTime.at) / slotTime.ms));
      path.style.strokeDashoffset = String(length * (1 - p));
      if (p > 0 && p < 1) {
        writing = true;
        const point = path.getPointAtLength(length * p);
        place({ x: ox + point.x * k, y: oy + point.y * k }, 1);
      }
    }
    if (!writing && time >= wordEnd) {
      const fade = Math.max(0, 1 - (time - wordEnd) / 400);
      pen.style.opacity = fade.toFixed(3);
      return fade > 0;
    }
    return true;
  });
  card(ctx, wordEnd - 300);
  chrome(ctx, wordEnd + 500);
  return wordEnd + 1600;
}

// ---------- Playing ----------

export interface ArrivalOptions {
  variant: ArrivalVariant;
  locale: string;
}

/** Plays the arrival on `opening`; returns a function that stops it and leaves the opening as it ends. */
export function startArrival(opening: HTMLElement, { variant, locale }: ArrivalOptions): () => void {
  const html = document.documentElement;
  const ctx: Context = {
    html,
    opening,
    mobile: window.innerWidth < 768,
    anims: [],
    stops: [],
    speed: 1,
  };
  if (variant === '4') {
    const text = opening.querySelector('.cta-text');
    const visit = opening.dataset.visit;
    if (text && visit) text.textContent = visit;
  }
  const players: Record<ArrivalVariant, () => number> = {
    '1': () => wordsThatStay(ctx),
    '2': () => wordsThatFly(ctx),
    '3': () => wordsFromPlanet(ctx),
    '4': () => cartel(ctx),
    '5': () => approach(ctx),
    '6': () => line(ctx, locale),
  };
  const total = players[variant]();
  html.dataset.arrivalReady = 'true';

  // A gesture plays the rest faster.
  const gestures = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
  const hurry = (): void => {
    ctx.speed = SKIP_SPEED;
    ctx.anims.forEach((animation) => {
      animation.updatePlaybackRate(SKIP_SPEED);
    });
    unlisten();
  };
  function unlisten(): void {
    gestures.forEach((name) => {
      window.removeEventListener(name, hurry, true);
    });
  }
  gestures.forEach((name) => {
    window.addEventListener(name, hurry, { capture: true, passive: true });
  });

  // Once it has played, the opening keeps its last state with its own styles: the finished animations let go.
  const settle = setTimeout(() => {
    html.dataset.arrivalDone = 'true';
    ctx.anims.forEach((animation) => {
      const timing = animation.effect?.getComputedTiming();
      if (timing && timing.iterations !== Infinity) animation.cancel();
    });
    unlisten();
  }, total);

  return () => {
    clearTimeout(settle);
    unlisten();
    ctx.stops.forEach((stop) => {
      stop();
    });
    ctx.anims.forEach((animation) => {
      animation.cancel();
    });
    delete html.dataset.arrivalReady;
    delete html.dataset.arrivalDone;
    delete html.dataset.arrivalStars;
  };
}

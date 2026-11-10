/**
 * The ring of projects (see `ring.ts`): the one stop of the journey where all the projects wait together. It keeps
 * the selection (which project is in front, turning from one to the next on a soft spring), poses the cards for the
 * journey, which places them in its 3D scene, draws the ring's dust and small planets on a canvas behind the cards,
 * and shows the arrows with the counter between them.
 */
import { accentAt, mixRgb, type Rgb } from '../accent';
import { projectCss, type Sway } from '../journey/camera';
import type { View } from '../journey/layout';
import { offset, ringFor, ringPoint, ringPose, type Pose, type Ring } from './ring';
import { canvasPainter, webglPainter, type BodyKind, type SkyBox, type SkyPainter } from './sky';

/**
 * The ring turns on a critically damped spring: it sets off gently, glides and settles without a bump, about a second
 * for one section; a click during a turn carries on from the speed the ring has. Its dust follows on a softer spring,
 * a little behind, as if it had its own weight.
 */
const SPRING = 5.2;
const DUST_SPRING = 3.6;

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The ring's state for one frame, as the journey gives it. */
export interface Frame {
  view: View;
  sway: Sway;
  /** The ring's plane, in perspective units in front of the focus plane (0 at the stop). */
  shift: number;
  /** How much of the ring shows: 1 at the stop, 0 away from it. */
  presence: number;
  /** Ambient time, in ms. */
  time: number;
  /** The planet's disc on screen, as drawn at the stop. */
  planet: { x: number; y: number; r: number } | null;
  /** On the way to the ring: the ring as drawn at the stop, scaled by `k` and moved by `x`, `y` (px). */
  zoom: { k: number; x: number; y: number } | null;
}

export interface Showcase {
  /** The project in front (0 to n − 1), where the selection is going. */
  selected(): number;
  /** Whether the ring rests on a project. */
  settled(): boolean;
  /** Card `i`'s offset from the selection (0: in front). */
  offsetOf(i: number): number;
  /** Turns the ring by `way` projects (1: the next one). */
  step(way: number): void;
  /** Brings project `i` in front, the shortest way; at once if `instant`. */
  select(i: number, instant?: boolean): void;
  /** A finger turns the ring by `pull` projects, following it. */
  drag(pull: number): void;
  /** The finger lifts: the ring turns by `way` projects (or back, with 0). */
  release(way: number): void;
  /** Turns the ring on by `delta` ms; true while it turns. */
  update(delta: number): boolean;
  /** Card `i`'s pose; with `at`, for the ring turned to the selection `at` rather than where it is. */
  pose(i: number, view: View, at?: number): Pose;
  ring(view: View): Ring;
  draw(frame: Frame): void;
  resize(view: View): void;
  stop(): void;
}

interface Body {
  kind: BodyKind;
  theta: number;
  r: number;
  dy: number;
  size: number;
  alpha: number;
}

interface Grain {
  theta: number;
  r: number;
  dy: number;
  size: number;
  alpha: number;
}

/** The mockup's random sequence (mulberry32). */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function arrowIcon(way: 'prev' | 'next'): string {
  const d = way === 'prev' ? 'M15 9H3M7.5 4.5L3 9l4.5 4.5' : 'M3 9h12M10.5 4.5L15 9l-4.5 4.5';
  return `<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="${d}"/></svg>`;
}

/** A spring toward `target`: moves `state` on by `dt` seconds. */
function spring(state: { x: number; v: number }, target: number, omega: number, dt: number): void {
  const a = omega * omega * (target - state.x) - 2 * omega * state.v;
  state.v += a * dt;
  state.x += state.v * dt;
}

/**
 * Starts the ring over the journey's section `space`, for the projects titled `titles`. The ring's far half is drawn
 * just under `planet` (the planet's own element), so that only the planet and its characters hide it, not the
 * transparent space around them; its near half over the planet, under the cards. The sky is drawn in WebGL (`sky.ts`)
 * unless `webgl` is false or the browser has no WebGL 2: on 2D contexts then.
 */
export function createShowcase(
  space: HTMLElement,
  titles: readonly string[],
  onMove: () => void,
  planet: HTMLElement | null = null,
  webgl = true,
): Showcase {
  const n = titles.length;
  const french = document.documentElement.lang.startsWith('fr');
  const html = document.documentElement;
  html.dataset.showcase = 'ring';

  // The sky, behind the cards: its near half over the planet, its far half under it.
  const sky = (where: 'near' | 'far'): HTMLCanvasElement => {
    const element = document.createElement('canvas');
    element.className = 'showcase-sky';
    element.dataset.half = where;
    element.setAttribute('aria-hidden', 'true');
    return element;
  };
  let canvas = sky('near');
  space.before(canvas);
  // The far canvas covers the planet's square alone (placed each frame), not the screen: outside that square nothing
  // lies between the two canvases, so the far half of the ring is drawn on the near canvas there, under its near
  // half, and only what the planet can hide goes on the far canvas. One screen-sized picture less to draw and send
  // to the GPU at every frame.
  let farCanvas = sky('far');
  Object.assign(farCanvas.style, { inset: 'auto', left: '0', top: '0' });
  if (planet) planet.before(farCanvas);
  // Both canvases draw the same way, so that a grain looks the same on either side of the far canvas's edge. A canvas
  // whose WebGL painter could not be made keeps its context: a fresh one takes its place for the 2D painter.
  const painterOf = (element: HTMLCanvasElement, draw: 'webgl' | '2d'): [SkyPainter | null, HTMLCanvasElement] => {
    if (draw === 'webgl') {
      const made = webglPainter(element, onLost);
      if (made) return [made, element];
    }
    const fresh = element.cloneNode() as HTMLCanvasElement;
    element.replaceWith(fresh);
    return [canvasPainter(fresh), fresh];
  };
  let painter: SkyPainter | null = null;
  let farPainter: SkyPainter | null = null;
  /** Draws the sky on 2D contexts from now on (fresh canvases), when WebGL gives out. */
  function onLost(): void {
    if (!painter?.webgl) return;
    [painter, canvas] = painterOf(canvas, '2d');
    if (planet) [farPainter, farCanvas] = painterOf(farCanvas, '2d');
    html.dataset.sky = '2d';
    farSide = 0;
    blank = false;
    onMove();
  }
  [painter, canvas] = painterOf(canvas, webgl ? 'webgl' : '2d');
  if (planet) [farPainter, farCanvas] = painterOf(farCanvas, painter?.webgl ? 'webgl' : '2d');
  html.dataset.sky = painter?.webgl ? 'webgl' : '2d';

  // The arrows and the counter, over the cards.
  const ui = document.createElement('div');
  ui.className = 'showcase-ui';
  // A strip along the bottom edge, where the arrows are, rather than the whole screen: the stage gives each of its
  // children the whole screen, which this picture, faded in and out as the ring comes and goes, has no use for.
  Object.assign(ui.style, { inset: 'auto 0 0', height: '0' });
  const total = String(n).padStart(2, '0');
  ui.innerHTML = `
    <div class="showcase-arrows">
      <button type="button" class="showcase-arrow" data-way="-1" aria-label="${french ? 'Projet précédent' : 'Previous project'}">${arrowIcon('prev')}</button>
      <span class="showcase-count" aria-hidden="true"><span class="now">01</span> / ${total}</span>
      <button type="button" class="showcase-arrow" data-way="1" aria-label="${french ? 'Projet suivant' : 'Next project'}">${arrowIcon('next')}</button>
    </div>
    <p class="visually-hidden" aria-live="polite"></p>`;
  space.after(ui);
  const arrows = ui.querySelector<HTMLElement>('.showcase-arrows');
  const now = ui.querySelector<HTMLElement>('.now');
  const live = ui.querySelector<HTMLElement>('[aria-live]');

  // The selection: where the ring is (`turn.x`), how fast it turns, where it goes (`target`, which keeps counting past
  // the last project), and its dust a little behind.
  const turn = { x: 0, v: 0 };
  const dust = { x: 0, v: 0 };
  let target = 0;
  /** How far a finger pulls the ring, in projects. */
  let pull = 0;
  let moving = false;
  const wrap = (i: number): number => ((Math.round(i) % n) + n) % n;

  function goTo(to: number, instant = false): void {
    target = to;
    if (instant) {
      turn.x = to;
      turn.v = 0;
      dust.x = to;
      dust.v = 0;
      moving = false;
    } else moving = true;
    const shown = wrap(target);
    if (now) now.textContent = String(shown + 1).padStart(2, '0');
    if (live) live.textContent = `${String(shown + 1)} / ${String(n)} : ${titles[shown] ?? ''}`;
    onMove();
  }

  const onButton = (event: MouseEvent): void => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-way]') : null;
    if (!button) return;
    event.preventDefault();
    showcase.step(Number(button.dataset.way));
  };
  ui.addEventListener('click', onButton);

  // ---------- The sky ----------

  let ratio = 1;
  /** Whether both canvases are cleared and hidden, away from the ring. */
  let blank = false;
  /** The far canvas's square on screen, in CSS px: its side (0 until placed) and its top-left corner. */
  let farSide = 0;
  let farLeft = 0;
  let farTop = 0;
  /** Around the planet's square: its bob (10 px), its slight turn and half a grain, in px at the stop. */
  const FAR_MARGIN = 16;
  /**
   * The far canvas moves by steps of this many CSS px: the smallest step that is whole in both the canvas's pixels
   * and the screen's, so that its grains land on the screen's pixels exactly as the near canvas's do (on a phone
   * drawing 2.6 screen pixels per CSS px, a canvas moved by any other amount would be resampled a little
   * differently from the other).
   */
  let farStep = 1;
  /** The probe's ratio the canvases were last sized for. */
  let lastProbeRatio = '';
  function resize(view: View): void {
    blank = false;
    const dpr = window.devicePixelRatio || 1;
    ratio = Math.min(2, dpr);
    // The ring's probe (`?mesure=anneau`) draws the sky at a lower ratio, to weigh what its pixels cost.
    const probeRatio = Number(html.dataset.probeRatio) || 0;
    if (probeRatio > 0) ratio = Math.min(ratio, probeRatio);
    lastProbeRatio = html.dataset.probeRatio ?? '';
    farStep = 1 / ratio;
    for (let k = 1; k <= 64; k += 1) {
      const step = k / ratio;
      const screen = step * dpr;
      if (Math.abs(screen - Math.round(screen)) < 1e-6) {
        farStep = step;
        break;
      }
    }
    canvas.width = Math.round(view.width * ratio);
    canvas.height = Math.round(view.height * ratio);
    canvas.style.width = `${String(view.width)}px`;
    canvas.style.height = `${String(view.height)}px`;
    farSide = 0;
  }

  /** A box on screen, in px as `projectCss` gives them (at the stop, before the approach's zoom). */
  type Box = SkyBox;

  /**
   * Puts the far canvas over the planet's square, `disc` as drawn at the stop and `zoom` mapping the stop onto the
   * screen, on whole device pixels so that its grains stay as crisp as the near canvas's; returns the square it covers,
   * at the stop. Its size changes only when the square does by a few pixels (the way to the ring), never at every
   * frame: sizing a canvas again throws its memory away.
   */
  function placeFar(disc: NonNullable<Frame['planet']>, zoom: { k: number; x: number; y: number }): Box {
    const half = disc.r + FAR_MARGIN;
    // Its corner moves by whole steps: the square covers one more step, so that it still holds the planet's.
    const side = 2 * half * zoom.k + farStep;
    if (farSide === 0 || Math.abs(side - farSide) > 6) {
      farSide = Math.ceil(side * ratio) / ratio;
      farCanvas.width = Math.round(farSide * ratio);
      farCanvas.height = farCanvas.width;
      farCanvas.style.width = `${String(farSide)}px`;
      farCanvas.style.height = farCanvas.style.width;
    }
    const left = Math.floor(((disc.x - half) * zoom.k + zoom.x) / farStep) * farStep;
    const top = Math.floor(((disc.y - half) * zoom.k + zoom.y) / farStep) * farStep;
    if (left !== farLeft || top !== farTop) {
      farLeft = left;
      farTop = top;
      farCanvas.style.transform = `translate(${String(left)}px, ${String(top)}px)`;
    }
    // What the canvas covers, at the stop (a little more than the planet's square when its side was rounded up).
    const covered = farSide / zoom.k / 2;
    const cx = (left + farSide / 2 - zoom.x) / zoom.k;
    const cy = (top + farSide / 2 - zoom.y) / zoom.k;
    return { x0: cx - covered, y0: cy - covered, x1: cx + covered, y1: cy + covered };
  }

  // The ring's dust and its stellar bodies, between the projects' sections.
  const rand = seeded(612);
  const grains: Grain[] = Array.from({ length: 900 }, () => {
    const u = rand() + rand() + rand() - 1.5;
    return {
      theta: rand() * Math.PI * 2,
      r: 1 + u * 0.09,
      dy: (rand() - 0.5) * 10,
      size: 0.4 + rand() * rand() * 1.8,
      alpha: 0.25 + rand() * 0.65,
    };
  });
  // The five-pointed stars Grégoire took out (4 November 2026) leave their places empty: the other bodies stay where
  // they were, drawn from the same random sequence.
  const kinds: (Body['kind'] | null)[] = ['orb', 'ringed', null, 'moon', 'orb', null, 'ringed', 'orb'];
  const bodies: Body[] = Array.from({ length: n * 2 }, (_, k) => ({
    kind: kinds[k % kinds.length] ?? null,
    theta: (2 * Math.PI * (Math.floor(k / 2) + (k % 2 ? 0.36 : 0.62))) / n + (rand() - 0.5) * 0.08,
    r: 1 + (rand() - 0.5) * 0.16,
    dy: (rand() - 0.5) * 50,
    size: 6 + rand() * 12,
    alpha: 0.55 + rand() * 0.35,
  })).flatMap((item) => (item.kind ? [{ ...item, kind: item.kind }] : []));

  // The accent's light (src/scene/accent.ts): the ring's front takes its green, its back its sky blue, as if lit from
  // either side; three grains in five and the bodies' glow take it, the rest of the dust stays white.
  const SHADES = 24;
  const shade = (white = 0): Rgb[] =>
    Array.from({ length: SHADES + 1 }, (_, i) => mixRgb(accentAt(i / SHADES), [0.953, 0.953, 0.945], white));
  const dustShades = shade(0.04);
  const glowShades = shade();
  const WHITE: Rgb = [0.953, 0.953, 0.945];
  const lineShade = accentAt(0.5);
  /** The shade of the ring at `theta`, from its front (0) to its back (SHADES). */
  const along = (theta: number): number => Math.round((0.5 - 0.5 * Math.cos(theta)) * SHADES);
  const hash = (i: number): number => {
    const x = Math.sin(i * 12.9898 + 4.1) * 43758.5453;
    return x - Math.floor(x);
  };
  const tinted = grains.map((_, i) => hash(i) < 0.6);

  /**
   * Whether a point behind the planet's centre is hidden by its disc: only without the far layer, which lets the
   * planet's own pixels hide it.
   */
  function hidden(x: number, y: number, z: number, planet: Frame['planet']): boolean {
    return !farPainter && z < 0 && planet !== null && Math.hypot(x - planet.x, y - planet.y) < planet.r * 0.94;
  }

  /** The grains, the line and the bodies of one frame, placed on screen: computed once, drawn on each canvas. */
  const placed = {
    gx: new Float64Array(grains.length),
    gy: new Float64Array(grains.length),
    gz: new Float64Array(grains.length),
    gsize: new Float64Array(grains.length),
    galpha: new Float64Array(grains.length),
    gshade: new Int16Array(grains.length),
    lx: new Float64Array(181),
    ly: new Float64Array(181),
    lz: new Float64Array(181),
    bx: new Float64Array(bodies.length),
    by: new Float64Array(bodies.length),
    bz: new Float64Array(bodies.length),
    bsize: new Float64Array(bodies.length),
    balpha: new Float64Array(bodies.length),
    bshade: new Int16Array(bodies.length),
  };

  function placeRing(frame: Frame): void {
    const { view, sway, shift, time } = frame;
    const ring = ringFor(view);
    const angle = (-2 * Math.PI * dust.x) / n;
    const drift = time * 0.000012;
    const bodyScale = view.mobile ? 0.7 : 1;
    grains.forEach((grain, i) => {
      const theta = grain.theta + angle + drift;
      const point = ringPoint(ring, theta, grain.r);
      const at = projectCss(point.x, point.y + grain.dy * bodyScale, point.z + shift, view, sway);
      // The dust, brighter on the ring's front.
      const front = 0.35 + 0.65 * (0.5 + 0.5 * Math.cos(theta));
      placed.gx[i] = at.x;
      placed.gy[i] = at.y;
      placed.gz[i] = point.z;
      placed.gsize[i] = grain.size * at.scale;
      placed.galpha[i] = grain.alpha * front;
      placed.gshade[i] = tinted[i] ? along(theta) : -1;
    });
    for (let k = 0; k <= 180; k += 1) {
      const theta = (k / 180) * Math.PI * 2;
      const point = ringPoint(ring, theta);
      const at = projectCss(point.x, point.y, point.z + shift, view, sway);
      placed.lx[k] = at.x;
      placed.ly[k] = at.y;
      placed.lz[k] = point.z;
    }
    bodies.forEach((item, i) => {
      const theta = item.theta + angle;
      const point = ringPoint(ring, theta, item.r);
      const at = projectCss(point.x, point.y + item.dy * bodyScale, point.z + shift, view, sway);
      const front = 0.25 + 0.75 * (0.5 + 0.5 * Math.cos(theta));
      placed.bx[i] = at.x;
      placed.by[i] = at.y;
      placed.bz[i] = point.z;
      placed.bsize[i] = item.size * bodyScale * at.scale;
      placed.balpha[i] = item.alpha * front;
      placed.bshade[i] = along(theta);
    });
  }

  type Half = 'far' | 'near' | 'both';
  const inHalf = (z: number, half: Half): boolean => half === 'both' || (half === 'far' ? z < 0 : z >= 0);
  const within = (box: Box, x0: number, y0: number, x1: number, y1: number): boolean =>
    x0 >= box.x0 && y0 >= box.y0 && x1 <= box.x1 && y1 <= box.y1;
  const apart = (box: Box, x0: number, y0: number, x1: number, y1: number): boolean =>
    x1 < box.x0 || x0 > box.x1 || y1 < box.y0 || y0 > box.y1;

  /**
   * Draws one half of the ring (or both) with `paint`, as placed: its grains, then its line, then its bodies. With
   * `only`, what lies wholly inside (`'inside'`) or wholly outside (`'outside'`) `box` alone is drawn: the rest is
   * for the other canvas. Without a far canvas, the planet's disc hides what is behind it (`hidden`).
   */
  function drawHalf(
    paint: SkyPainter,
    half: Half,
    box: Box | null,
    only: 'inside' | 'outside' | null,
    planet: Frame['planet'],
  ): void {
    const skip = (x0: number, y0: number, x1: number, y1: number): boolean => {
      if (!box || !only) return false;
      return only === 'inside' ? apart(box, x0, y0, x1, y1) : within(box, x0, y0, x1, y1);
    };
    // Three grains in five take the accent at their place on the ring, the others stay white.
    for (let i = 0; i < grains.length; i += 1) {
      const z = placed.gz[i] ?? 0;
      if (!inHalf(z, half)) continue;
      const x = placed.gx[i] ?? 0;
      const y = placed.gy[i] ?? 0;
      if (hidden(x, y, z, planet)) continue;
      const size = placed.gsize[i] ?? 0;
      if (skip(x - size / 2, y - size / 2, x + size / 2, y + size / 2)) continue;
      const shade = placed.gshade[i] ?? -1;
      paint.grain(x, y, size, placed.galpha[i] ?? 0, shade < 0 ? WHITE : (dustShades[shade] ?? WHITE));
    }
    paint.grainsDone();
    // A faint line along the ring, in the accent's turquoise.
    let pen = false;
    for (let k = 0; k <= 180; k += 1) {
      const z = placed.lz[k] ?? 0;
      const x = placed.lx[k] ?? 0;
      const y = placed.ly[k] ?? 0;
      if (!inHalf(z, half) || hidden(x, y, z, planet)) {
        pen = false;
        continue;
      }
      if (pen) paint.lineTo(x, y);
      else paint.lineMove(x, y);
      pen = true;
    }
    paint.lineDone(lineShade, 0.13);
    // The stellar bodies between the projects.
    bodies.forEach((item, i) => {
      const z = placed.bz[i] ?? 0;
      if (!inHalf(z, half)) return;
      const x = placed.bx[i] ?? 0;
      const y = placed.by[i] ?? 0;
      if (hidden(x, y, z, planet)) return;
      const size = placed.bsize[i] ?? 0;
      // The glow reaches three times the body's radius.
      const reach = size * 1.5;
      if (skip(x - reach, y - reach, x + reach, y + reach)) return;
      const glow = glowShades[placed.bshade[i] ?? 0] ?? WHITE;
      paint.body(item.kind, x, y, size, placed.balpha[i] ?? 0, glow);
    });
  }

  /**
   * Draws the ring: on the near canvas, its far half outside the planet's square `box`, then its near half; on the
   * far canvas (`far`, under the planet), its far half within the square. Without a far canvas, all on the near one,
   * the planet's disc hiding what is behind it.
   */
  function drawRing(near: SkyPainter, far: SkyPainter | null, box: Box | null, frame: Frame): void {
    placeRing(frame);
    if (!far || !box) {
      drawHalf(near, 'both', null, null, frame.planet);
      return;
    }
    near.hole(box);
    drawHalf(near, 'far', box, 'outside', frame.planet);
    near.hole(null);
    drawHalf(far, 'far', box, 'inside', frame.planet);
    drawHalf(near, 'near', null, null, frame.planet);
  }

  const showcase: Showcase = {
    selected: () => wrap(target),
    settled: () => !moving,
    offsetOf: (i) => offset(i, turn.x, n),
    step(way) {
      goTo(target + Math.sign(way));
    },
    drag(amount) {
      pull = Math.max(-0.9, Math.min(0.9, amount));
      moving = true;
      onMove();
    },
    release(way) {
      pull = 0;
      if (way !== 0) goTo(target + Math.sign(way));
      else moving = true;
    },
    select(i, instant = false) {
      const forward = (((i - target) % n) + n) % n;
      const delta = forward <= n / 2 ? forward : forward - n;
      if (delta === 0 && !instant) return;
      goTo(target + delta, instant);
    },
    update(delta) {
      if (!moving) return false;
      // In steps of at most 8 ms, so that a slow frame never throws the spring off.
      let left = Math.min(250, delta) / 1000;
      while (left > 0) {
        const dt = Math.min(0.008, left);
        // Under a finger, the ring follows it closely.
        spring(turn, target + pull, pull === 0 ? SPRING : 14, dt);
        spring(dust, turn.x, DUST_SPRING, dt);
        left -= dt;
      }
      const resting = (state: { x: number; v: number }): boolean =>
        Math.abs(target - state.x) < 0.0008 && Math.abs(state.v) < 0.004;
      if (pull === 0 && resting(turn) && resting(dust)) {
        turn.x = target;
        turn.v = 0;
        dust.x = target;
        dust.v = 0;
        moving = false;
      }
      return true;
    },
    pose: (i, view, at = turn.x) => ringPose(i, at, n, view),
    ring: ringFor,
    draw(frame) {
      if (!painter) return;
      const shown = frame.presence >= 0.004;
      const opacity = shown ? frame.presence.toFixed(3) : '0';
      if (canvas.style.opacity !== opacity) {
        canvas.style.opacity = opacity;
        farCanvas.style.opacity = opacity;
      }
      const uiOpacity = smooth(0.6, 0.95, frame.presence).toFixed(3);
      if (ui.style.opacity !== uiOpacity) ui.style.opacity = uiOpacity;
      const uiVisibility = frame.presence > 0.01 ? 'visible' : 'hidden';
      if (ui.style.visibility !== uiVisibility) ui.style.visibility = uiVisibility;
      // Only the arrows take the pointer: the rest of the layer lets it through to the cards.
      const pointer = frame.presence > 0.9 ? 'auto' : 'none';
      if (arrows && arrows.style.pointerEvents !== pointer) arrows.style.pointerEvents = pointer;
      // Away from the ring (the opening, the office), its two screen-sized canvases are cleared once, then left alone
      // and out of the page's drawing, rather than cleared at every frame.
      if (!shown && blank) return;
      if ((html.dataset.probeRatio ?? '') !== lastProbeRatio) resize(frame.view);
      if (!shown) {
        painter.clear();
        farPainter?.clear();
      }
      blank = !shown;
      const visibility = shown ? '' : 'hidden';
      if (canvas.style.visibility !== visibility) {
        canvas.style.visibility = visibility;
        farCanvas.style.visibility = visibility;
      }
      if (!shown) return;
      const zoom = frame.zoom ?? { k: 1, x: 0, y: 0 };
      painter.begin(ratio * zoom.k, ratio * zoom.x, ratio * zoom.y);
      let box: Box | null = null;
      if (farPainter && frame.planet) {
        box = placeFar(frame.planet, zoom);
        farPainter.begin(ratio * zoom.k, ratio * (zoom.x - farLeft), ratio * (zoom.y - farTop));
      }
      drawRing(painter, farPainter, box, frame);
    },
    resize,
    stop() {
      ui.removeEventListener('click', onButton);
      canvas.remove();
      farCanvas.remove();
      ui.remove();
      delete html.dataset.showcase;
      delete html.dataset.sky;
    },
  };
  return showcase;
}

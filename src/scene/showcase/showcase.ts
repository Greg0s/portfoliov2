/**
 * The ring of projects (see `ring.ts`): the one stop of the journey where all the projects wait together. It keeps
 * the selection (which project is in front, turning from one to the next on a soft spring), poses the cards for the
 * journey, which places them in its 3D scene, draws the ring's dust and small planets on a canvas behind the cards,
 * and shows the arrows with the counter between them.
 */
import { accentLight, cssRgb, mixRgb } from '../../lib/accent-light';
import { projectCss, type Sway } from '../journey/camera';
import type { View } from '../journey/layout';
import { offset, ringFor, ringPoint, ringPose, type Pose, type Ring } from './ring';

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
  kind: 'orb' | 'ringed' | 'moon';
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
 * transparent space around them; its near half over the planet, under the cards.
 */
export function createShowcase(
  space: HTMLElement,
  titles: readonly string[],
  onMove: () => void,
  planet: HTMLElement | null = null,
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
  const canvas = sky('near');
  space.before(canvas);
  const farCanvas = sky('far');
  if (planet) planet.before(farCanvas);
  const context = canvas.getContext('2d');
  const farContext = planet ? farCanvas.getContext('2d') : null;

  // The arrows and the counter, over the cards.
  const ui = document.createElement('div');
  ui.className = 'showcase-ui';
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
  function resize(view: View): void {
    blank = false;
    ratio = Math.min(2, window.devicePixelRatio || 1);
    for (const element of [canvas, farCanvas]) {
      element.width = Math.round(view.width * ratio);
      element.height = Math.round(view.height * ratio);
      element.style.width = `${String(view.width)}px`;
      element.style.height = `${String(view.height)}px`;
    }
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

  // The accent colour proposals' light (`?lumiere=1`): the ring's front takes the gradient's first stop, its back the
  // last, as if lit from either side; three grains in five and the bodies' glow take it, the rest stays white.
  const accent = accentLight(html);
  const SHADES = 24;
  const shade = (alpha: number, white = 0): string[] =>
    accent
      ? Array.from({ length: SHADES + 1 }, (_, i) =>
          cssRgb(mixRgb(accent.at(i / SHADES), [0.953, 0.953, 0.945], white), alpha),
        )
      : [];
  const dustShades = shade(1, 0.04);
  const glowShades = shade(0.42);
  const lineShade = accent ? cssRgb(accent.at(0.5), 0.13) : '';
  /** The shade of the ring at `theta`, from the front (0) to the back (1). */
  const along = (theta: number): number => Math.round((0.5 - 0.5 * Math.cos(theta)) * SHADES);
  const hash = (i: number): number => {
    const x = Math.sin(i * 12.9898 + 4.1) * 43758.5453;
    return x - Math.floor(x);
  };
  const tinted = grains.map((_, i) => accent !== null && hash(i) < 0.6);

  function body(
    ctx: CanvasRenderingContext2D,
    kind: Body['kind'],
    x: number,
    y: number,
    size: number,
    alpha: number,
    glowColor = 'rgb(255 255 255 / 34%)',
  ): void {
    const r = size / 2;
    ctx.save();
    ctx.globalAlpha = alpha;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
    glow.addColorStop(0, glowColor);
    glow.addColorStop(1, 'rgb(255 255 255 / 0%)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 3, 0, Math.PI * 2);
    ctx.fill();
    {
      const disc = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
      disc.addColorStop(0, '#ffffff');
      disc.addColorStop(1, 'rgb(200 200 196)');
      ctx.fillStyle = disc;
      ctx.beginPath();
      ctx.arc(x, y, r * (kind === 'orb' ? 0.8 : 0.62), 0, Math.PI * 2);
      ctx.fill();
      if (kind === 'ringed') {
        ctx.strokeStyle = 'rgb(255 255 255 / 70%)';
        ctx.lineWidth = Math.max(0.8, r * 0.14);
        ctx.beginPath();
        ctx.ellipse(x, y, r * 1.35, r * 0.36, -0.32, 0, Math.PI * 2);
        ctx.stroke();
      } else if (kind === 'moon') {
        ctx.fillStyle = 'rgb(255 255 255 / 85%)';
        ctx.beginPath();
        ctx.arc(x + r * 1.25, y - r * 0.7, r * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /**
   * Whether a point behind the planet's centre is hidden by its disc: only without the far layer, which lets the
   * planet's own pixels hide it.
   */
  function hidden(x: number, y: number, z: number, planet: Frame['planet']): boolean {
    return !farContext && z < 0 && planet !== null && Math.hypot(x - planet.x, y - planet.y) < planet.r * 0.94;
  }

  function drawRing(near: CanvasRenderingContext2D, far: CanvasRenderingContext2D, frame: Frame): void {
    const layer = (z: number): CanvasRenderingContext2D => (z < 0 ? far : near);
    const { view, sway, shift, time } = frame;
    const ring = ringFor(view);
    const angle = (-2 * Math.PI * dust.x) / n;
    const drift = time * 0.000012;
    const bodyScale = view.mobile ? 0.7 : 1;
    // The dust, brighter on the ring's front.
    near.fillStyle = '#f3f3f1';
    far.fillStyle = '#f3f3f1';
    for (const [i, grain] of grains.entries()) {
      const theta = grain.theta + angle + drift;
      const point = ringPoint(ring, theta, grain.r);
      const at = projectCss(point.x, point.y + grain.dy * bodyScale, point.z + shift, view, sway);
      if (hidden(at.x, at.y, point.z, frame.planet)) continue;
      const front = 0.35 + 0.65 * (0.5 + 0.5 * Math.cos(theta));
      const ctx = layer(point.z);
      ctx.globalAlpha = grain.alpha * front;
      if (accent) ctx.fillStyle = tinted[i] ? (dustShades[along(theta)] ?? '#f3f3f1') : '#f3f3f1';
      const size = grain.size * at.scale;
      ctx.fillRect(at.x - size / 2, at.y - size / 2, size, size);
    }
    near.globalAlpha = 1;
    far.globalAlpha = 1;
    // A faint line along the ring, its far half under the planet.
    for (const ctx of near === far ? [near] : [near, far]) {
      ctx.strokeStyle = accent ? lineShade : 'rgb(243 243 241 / 9%)';
      ctx.lineWidth = 1;
      ctx.beginPath();
    }
    let pen: CanvasRenderingContext2D | null = null;
    for (let k = 0; k <= 180; k += 1) {
      const theta = (k / 180) * Math.PI * 2;
      const point = ringPoint(ring, theta);
      const at = projectCss(point.x, point.y, point.z + shift, view, sway);
      const ctx = layer(point.z);
      if (hidden(at.x, at.y, point.z, frame.planet)) {
        pen = null;
        continue;
      }
      if (pen === ctx) ctx.lineTo(at.x, at.y);
      else ctx.moveTo(at.x, at.y);
      pen = ctx;
    }
    near.stroke();
    if (far !== near) far.stroke();
    // The stellar bodies between the projects.
    for (const item of bodies) {
      const theta = item.theta + angle;
      const point = ringPoint(ring, theta, item.r);
      const at = projectCss(point.x, point.y + item.dy * bodyScale, point.z + shift, view, sway);
      if (hidden(at.x, at.y, point.z, frame.planet)) continue;
      const front = 0.25 + 0.75 * (0.5 + 0.5 * Math.cos(theta));
      const glow = accent ? glowShades[along(theta)] : undefined;
      body(layer(point.z), item.kind, at.x, at.y, item.size * bodyScale * at.scale, item.alpha * front, glow);
    }
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
      if (!context) return;
      const ctx = context;
      const far = farContext ?? ctx;
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
      for (const each of [ctx, far]) {
        each.setTransform(1, 0, 0, 1, 0, 0);
        each.clearRect(0, 0, canvas.width, canvas.height);
      }
      blank = !shown;
      const visibility = shown ? '' : 'hidden';
      if (canvas.style.visibility !== visibility) {
        canvas.style.visibility = visibility;
        farCanvas.style.visibility = visibility;
      }
      if (!shown) return;
      const zoom = frame.zoom ?? { k: 1, x: 0, y: 0 };
      for (const each of [ctx, far])
        each.setTransform(ratio * zoom.k, 0, 0, ratio * zoom.k, ratio * zoom.x, ratio * zoom.y);
      drawRing(ctx, far, frame);
    },
    resize,
    stop() {
      ui.removeEventListener('click', onButton);
      canvas.remove();
      farCanvas.remove();
      ui.remove();
      delete html.dataset.showcase;
    },
  };
  return showcase;
}

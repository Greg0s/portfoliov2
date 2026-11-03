/**
 * The showcase (see `designs.ts`): the one stop of the journey where all the projects wait together, on desktop. It
 * keeps the selection (which project is in front, easing from one to the next), poses the cards for the journey,
 * which places them in its 3D scene, draws the showcase's own sky (the ring and its stellar bodies, the trajectory
 * and its asteroids, the telescope's lens) on a canvas behind the cards, and shows the arrows and the counter.
 */
import { projectCss, type Sway } from '../journey/camera';
import type { View } from '../journey/layout';
import {
  designOf,
  lensFor,
  offset,
  pathPoint,
  ringFor,
  ringPoint,
  telescopeAim,
  type Design,
  type Pose,
} from './designs';
import './showcase.css';

/** How long the selection takes to move by one project, in ms; a longer move takes a little longer. */
const MOVE_MS = 1100;

const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The showcase's state for one frame, as the journey gives it. */
export interface Frame {
  view: View;
  sway: Sway;
  /** The showcase's plane, in perspective units in front of the focus plane (0 at the stop). */
  shift: number;
  /** How much of the showcase shows: 1 at the stop, 0 away from it. */
  presence: number;
  /** Ambient time, in ms. */
  time: number;
  /** The poses of the cards, as drawn this frame. */
  poses: readonly Pose[];
  /** The planet's disc on screen, if the showcase holds it. */
  planet: { x: number; y: number; r: number } | null;
}

export interface Showcase {
  design: Design;
  /** The project in front (0 to n − 1), where the selection is going. */
  selected(): number;
  /** Whether the selection rests on a project. */
  settled(): boolean;
  /** Card `i`'s offset from the selection (0: in front). */
  offsetOf(i: number): number;
  /** Moves the selection by `way` projects (1: the next one). */
  step(way: number): void;
  /** Brings project `i` in front; at once if `instant`. */
  select(i: number, instant?: boolean): void;
  /** Moves the selection on; true while it moves. */
  update(now: number): boolean;
  pose(i: number, view: View): Pose;
  /** The planet's centre and diameter on screen, before the showcase's plane moves (`shift`). */
  planet(view: View): { x: number; y: number; diameter: number } | null;
  draw(frame: Frame): void;
  resize(view: View): void;
  stop(): void;
}

interface Body {
  kind: 'orb' | 'ringed' | 'star' | 'moon';
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

/** Starts the showcase `id` over the journey's section `space`, for `n` projects titled `titles`. */
export function createShowcase(
  id: number,
  space: HTMLElement,
  titles: readonly string[],
  onMove: () => void,
): Showcase | null {
  const found = designOf(id);
  if (!found) return null;
  const design: Design = found;
  const n = titles.length;
  const french = document.documentElement.lang.startsWith('fr');
  const html = document.documentElement;
  html.dataset.showcase = String(design.id);

  // The sky, behind the cards (over the planet and the stars).
  const canvas = document.createElement('canvas');
  canvas.className = 'showcase-sky';
  canvas.setAttribute('aria-hidden', 'true');
  space.before(canvas);
  const context = canvas.getContext('2d');

  // The arrows and the counter, over the cards.
  const ui = document.createElement('div');
  ui.className = `showcase-ui arrows-${design.arrows}`;
  const total = String(n).padStart(2, '0');
  ui.innerHTML = `
    ${design.counter ? `<p class="showcase-counter" aria-hidden="true"><span class="now">01</span><span class="all"> / ${total}</span></p>` : ''}
    <div class="showcase-arrows">
      <button type="button" class="showcase-arrow" data-way="-1" aria-label="${french ? 'Projet précédent' : 'Previous project'}">${arrowIcon('prev')}</button>
      ${design.arrows === 'bottom' ? `<span class="showcase-count" aria-hidden="true"><span class="now">01</span> / ${total}</span>` : ''}
      <button type="button" class="showcase-arrow" data-way="1" aria-label="${french ? 'Projet suivant' : 'Next project'}">${arrowIcon('next')}</button>
    </div>
    <p class="visually-hidden" aria-live="polite"></p>`;
  space.after(ui);
  const nows = [...ui.querySelectorAll<HTMLElement>('.now')];
  const live = ui.querySelector<HTMLElement>('[aria-live]');
  if (design.fixedCartel) {
    ui.style.setProperty('--cartel-x', `${(design.fixedCartel.x * 100).toFixed(2)}vw`);
    ui.style.setProperty('--cartel-y', `${(design.fixedCartel.y * 100).toFixed(2)}vh`);
  }

  // The selection: where it is (`s`), where it goes (`target`, which keeps counting past the last project).
  let s = 0;
  let target = 0;
  let move: { from: number; to: number; start: number; duration: number } | null = null;
  const wrap = (i: number): number => ((Math.round(i) % n) + n) % n;

  function goTo(to: number, instant = false): void {
    if (instant) {
      move = null;
      s = to;
      target = to;
    } else {
      const distance = Math.abs(to - s);
      move = { from: s, to, start: -1, duration: MOVE_MS * (0.75 + 0.25 * Math.min(4, distance)) };
      target = to;
    }
    const now = wrap(target);
    nows.forEach((element) => {
      element.textContent = String(now + 1).padStart(2, '0');
    });
    if (live) live.textContent = `${String(now + 1)} / ${String(n)} : ${titles[now] ?? ''}`;
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

  let width = 0;
  let height = 0;
  let ratio = 1;
  function resize(view: View): void {
    width = view.width;
    height = view.height;
    ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${String(width)}px`;
    canvas.style.height = `${String(height)}px`;
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
  const kinds: Body['kind'][] = ['orb', 'ringed', 'star', 'moon', 'orb', 'star', 'ringed', 'orb'];
  const bodies: Body[] = Array.from({ length: n * 2 }, (_, k) => ({
    kind: kinds[k % kinds.length] ?? 'orb',
    theta: (2 * Math.PI * (Math.floor(k / 2) + (k % 2 ? 0.36 : 0.62))) / n + (rand() - 0.5) * 0.08,
    r: 1 + (rand() - 0.5) * 0.16,
    dy: (rand() - 0.5) * 50,
    size: 6 + rand() * 12,
    alpha: 0.55 + rand() * 0.35,
  }));
  // The trajectory's dust, which streams by as the camera travels.
  const motes = Array.from({ length: 90 }, () => ({
    q: rand() * 7 - 2,
    dx: (rand() - 0.5) * 150,
    dy: (rand() - 0.5) * 120,
    size: 0.5 + rand() * 1.4,
    alpha: 0.2 + rand() * 0.5,
  }));

  function body(
    ctx: CanvasRenderingContext2D,
    kind: Body['kind'],
    x: number,
    y: number,
    size: number,
    alpha: number,
  ): void {
    const r = size / 2;
    ctx.save();
    ctx.globalAlpha = alpha;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
    glow.addColorStop(0, 'rgb(255 255 255 / 34%)');
    glow.addColorStop(1, 'rgb(255 255 255 / 0%)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 3, 0, Math.PI * 2);
    ctx.fill();
    if (kind === 'star') {
      ctx.fillStyle = '#f3f3f1';
      ctx.beginPath();
      for (let k = 0; k < 10; k += 1) {
        const a = -Math.PI / 2 + (k * Math.PI) / 5;
        const rr = (k % 2 ? 0.42 : 1) * r;
        ctx.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a));
      }
      ctx.closePath();
      ctx.fill();
    } else {
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

  /** Whether a point behind the planet's centre is hidden by its disc. */
  function hidden(x: number, y: number, z: number, planet: Frame['planet']): boolean {
    return z < 0 && planet !== null && Math.hypot(x - planet.x, y - planet.y) < planet.r * 0.94;
  }

  function drawRing(ctx: CanvasRenderingContext2D, frame: Frame): void {
    const { view, sway, shift, time } = frame;
    const ring = ringFor(design.id, view);
    const turn = (-2 * Math.PI * s) / n;
    const drift = time * 0.000012;
    // The dust, brighter on the ring's front.
    ctx.fillStyle = '#f3f3f1';
    for (const grain of grains) {
      const theta = grain.theta + turn + drift;
      const point = ringPoint(ring, theta, grain.r);
      const at = projectCss(point.x, point.y + grain.dy, point.z + shift, view, sway);
      if (hidden(at.x, at.y, point.z, frame.planet)) continue;
      const front = 0.35 + 0.65 * (0.5 + 0.5 * Math.cos(theta));
      ctx.globalAlpha = grain.alpha * front;
      const size = grain.size * at.scale;
      ctx.fillRect(at.x - size / 2, at.y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
    // A faint line along the ring.
    ctx.strokeStyle = 'rgb(243 243 241 / 9%)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    let pen = false;
    for (let k = 0; k <= 180; k += 1) {
      const theta = (k / 180) * Math.PI * 2;
      const point = ringPoint(ring, theta);
      const at = projectCss(point.x, point.y, point.z + shift, view, sway);
      if (hidden(at.x, at.y, point.z, frame.planet)) {
        pen = false;
        continue;
      }
      if (pen) ctx.lineTo(at.x, at.y);
      else ctx.moveTo(at.x, at.y);
      pen = true;
    }
    ctx.stroke();
    // The stellar bodies between the projects.
    for (const item of bodies) {
      const theta = item.theta + turn;
      const point = ringPoint(ring, theta, item.r);
      const at = projectCss(point.x, point.y + item.dy, point.z + shift, view, sway);
      if (hidden(at.x, at.y, point.z, frame.planet)) continue;
      const front = 0.25 + 0.75 * (0.5 + 0.5 * Math.cos(theta));
      body(ctx, item.kind, at.x, at.y, item.size * at.scale, item.alpha * front);
    }
  }

  function drawPath(ctx: CanvasRenderingContext2D, frame: Frame): void {
    const { view, sway, shift } = frame;
    // The trajectory, dotted, into the distance.
    ctx.fillStyle = '#f3f3f1';
    for (let k = 0; k < 220; k += 1) {
      const o = -1.6 + (k / 220) * 6;
      const point = pathPoint(o, view);
      const at = projectCss(point.x, point.y, point.z + shift, view, sway);
      const fade = o < 0 ? 1 : Math.exp(-0.32 * o);
      ctx.globalAlpha = 0.55 * fade;
      const size = Math.max(1, 2.2 * at.scale);
      ctx.beginPath();
      ctx.arc(at.x, at.y, size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Dust that streams by as the camera travels.
    for (const mote of motes) {
      const o = ((((mote.q - s) % 7) + 7) % 7) - 2;
      const point = pathPoint(o, view);
      const at = projectCss(point.x + mote.dx, point.y + mote.dy, point.z + shift, view, sway);
      ctx.globalAlpha = mote.alpha * (o < 0 ? 1 - smooth(0, -1.6, o) : Math.exp(-0.4 * o));
      const size = mote.size * at.scale;
      ctx.fillRect(at.x - size / 2, at.y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
    // Each project's asteroid, perched on its card's upper corner, with its number.
    const cardWidth = design.cardWidth * view.width;
    frame.poses.forEach((pose, i) => {
      if (pose.opacity < 0.02) return;
      const r0 = cardWidth * 0.1;
      const corner = { x: pose.x + cardWidth * 0.36, y: pose.y - (cardWidth * 9) / 32 - r0 * 0.55 };
      const at = projectCss(corner.x, corner.y, pose.z + shift + 0.02, view, sway);
      const r = r0 * at.scale;
      ctx.save();
      ctx.globalAlpha = Math.min(1, pose.opacity * 1.1);
      const glow = ctx.createRadialGradient(at.x, at.y, r * 0.8, at.x, at.y, r * 2.6);
      glow.addColorStop(0, 'rgb(255 214 190 / 22%)');
      glow.addColorStop(1, 'rgb(255 214 190 / 0%)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(at.x, at.y, r * 2.6, 0, Math.PI * 2);
      ctx.fill();
      const disc = ctx.createRadialGradient(at.x - r * 0.4, at.y - r * 0.45, r * 0.1, at.x, at.y, r);
      disc.addColorStop(0, '#e9d9c6');
      disc.addColorStop(0.55, '#9c8a79');
      disc.addColorStop(1, '#2e2723');
      ctx.fillStyle = disc;
      ctx.beginPath();
      ctx.arc(at.x, at.y, r, 0, Math.PI * 2);
      ctx.fill();
      // Two craters.
      ctx.fillStyle = 'rgb(46 39 35 / 50%)';
      ctx.beginPath();
      ctx.arc(at.x + r * 0.3, at.y + r * 0.15, r * 0.2, 0, Math.PI * 2);
      ctx.arc(at.x - r * 0.25, at.y + r * 0.45, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = `600 ${(10.5 * Math.min(1.2, at.scale)).toFixed(1)}px ${getComputedStyle(html).getPropertyValue('--font-display')}`;
      ctx.letterSpacing = '0.14em';
      ctx.fillStyle = '#8f8f8b';
      ctx.textAlign = 'center';
      ctx.globalAlpha = pose.opacity * (1 - smooth(1.2, 2, Math.abs(offset(i, s, n, -2))));
      ctx.fillText(`${french ? 'ASTÉROÏDE' : 'ASTEROID'} ${String(325 + i)}`, at.x, at.y - r - 12 * at.scale);
      ctx.restore();
    });
  }

  function drawLens(ctx: CanvasRenderingContext2D, frame: Frame): void {
    const { view, sway, shift } = frame;
    const lens = lensFor(view);
    const at = projectCss(lens.x, lens.y, shift, view, sway);
    const r = lens.r * at.scale;
    // The sky outside the lens, darker.
    ctx.save();
    ctx.fillStyle = 'rgb(5 5 6 / 62%)';
    ctx.beginPath();
    ctx.rect(0, 0, view.width, view.height);
    ctx.arc(at.x, at.y, r, 0, Math.PI * 2, true);
    ctx.fill();
    // The lens's rim, and its graduations, which turn as the telescope sweeps.
    ctx.strokeStyle = 'rgb(243 243 241 / 42%)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(at.x, at.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgb(243 243 241 / 14%)';
    ctx.beginPath();
    ctx.arc(at.x, at.y, r + 16, 0, Math.PI * 2);
    ctx.stroke();
    const turn = (s * Math.PI) / 9;
    for (let k = 0; k < 120; k += 1) {
      const a = turn + (k / 120) * Math.PI * 2;
      const long = k % 10 === 0;
      const r0 = r + 16;
      const r1 = r0 + (long ? 10 : 4);
      ctx.strokeStyle = long ? 'rgb(243 243 241 / 45%)' : 'rgb(243 243 241 / 18%)';
      ctx.beginPath();
      ctx.moveTo(at.x + r0 * Math.cos(a), at.y + r0 * Math.sin(a));
      ctx.lineTo(at.x + r1 * Math.cos(a), at.y + r1 * Math.sin(a));
      ctx.stroke();
    }
    // Four marks, as in a finder's reticle.
    ctx.strokeStyle = 'rgb(243 243 241 / 30%)';
    for (let k = 0; k < 4; k += 1) {
      const a = (k * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(at.x + (r - 14) * Math.cos(a), at.y + (r - 14) * Math.sin(a));
      ctx.lineTo(at.x + (r - 2) * Math.cos(a), at.y + (r - 2) * Math.sin(a));
      ctx.stroke();
    }
    // Where the telescope points, in the sky's coordinates.
    const aim = telescopeAim(s, n, view);
    const ra = 2 + (aim.x / view.width + 1) * 5.5;
    const dec = 22 - (aim.y / view.height) * 30;
    const hours = Math.floor(ra);
    const minutes = Math.floor((ra - hours) * 60);
    ctx.font = `600 11px ${getComputedStyle(html).getPropertyValue('--font-display')}`;
    ctx.letterSpacing = '0.16em';
    ctx.fillStyle = '#8f8f8b';
    ctx.textAlign = 'center';
    const sign = dec >= 0 ? '+' : '−';
    ctx.fillText(
      `${french ? 'AD' : 'RA'} ${String(hours).padStart(2, '0')}H ${String(minutes).padStart(2, '0')}M  ·  ${french ? 'DÉC' : 'DEC'} ${sign}${Math.abs(dec).toFixed(1)}°`,
      at.x,
      at.y + r + 52,
    );
    ctx.restore();
  }

  const showcase: Showcase = {
    design,
    selected: () => wrap(target),
    settled: () => move === null,
    offsetOf: (i) => offset(i, s, n, design.sky === 'path' ? -2 : design.id === 4 ? -1 : -n / 2),
    step(way) {
      goTo(target + Math.sign(way));
    },
    select(i, instant = false) {
      // The pile goes forward through its cards; the others take the shortest way.
      const forward = (((i - target) % n) + n) % n;
      const delta = design.id === 4 || forward <= n / 2 ? forward : forward - n;
      if (delta === 0 && !instant) return;
      goTo(target + delta, instant);
    },
    update(now) {
      if (!move) return false;
      if (move.start < 0) move.start = now;
      const t = Math.min(1, (now - move.start) / move.duration);
      s = move.from + (move.to - move.from) * easeInOut(t);
      if (t >= 1) {
        s = move.to;
        move = null;
      }
      return true;
    },
    pose: (i, view) => design.pose(i, s, n, view),
    planet(view) {
      if (!design.planet) return null;
      const ring = ringFor(design.id, view);
      return { x: ring.cx, y: ring.cy, diameter: (design.planet.diameter * view.height) / 900 };
    },
    draw(frame) {
      if (!context) return;
      const ctx = context;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.style.opacity = frame.presence.toFixed(3);
      ui.style.opacity = smooth(0.6, 0.95, frame.presence).toFixed(3);
      ui.style.pointerEvents = frame.presence > 0.9 ? 'auto' : 'none';
      ui.style.visibility = frame.presence > 0.01 ? 'visible' : 'hidden';
      if (frame.presence < 0.004) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (design.sky === 'ring') drawRing(ctx, frame);
      else if (design.sky === 'path') drawPath(ctx, frame);
      else if (design.sky === 'lens') drawLens(ctx, frame);
    },
    resize,
    stop() {
      ui.removeEventListener('click', onButton);
      canvas.remove();
      ui.remove();
      delete html.dataset.showcase;
    },
  };
  return showcase;
}

/**
 * The office at the end of the journey (office spec §3 to §6), around its live scene: the sky behind the canvas (its
 * gradient rising from the horizon, the glow behind the hills, the stars, the moon at dawn, thin clouds, a shooting
 * star now and then), the light-speed jump on the way in, the canvas, then the screen and the planet B 612 in front.
 * The HTML is placed in the frame's pixels, as in the mockup, and the frame covers the contact section.
 */
import { arrivalState, type ArrivalState } from './arrival';
import { coverFit, FRAMES, type Fit, type FrameSpec } from './frame';
import type { Framing } from './framings';
import { drawJump, jumpStars, prepareJump } from './jump';
import type { Head, OfficeScene, PictureSource } from './live';
import { MOMENTS } from './moments';
import { createScreen, type Screen } from './screen';
import { createCartels, type WallPicture } from './wall';
import { quadMatrix } from '../../lib/quad';
import { draw, frames } from '../../lib/wall';
import { blackout } from '../../motion/blackout';
import { rng } from './common';
import type { Moment } from '../time';

/** The screen's picture, 1280 × 800 like the 16:10 monitor. */
const SCREEN_PX = [1280, 800] as const;

export interface ViewOptions {
  moment: Moment;
  framing: Framing;
  still: boolean;
  /** The screen's template (`src/components/office/Screen.astro`), and the contact whose links it shows. */
  screen: HTMLTemplateElement | null;
  links: ParentNode;
  locale: string;
  /** Each frame's pictures, one of which it draws on each visit and each time the Recycle Bin is emptied. */
  pools: ReadonlyMap<string, readonly WallPicture[]>;
  /** The planet's name, on its label. */
  planetName: string;
}

export interface OfficeView {
  root: HTMLElement;
  /** The arrival's state at the last frame, for the contact's text. */
  state: ArrivalState;
  update(arrival: number, now: number, delta: number): void;
  /** Whether it still moves on its own (the head catching up with the mouse). */
  busy(): boolean;
  /** Puts the head at once where it leans (for captures). */
  setHead(x: number, y: number): void;
  resize(): void;
  dispose(): void;
}

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  parent?: HTMLElement,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  parent?.append(node);
  return node;
};

const px = (v: number): string => `${v.toFixed(1)}px`;

interface SkyStar {
  node: HTMLElement;
  op: number;
  dur: number;
  delay: number;
}

/** The sky's details, from the mockup's seeded draws (stars, then the town's windows, then the jump). */
function skyDetails(frame: FrameSpec, framing: Framing, moment: Moment, horizon: number) {
  const rand = rng(frame.seed);
  const mob = framing === 'mobile';
  const stars = [];
  for (let k = 0; k < (mob ? 7 : 11); k += 1) {
    const big = rand() < 0.3;
    const size = big ? 2.4 + rand() : 1.2 + rand() * 0.8;
    const x = frame.sky.x0 + rand() * (frame.sky.x1 - frame.sky.x0);
    const y = frame.sky.y0 + rand() * rand() * (frame.sky.y1 - frame.sky.y0);
    const op = (moment === 'aube' ? 0.55 : 0.75) * (0.5 + rand() * 0.5);
    const dur = Math.round(2600 + rand() * 4000);
    const delay = -Math.round(rand() * 6000);
    stars.push({ x, y, size, big, op, dur, delay });
  }
  // The town's windows that lit up now and then in the layers took two draws each; the live town lights its own.
  for (let k = 0; k < (mob ? 10 : 18) * 2; k += 1) rand();
  const tint = moment === 'aube' ? ['255, 214, 220', '214, 196, 236'] : ['255, 196, 160', '232, 160, 170'];
  const clouds = (
    [
      [0.1, horizon - (mob ? 120 : 150), mob ? 210 : 420, mob ? 9 : 12, 0],
      [0.48, horizon - (mob ? 170 : 230), mob ? 160 : 300, mob ? 7 : 9, 1],
      [0.62, horizon - (mob ? 80 : 96), mob ? 180 : 360, mob ? 8 : 10, 0],
      [0.2, horizon - (mob ? 220 : 280), mob ? 120 : 240, 6, 1],
    ] as const
  ).map(([fx, y, w, h, c], i) => ({
    x: frame.sky.x0 + fx * (frame.sky.x1 - frame.sky.x0) - w * 0.3,
    y,
    w,
    h,
    blur: mob ? 3 : 4,
    op: 0.42 - i * 0.05,
    bg: `linear-gradient(90deg, rgba(${tint[c] ?? ''}, 0), rgba(${tint[c] ?? ''}, 0.9) 35%, rgba(${tint[c] ?? ''}, 0.8) 65%, rgba(${tint[c] ?? ''}, 0))`,
    dur: 90000 + i * 23000,
  }));
  return { stars, clouds, jump: jumpStars(rand, frame.jumpStars) };
}

/** The moon's seas, as the full moon shows them: left, top, width, height (% of the disc) and depth. */
const SEAS = [
  [2, 22, 42, 58, 0.5],
  [20, 10, 38, 34, 0.6],
  [46, 16, 24, 24, 0.62],
  [50, 32, 30, 28, 0.6],
  [72, 24, 18, 18, 0.62],
  [28, 54, 26, 22, 0.48],
  [62, 46, 20, 22, 0.5],
] as const;

export function createOfficeView(section: HTMLElement, live: OfficeScene, options: ViewOptions): OfficeView {
  const { framing, moment } = options;
  const frame = FRAMES[framing];
  const M = MOMENTS[moment];
  const rest = live.rest;
  const horizon = rest.horizon;
  const mob = framing === 'mobile';
  const details = skyDetails(frame, framing, moment, horizon);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const calm = false;
  const headOn = !mob && !options.still && !reduce;

  const root = el('div', 'office-live');
  root.setAttribute('aria-hidden', 'true');
  const back = el('div', 'office-frame', root);
  root.append(live.element);
  const front = el('div', 'office-frame', root);
  [back, front].forEach((node) => {
    Object.assign(node.style, { width: px(frame.w), height: px(frame.h) });
  });

  // ---- Behind the canvas: the sky.
  const far = el('div', 'office-layer', back);
  const tilt = el('div', 'office-layer', far);
  const jumpCanvas = el('canvas', 'office-jump', tilt);
  const jumpMargin = 100;
  const jumpW = frame.w + 2 * jumpMargin;
  const jumpH = frame.h + frame.tiltSky + 2 * jumpMargin;
  Object.assign(jumpCanvas.style, {
    left: px(-jumpMargin),
    top: px(-frame.tiltSky - jumpMargin),
    width: px(jumpW),
    height: px(jumpH),
  });
  // The sky runs from the top of the rendered frame down to the horizon, under a fade from the black of space that
  // shows while the sky tilts down on the way in.
  const oy = -(Math.round(frame.h * 1.08) - frame.h) / 2;
  const L = horizon - oy;
  const skyFade = frame.tiltSky;
  const skyH = Math.round(frame.h * 1.08) + skyFade;
  const sky = el('div', 'office-sky', tilt);
  const stops = M.sky.map((c, i) => `${c} ${(skyFade + (L * i) / (M.sky.length - 1)).toFixed(1)}px`).join(', ');
  Object.assign(sky.style, {
    top: px(oy - skyFade),
    height: px(skyH),
    background: `linear-gradient(to bottom, ${M.sky[0] ?? ''}00 0px, ${stops}, ${M.sky.at(-1) ?? ''} 100%)`,
  });
  const glowR = Math.round(frame.w * 1.08) * 0.32;
  const glow = el('div', 'office-round', tilt);
  const glowRgb =
    M.glow.color
      .match(/[0-9a-f]{2}/gi)
      ?.map((h) => parseInt(h, 16))
      .join(', ') ?? '255, 220, 170';
  Object.assign(glow.style, {
    left: px(rest.glow[0] - glowR),
    top: px(horizon - glowR),
    width: px(glowR * 2),
    height: px(glowR * 2),
    background: `radial-gradient(circle, rgba(${glowRgb}, 1) 0%, rgba(${glowRgb}, 0) 70%)`,
  });
  // The setting sun's halo over the sky; the canvas screens its own twin over the hills and the town.
  const sunHalo = moment === 'crepuscule' ? el('div', 'office-round office-sun-halo', tilt) : null;
  const life = el('div', 'office-layer', tilt);
  const stars: SkyStar[] = details.stars.map((s) => {
    const node = el('span', 'office-round office-star', life);
    Object.assign(node.style, {
      left: px(s.x),
      top: px(s.y),
      width: px(s.size),
      height: px(s.size),
      opacity: String(s.op),
      boxShadow: s.big ? '0 0 6px 1px rgba(255, 255, 255, 0.35)' : 'none',
    });
    return { node, op: s.op, dur: s.dur, delay: s.delay };
  });
  if (moment === 'aube') {
    const [x, y, d] = frame.moon;
    const moonHalo = el('div', 'office-round office-moon-halo', life);
    Object.assign(moonHalo.style, { left: px(x - d * 3), top: px(y - d * 3), width: px(d * 6), height: px(d * 6) });
    const moon = el('div', 'office-round office-moon', life);
    Object.assign(moon.style, { left: px(x - d / 2), top: px(y - d / 2), width: px(d), height: px(d) });
    SEAS.forEach(([l, t, w, h, a]) => {
      const sea = el('span', 'office-round', moon);
      Object.assign(sea.style, {
        left: `${String(l)}%`,
        top: `${String(t)}%`,
        width: `${String(w)}%`,
        height: `${String(h)}%`,
        background: `radial-gradient(closest-side, rgba(128, 140, 170, ${String(a)}), rgba(128, 140, 170, 0))`,
      });
    });
  }
  const clouds = details.clouds.map((c) => {
    const node = el('div', 'office-round', life);
    Object.assign(node.style, {
      left: px(c.x),
      top: px(c.y),
      width: px(c.w),
      height: px(c.h),
      background: c.bg,
      filter: `blur(${String(c.blur)}px)`,
      opacity: String(c.op),
    });
    return { node, dur: c.dur };
  });
  const streak = (spec: FrameSpec['shoot'], className: string): HTMLElement => {
    const node = el('span', className, life);
    Object.assign(node.style, { left: px(spec.x), top: px(spec.y), width: px(spec.w) });
    return node;
  };
  const shoot = streak(frame.shoot, 'office-shoot');
  const welcome = streak(frame.welcome, 'office-welcome');
  const breath = el('div', 'office-round office-breath', tilt);
  Object.assign(breath.style, { left: px(frame.planet[0] - 16), top: px(frame.planet[1] - 16) });

  // ---- In front of the canvas: the screen, then the planet's button.
  const screen = el('div', 'office-screen', front);
  // Emptying the Recycle Bin: the view goes dark, every frame draws a new picture, and the view comes back.
  const empty = (): void => {
    void blackout(async () => {
      picks = draw(options.pools, picks);
      cartels.set(picks);
      // The new pictures, ready before the view comes back (or after a second at most).
      await new Promise<void>((resolve) => {
        let waiting = picks.size;
        const timer = setTimeout(resolve, 1000);
        live.setPictures(sourcesOf(picks), () => {
          sized += 1;
          repaint = true;
          waiting -= 1;
          if (waiting <= 0) {
            clearTimeout(timer);
            resolve();
          }
        });
      });
      desktop?.redrawn();
    });
  };
  const desktop: Screen | null = options.screen
    ? createScreen(options.screen, options.links, {
        mobile: mob,
        still: options.still,
        reduce,
        locale: options.locale,
        onEmpty: empty,
      })
    : null;
  if (desktop) screen.append(desktop.element);
  el('div', 'office-glare', screen);
  const cartels = createCartels(front, rest, framing, frame, new Set(frames.filter((f) => f.cartel).map((f) => f.id)));
  const skyFront = el('div', 'office-layer', front);
  const planet = el('div', 'office-planet', skyFront);
  Object.assign(planet.style, { left: px(frame.planet[0]), top: px(frame.planet[1]) });
  const button = el('button', 'office-planet-button', planet);
  button.type = 'button';
  button.tabIndex = -1;
  const label = el('div', 'office-planet-label', planet);
  el('span', 'office-planet-line', label);
  el('span', '', label).textContent = options.planetName;
  const showLabel = (on: boolean) => () => {
    label.classList.toggle('on', on && state.ep > 0.95);
  };
  button.addEventListener('pointerenter', showLabel(true));
  button.addEventListener('pointerleave', showLabel(false));
  button.addEventListener('click', () => {
    if (mob) label.classList.toggle('on');
  });

  section.append(root);

  // ---- Quiet life, on the compositor.
  const anims: Animation[] = [];
  const sine = 'cubic-bezier(0.37, 0, 0.63, 1)';
  if (!options.still && !reduce) {
    anims.push(
      breath.animate(
        [
          { transform: 'scale(0.9)', opacity: 0.8 },
          { transform: 'scale(1.1)', opacity: 1 },
        ],
        {
          duration: 3800,
          iterations: Infinity,
          direction: 'alternate',
          easing: sine,
        },
      ),
    );
    const sh = frame.shoot;
    const turn = `rotate(${((Math.atan2(-sh.dy, -sh.dx) * 180) / Math.PI).toFixed(1)}deg)`;
    const to = `translate(${String(sh.dx)}px, ${String(sh.dy)}px) ${turn}`;
    anims.push(
      shoot.animate(
        [
          { opacity: 0, transform: `translate(0px, 0px) ${turn}`, offset: 0 },
          { opacity: 1, offset: 0.012 },
          { opacity: 0, transform: to, offset: 0.06 },
          { opacity: 0, transform: to, offset: 1 },
        ],
        { duration: 17000, delay: -9000, iterations: Infinity, easing: 'linear' },
      ),
    );
    stars.forEach((s) =>
      anims.push(
        s.node.animate([{ opacity: s.op }, { opacity: s.op * 0.3 }], {
          duration: s.dur,
          delay: s.delay,
          iterations: Infinity,
          direction: 'alternate',
          easing: sine,
        }),
      ),
    );
    clouds.forEach((c, k) =>
      anims.push(
        c.node.animate([{ transform: 'translateX(-40px)' }, { transform: 'translateX(40px)' }], {
          duration: c.dur,
          delay: -c.dur * 0.3 * k,
          iterations: Infinity,
          direction: 'alternate',
          easing: sine,
        }),
      ),
    );
  }
  let playing = true;
  const play = (on: boolean): void => {
    if (on === playing) return;
    playing = on;
    // After the frame: playing or pausing an animation brings the page's style up to date.
    setTimeout(() => {
      anims.forEach((a) => {
        if (playing) a.play();
        else a.pause();
      });
      // Settled now rather than by the next frame's first read.
      section.getBoundingClientRect();
    });
  };

  // ---- The head follows the mouse, damped over about half a second.
  const head: Head & { tx: number; ty: number } = { x: 0, y: 0, tx: 0, ty: 0 };
  const onMove = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse') return;
    const box = section.getBoundingClientRect();
    head.tx = Math.max(-1, Math.min(1, ((event.clientX - box.left) / box.width) * 2 - 1));
    head.ty = Math.max(-1, Math.min(1, ((event.clientY - box.top) / box.height) * 2 - 1));
  };
  const onLeave = (): void => {
    head.tx = 0;
    head.ty = 0;
  };
  if (headOn) {
    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
  }

  // ---- Fitting the frame to the section.
  let fit: Fit = { k: 1, x: 0, y: 0 };
  const resize = (): void => {
    const width = section.clientWidth;
    const height = section.clientHeight;
    fit = coverFit(frame, width, height);
    const transform = `translate(${px(fit.x)}, ${px(fit.y)}) scale(${fit.k.toFixed(5)})`;
    back.style.transform = transform;
    front.style.transform = transform;
    live.resize(width, height, fit);
    const ratio = Math.min(2, window.devicePixelRatio || 1) * fit.k;
    jumpCanvas.width = Math.round(jumpW * ratio);
    jumpCanvas.height = Math.round(jumpH * ratio);
    drawnJump = '';
    sized += 1;
  };

  let state = arrivalState(1, frame, calm, mob);
  let drawnJump = '';
  let drawnScene = '';
  let sized = 0;
  let welcomed = false;
  let lastArrival = 1;
  // A picture that arrives once the scene is at rest needs one more draw.
  let repaint = false;
  const sourcesOf = (pictures: ReadonlyMap<string, WallPicture>): Map<string, PictureSource> =>
    new Map([...pictures].map(([id, picture]) => [id, { src: picture.src, focus: picture.focus }]));
  let picks = draw(options.pools);
  cartels.set(picks);
  live.setPictures(sourcesOf(picks), () => {
    sized += 1;
    repaint = true;
  });
  const setStyle = (node: HTMLElement, property: string, value: string): void => {
    if (node.style.getPropertyValue(property) !== value) node.style.setProperty(property, value);
  };
  const jumpCtx = jumpCanvas.getContext('2d');
  prepareJump(frame);

  resize();

  const view: OfficeView = {
    root,
    get state() {
      return state;
    },
    update(arrival, _now, delta) {
      state = arrivalState(arrival, frame, calm, mob);
      play(arrival > 0.01);
      // The head.
      const k = 1 - Math.exp(-Math.min(64, delta) / 520);
      head.x += (head.tx - head.x) * k;
      head.y += (head.ty - head.y) * k;
      if (Math.abs(head.tx - head.x) < 0.0005) head.x = head.tx;
      if (Math.abs(head.ty - head.y) < 0.0005) head.y = head.ty;
      const shift = (par: readonly [number, number]): string =>
        `translate3d(${(-head.x * par[0]).toFixed(2)}px, ${(-head.y * par[1]).toFixed(2)}px, 0)`;
      setStyle(far, 'transform', shift(frame.par.far));
      setStyle(skyFront, 'transform', shift(frame.par.far));
      const [sx, sy] = state.jump.shake;
      setStyle(tilt, 'transform', `translate(${sx.toFixed(2)}px, ${(sy + state.tiltSkyY).toFixed(1)}px)`);
      setStyle(planet, 'transform', `translate(${sx.toFixed(2)}px, ${(sy + state.tiltSkyY).toFixed(1)}px)`);
      // The sky rises from the horizon, like a quick sunrise.
      const yH = L + skyFade;
      const soft = 0.45 * yH;
      const yRev = yH + 40 - state.reveal * (yH + 40 + soft);
      const mask =
        state.reveal < 1
          ? `linear-gradient(to bottom, rgba(0, 0, 0, 0) ${(yRev - soft).toFixed(1)}px, #000000 ${yRev.toFixed(1)}px)`
          : 'none';
      setStyle(sky, 'mask-image', mask);
      setStyle(sky, '-webkit-mask-image', mask);
      setStyle(sky, 'opacity', state.skyOp.toFixed(3));
      setStyle(glow, 'opacity', (M.glow.strength * state.glowK).toFixed(3));
      setStyle(life, 'opacity', state.skyLifeOp.toFixed(3));
      setStyle(live.element, 'opacity', state.cityOp.toFixed(3));
      setStyle(button, 'pointer-events', arrival > 0.95 ? 'auto' : 'none');
      // The screen, the Recycle Bin and the cartels answer once the camera is at rest.
      const atRest = arrival > 0.95 && !options.still;
      desktop?.setLive(atRest);
      cartels.setLive(atRest);
      if (arrival <= 0.95) label.classList.remove('on');
      // The jump.
      const key = state.jump.on ? arrival.toFixed(4) : 'off';
      if (key !== drawnJump && jumpCtx) {
        drawnJump = key;
        jumpCtx.setTransform(1, 0, 0, 1, 0, 0);
        jumpCtx.clearRect(0, 0, jumpCanvas.width, jumpCanvas.height);
        if (state.jump.on) {
          const ratio = jumpCanvas.width / jumpW;
          jumpCtx.setTransform(ratio, 0, 0, ratio, jumpMargin * ratio, (frame.tiltSky + jumpMargin) * ratio);
          drawJump(jumpCtx, details.jump, frame, state);
        }
      }
      setStyle(jumpCanvas, 'opacity', state.jump.on ? state.jump.opacity.toFixed(3) : '0');
      // The scene, then the screen on its corners.
      // Nothing moved: the frame drawn last still holds.
      const sceneKey = `${arrival.toFixed(5)} ${head.x.toFixed(4)} ${head.y.toFixed(4)} ${String(sized)}`;
      if (sceneKey !== drawnScene) {
        drawnScene = sceneKey;
        repaint = false;
        const drawn = live.draw(state, head);
        cartels.move(head);
        setStyle(screen, 'visibility', drawn.screenShown ? 'visible' : 'hidden');
        if (drawn.screenShown) {
          setStyle(screen, 'transform', quadMatrix(SCREEN_PX[0], SCREEN_PX[1], drawn.placement.screen));
        }
        setStyle(screen, 'opacity', drawn.opacity.desk.toFixed(3));
        if (sunHalo && drawn.sun) {
          // In the sky's layer, which moves with the far sky and the tilt: the town's own moves are made up for.
          const [x, y, r] = drawn.sun;
          const d = r * 14;
          const left = x + head.x * frame.par.far[0] - sx - d / 2;
          const top = y + head.y * frame.par.far[1] - sy - state.tiltSkyY - d / 2;
          setStyle(sunHalo, 'width', px(d));
          setStyle(sunHalo, 'height', px(d));
          setStyle(sunHalo, 'transform', `translate(${left.toFixed(2)}px, ${top.toFixed(2)}px)`);
          setStyle(sunHalo, 'opacity', state.cityOp.toFixed(3));
        }
      }
      // Once per visit, when the camera comes to rest at the desk, a shooting star crosses the sky.
      if (!welcomed && !options.still && !reduce && lastArrival < 0.985 && arrival >= 0.985) {
        welcomed = true;
        const w = frame.welcome;
        const turn = `rotate(${((Math.atan2(-w.dy, -w.dx) * 180) / Math.PI).toFixed(1)}deg)`;
        welcome.animate(
          [
            { opacity: 0, transform: `translate(0px, 0px) ${turn}` },
            { opacity: 1, offset: 0.1 },
            { opacity: 1, offset: 0.45 },
            { opacity: 0, transform: `translate(${String(w.dx)}px, ${String(w.dy)}px) ${turn}` },
          ],
          { duration: 1100, delay: 250, easing: 'cubic-bezier(0.25, 0.6, 0.3, 1)', fill: 'both' },
        );
      }
      lastArrival = arrival;
    },
    resize,
    busy: () => repaint || head.x !== head.tx || head.y !== head.ty,
    setHead(x, y) {
      head.x = head.tx = x;
      head.y = head.ty = y;
    },
    dispose() {
      anims.forEach((a) => {
        a.cancel();
      });
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      desktop?.dispose();
      cartels.dispose();
      live.dispose();
      root.remove();
    },
  };
  return view;
}

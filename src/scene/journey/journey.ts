/**
 * The journey (journey spec): one scroll-driven move back from the Little Prince's planet, through the 8 projects, to
 * the contact. The page scrolls natively over a track of 12.5 screens, snapped on the anchors; the scene stays on
 * screen, and at every frame the camera follows the scroll and places the planet, the cards, their cartels, the small
 * worlds and the stars. The HTML stays the one of the list (no JavaScript, "reduce motion"): the journey only places
 * it, so a screen reader reads the projects in order, then the contact.
 */
import { anchors, cameraDepth, endClock, endProgress, endProgressAt, LAST_PROJECT, SCREENS } from './anchors';
import {
  cardLook,
  cartelPlace,
  cssTransform,
  farStarsScale,
  focusedCard,
  introFade,
  planetLook,
  smoothstep,
  still as noSway,
  worldLook,
  type Sway,
} from './camera';
import { sceneFor, type Scene } from './layout';
import { setJourney } from './registry';
import {
  anchorAt,
  anchorPositions,
  easeFrom,
  easeInOutCubic,
  glideDuration,
  settleAnchor,
  stepAnchor,
  wheelGestures,
} from './snap';
import { ambientClock } from '../../motion/ambient';
import { discCursor } from '../../motion/cursor';
import { drift, swing } from '../../motion/float';
import { isMenuOpen } from '../../motion/menu';
import { followPointer, tiltToward } from '../../motion/tilt';
import { onTick } from '../../motion/ticker';
import type { Matrix4 } from 'three';
import type { StarField } from '../stars/stars';
import type { Renderer } from '../renderer';
import type { Handoff } from '../planet/handoff';
import type { LivePlanet } from '../planet/planet';
import { withBase } from '../../lib/url';
import { frameSampler, isSlow, markSlow, type FrameSampler } from '../quality';

/** The moment's light on the scene (journey spec §4): how bright the planet's sky and the stars are. */
const LIGHT = {
  aube: { sky: 0.55, stars: 0.7 },
  crepuscule: { sky: 0.7, stars: 0.8 },
} as const;

/**
 * Writes styles only when they change, so that a resting scene costs the browser nothing, and remembers them, so
 * that the list gets its own styles back when the journey stops.
 */
function styler(): {
  set: (element: HTMLElement, property: string, value: string) => void;
  reset: () => void;
} {
  const last = new Map<HTMLElement, Map<string, string>>();
  return {
    set: (element, property, value) => {
      let values = last.get(element);
      if (!values) {
        values = new Map();
        last.set(element, values);
      }
      if (values.get(property) === value) return;
      values.set(property, value);
      element.style.setProperty(property, value);
    },
    reset: () => {
      last.forEach((values, element) => {
        values.forEach((_, property) => {
          element.style.removeProperty(property);
        });
      });
      last.clear();
    },
  };
}

/** At rest, the time between two frames, in ms. */
const AMBIENT_FRAME = 50;

interface CardParts {
  item: HTMLElement;
  place: HTMLElement;
  float: HTMLElement;
  link: HTMLAnchorElement;
  cartel: HTMLElement | null;
}

interface WorldParts {
  place: HTMLElement;
  body: HTMLElement;
}

export interface JourneyOptions {
  /** Frozen time: no drift, no floating, no twinkle (`?still=1`). */
  still: boolean;
  /** Draw the stars in WebGL (unless `?gl=0` or without WebGL). */
  webgl: boolean;
}

/** Starts the journey in `root`; returns a function that stops it and gives the page back its list. */
export function startJourney(root: HTMLElement, options: JourneyOptions): () => void {
  const stageFound = root.querySelector<HTMLElement>('[data-stage]');
  const trackFound = root.querySelector<HTMLElement>('[data-track]');
  const spaceFound = root.querySelector<HTMLElement>('.journey');
  if (!stageFound || !trackFound || !spaceFound) return () => undefined;
  const stage: HTMLElement = stageFound;
  const track: HTMLElement = trackFound;
  const world3d: HTMLElement = spaceFound;
  const html = document.documentElement;
  const styles = styler();
  const set = styles.set;

  const opening = root.querySelector<HTMLElement>('.opening');
  const decorGroup = root.querySelector<HTMLElement>('.planet');
  const decor = root.querySelector<HTMLElement>('.decor');
  const halo = root.querySelector<HTMLElement>('.halo');
  const planet = root.querySelector<HTMLElement>('.planet-image');
  const planetFrame = root.querySelector<HTMLElement>('.planet-frame');
  const glow = root.querySelector<HTMLElement>('.planet-glow');
  const intro = root.querySelector<HTMLElement>('.intro');
  const cta = root.querySelector<HTMLAnchorElement>('.cta');
  const contact = root.querySelector<HTMLElement>('.contact');
  const office = contact?.querySelector<HTMLElement>('.office') ?? null;
  const contactText = contact?.querySelectorAll<HTMLElement>('.text, .copyright') ?? [];
  const cursorElement = root.querySelector<HTMLElement>('[data-cursor]');
  const cursor = cursorElement ? discCursor(cursorElement) : null;

  const cards: CardParts[] = [...root.querySelectorAll<HTMLElement>('[data-project]')].flatMap((item) => {
    const place = item.querySelector<HTMLElement>('.place');
    const float = item.querySelector<HTMLElement>('.float');
    const link = item.querySelector<HTMLAnchorElement>('a.card');
    if (!place || !float || !link) return [];
    return [{ item, place, float, link, cartel: item.querySelector<HTMLElement>('.cartel') }];
  });

  // The fragments the journey answers, by anchor: the opening, the first project, each project, the contact.
  const fragmentAnchor = new Map<string, number>();
  if (opening?.id) fragmentAnchor.set(opening.id, 0);
  if (world3d.id) fragmentAnchor.set(world3d.id, 1);
  cards.forEach(({ item }, i) => fragmentAnchor.set(item.id, i + 1));
  if (contact?.id) fragmentAnchor.set(contact.id, anchors.length - 1);

  let scene: Scene;
  let worlds: WorldParts[] = [];
  /** The screen's height the track was laid out for, in px. */
  let screen = 0;
  let positions: number[] = [];
  let range = 1;
  let planetRest = { x: 0, y: 0 };
  let planetSize = 0;

  // The camera: where the scroll is (target), where the camera is (current), its speed through the end.
  let target = 0;
  let current = 0;
  let endSpeed = 0;
  let focus = -1;
  let hovered = -1;
  /** Whether the next frame must be drawn, even at rest. */
  let redraw = false;
  let direction = 0;
  let lastScroll = window.scrollY;
  // The scroll position as last known, so that drawing a frame never reads it back (which would force a layout).
  let scrolled = lastScroll;

  const markers = anchors.map(() => {
    const marker = document.createElement('div');
    marker.className = 'journey-anchor';
    track.append(marker);
    return marker;
  });

  function layout(): void {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    scene = sceneFor(width, height);
    const { view } = scene;
    screen = height;
    range = SCREENS * screen;
    positions = anchorPositions(anchors, SCREENS, screen);
    set(track, 'height', `${String(Math.round(range + screen))}px`);
    markers.forEach((marker, i) => {
      marker.style.top = `${String(positions[i] ?? 0)}px`;
    });

    set(world3d, 'perspective', `${view.perspective.toFixed(1)}px`);
    set(world3d, 'perspective-origin', `${view.vpX.toFixed(1)}px ${view.vpY.toFixed(1)}px`);
    set(world3d, '--vp-x', `${view.vpX.toFixed(1)}px`);
    set(world3d, '--vp-y', `${view.vpY.toFixed(1)}px`);
    scene.cards.forEach((place, i) => {
      const link = cards[i]?.link;
      if (!link) return;
      set(link, 'width', `${place.width.toFixed(1)}px`);
      set(link, 'height', `${place.height.toFixed(1)}px`);
      set(link, 'left', `${(-place.width / 2).toFixed(1)}px`);
      set(link, 'top', `${(-place.height / 2).toFixed(1)}px`);
    });

    const framing = view.mobile ? 'mobile' : 'desktop';
    worlds = scene.worlds.flatMap((world, i) => {
      const place = root.querySelector<HTMLElement>(`.world[data-framing='${framing}'][data-world='${String(i)}']`);
      const body = place?.querySelector<HTMLElement>('.body');
      if (!place || !body) return [];
      set(place, '--s', `${world.size.toFixed(2)}px`);
      return [{ place, body }];
    });

    // Where the planet sits on the opening, from the vanishing point: the opening's CSS decides it.
    if (planet) {
      const saved = planet.style.transform;
      planet.style.transform = 'none';
      const box = planet.getBoundingClientRect();
      planet.style.transform = saved;
      planetRest = { x: box.left + box.width / 2 - view.vpX, y: box.top + box.height / 2 - view.vpY };
      planetSize = box.width;
    }
  }

  layout();

  // ---------- Stars, drawn in WebGL once Three.js has loaded ----------

  let renderer: Renderer | null = null;
  let stars: StarField | null = null;
  let stopped = false;
  let swayMatrixOf: ((sway: Sway) => Matrix4) | null = null;
  if (options.webgl) {
    void Promise.all([import('../renderer'), import('../stars/stars'), import('./camera3d')]).then(
      ([{ createRenderer }, { createStars }, { swayMatrix }]) => {
        if (stopped) return;
        try {
          renderer = createRenderer(stage, scene.view);
        } catch {
          // Without WebGL, the journey goes on without its stars.
          return;
        }
        stars = createStars(scene.stars, scene.view, renderer.pixelRatio);
        renderer.scene.add(stars.points);
        swayMatrixOf = swayMatrix;
        stars.points.matrixAutoUpdate = false;
        html.dataset.stars = 'webgl';
        redraw = true;
      },
    );
  }

  function rebuildStars(): void {
    if (!renderer || !stars) return;
    renderer.resize(scene.view);
    renderer.scene.remove(stars.points);
    stars.dispose();
    void import('../stars/stars').then(({ createStars }) => {
      if (stopped || !renderer) return;
      stars = createStars(scene.stars, scene.view, renderer.pixelRatio);
      stars.points.matrixAutoUpdate = false;
      renderer.scene.add(stars.points);
      redraw = true;
    });
  }

  // ---------- The live planet ----------

  // It loads once the ambient motions start, while the camera is near the opening, and is let go from the middle of
  // the journey on, so that its GPU memory is free before the office.
  const PLANET_KEEP = anchors[3] ?? 0.3;
  const PLANET_FREE = anchors[4] ?? 0.4;
  /** The planet's blur, in px, past which it is only a blurred light: the image shows instead. */
  const PLANET_SHARP = 3;
  let livePlanet: LivePlanet | null = null;
  let handoff: Handoff | null = null;
  let planetLoading = false;
  let lastPlanetDraw = 0;
  // Its first seconds on screen are measured: too slow, it gives way to its image for the rest of the visit.
  let planetSampler: FrameSampler | null = null;
  // `?planete=live` keeps it whatever the rate, for tests and captures on machines without a GPU.
  const planetForced = new URLSearchParams(location.search).get('planete') === 'live';
  let planetSlow = !planetForced && isSlow('planet');

  function loadPlanet(): void {
    if (planetLoading || !planet) return;
    const container = planet;
    planetLoading = true;
    void Promise.all([import('../planet/planet'), import('../planet/handoff')])
      .then(async ([{ createPlanet, SlowRenderer }, { planetHandoff }]) => {
        const created = await createPlanet(container, {
          modelUrl: withBase('/models/petit-prince.glb'),
          forced: planetForced,
          moment: html.dataset.moment === 'aube' ? 'aube' : 'crepuscule',
          mobile: scene.view.mobile,
          size: planetSize,
        }).catch((error: unknown) => {
          if (error instanceof SlowRenderer) {
            planetSlow = true;
            markSlow('planet');
          }
          throw error;
        });
        if (stopped || !planetLoading) {
          created.dispose();
          return;
        }
        livePlanet?.dispose();
        livePlanet = created;
        handoff = planetHandoff(container, created.canvas);
        planetSampler = planetForced ? null : frameSampler();
        redraw = true;
      })
      .catch(() => {
        // Without WebGL or the model, the fallback image stays.
      });
  }

  function freePlanet(): void {
    planetLoading = false;
    handoff?.reset();
    livePlanet?.dispose();
    livePlanet = null;
    handoff = null;
    delete html.dataset.planet;
  }

  /** Draws the live planet when it shows, loads it near the opening and lets it go past the middle. */
  function drawPlanet(now: number, u: number, blur: number, moment: 'aube' | 'crepuscule'): void {
    if (!options.webgl || planetSlow) return;
    if (u > PLANET_FREE) {
      if (planetLoading) freePlanet();
      return;
    }
    if (!livePlanet || !handoff) {
      if (ambient.started() && u <= PLANET_KEEP) loadPlanet();
      return;
    }
    const previousDraw = lastPlanetDraw;
    const delta = ambient.started() && !options.still ? Math.min(100, now - previousDraw) : 0;
    lastPlanetDraw = now;
    const draws = handoff.update(blur < PLANET_SHARP, now);
    html.dataset.planet = handoff.state();
    if (!draws) return;
    livePlanet.setMoment(moment);
    livePlanet.render(delta);
    if (planetSampler && previousDraw > 0) {
      // Measured at every frame, not at the resting pace.
      redraw = true;
      const verdict = planetSampler.add(now - previousDraw);
      if (verdict === 'fast') planetSampler = null;
      else if (verdict === 'slow') {
        planetSlow = true;
        markSlow('planet');
        freePlanet();
      }
    }
  }

  // ---------- Following the scroll ----------

  const progressOf = (scroll: number): number => Math.max(0, Math.min(1, scroll / range));

  function followCamera(delta: number): void {
    const edge = LAST_PROJECT - 1 / range;
    if (current >= edge && target >= edge) {
      // Through the end, the camera runs on its own clock: it speeds up, cruises and slows down at the same pace both
      // ways, so the arrival at the office and the way back take the same 3.5 s, even in one gesture.
      const q = endClock(current);
      const goal = endClock(target);
      const d = goal - q;
      const vmax = 1 / 3200;
      const acc = vmax / 300;
      const want = Math.sign(d) * Math.min(vmax, Math.sqrt(2 * acc * Math.abs(d)));
      endSpeed += Math.max(-acc * delta, Math.min(acc * delta, want - endSpeed));
      const next = q + endSpeed * delta;
      if (Math.abs(d) < 1e-5 || (d > 0 && next >= goal) || (d < 0 && next <= goal)) {
        current = target;
        endSpeed = 0;
      } else {
        current = endProgressAt(next);
      }
      return;
    }
    // Elsewhere it eases toward the scroll, like a light inertia.
    const before = current;
    current += (target - current) * (1 - Math.exp(-delta / (scene.view.mobile ? 150 : 130)));
    if (Math.abs(target - current) < 0.00002) current = target;
    // Entering the end, the clock takes over at the speed the camera had.
    endSpeed = Math.max(-1 / 3200, Math.min(1 / 3200, (endClock(current) - endClock(before)) / delta || 0));
  }

  // ---------- Gliding from anchor to anchor ----------

  let glide: { from: number; to: number; start: number; duration: number; ease: (t: number) => number } | null = null;

  function setSnap(on: boolean): void {
    html.style.scrollSnapType = on ? '' : 'none';
  }

  function endGlide(): void {
    glide = null;
    setSnap(true);
  }

  /**
   * Glides to the anchor at `index`, the snapping paused, without ever blocking the scroll. `speed` (px/ms, toward
   * the anchor) is the speed of the finger that started it.
   */
  function glideTo(index: number, speed = 0): void {
    const to = positions[index];
    if (to === undefined) return;
    if (glide?.to === to) return;
    endGlide();
    const from = window.scrollY;
    if (Math.abs(to - from) < 2) return;
    direction = Math.sign(to - from);
    setSnap(false);
    const duration = glideDuration(to - from);
    const ease = speed > 0 ? easeFrom((speed * duration) / Math.abs(to - from)) : easeInOutCubic;
    glide = { from, to, start: -1, duration, ease };
  }

  /** Moves the glide on by a frame. It runs first in the frame, before any style is written, so that scrolling
   * never forces a layout. */
  function stepGlide(now: number): void {
    if (!glide) return;
    if (glide.start < 0) glide.start = now;
    const t = Math.min(1, (now - glide.start) / glide.duration);
    const top = glide.from + (glide.to - glide.from) * glide.ease(t);
    window.scrollTo({ top, behavior: 'instant' });
    scrolled = top;
    target = progressOf(top);
    if (t >= 1) endGlide();
  }

  /** Lands at once on the anchor at `index`: the camera jumps there too. */
  function jumpTo(index: number): void {
    endGlide();
    const top = positions[index] ?? 0;
    window.scrollTo({ top, behavior: 'instant' });
    scrolled = top;
    target = progressOf(top);
    current = target;
    endSpeed = 0;
    lastScroll = top;
    draw(performance.now());
  }

  // A scroll left between two anchors (a browser without snapping, an interrupted glide) comes to rest on one.
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  let touching = false;
  function settleSoon(): void {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      if (glide || touching) return;
      const at = window.scrollY;
      if (anchorAt(at, positions) < 0) glideTo(settleAnchor(at, positions, direction));
    }, 220);
  }

  const onScroll = (): void => {
    const now = window.scrollY;
    scrolled = now;
    if (now !== lastScroll) direction = Math.sign(now - lastScroll);
    lastScroll = now;
    target = progressOf(now);
    settleSoon();
  };
  const interrupt = (): void => {
    if (glide) endGlide();
  };
  // The wheel goes anchor by anchor: one gesture, one anchor, whatever the device sends.
  const gestureOf = wheelGestures();
  const onWheel = (event: WheelEvent): void => {
    // A pinch on a trackpad, or ctrl and the wheel, zooms the page.
    if (event.ctrlKey || event.deltaY === 0) return;
    event.preventDefault();
    const started = gestureOf(event.deltaY, event.timeStamp);
    if (started === 0) return;
    direction = started;
    const from = glide ? glide.to : window.scrollY;
    glideTo(stepAnchor(from, positions, started));
  };
  // A finger goes anchor by anchor too: a swipe of more than a few px leads to the next anchor in its direction, from
  // the anchor it started on; a shorter touch comes back to it. The snapping waits while the finger is down, so that
  // it never starts a move the glide would then undo.
  let touchStartY = 0;
  let touchY = 0;
  let touchFrom = 0;
  let touchTime = 0;
  let touchSpeed = 0;
  let pinching = false;
  const onTouchStart = (event: TouchEvent): void => {
    // Two fingers zoom the page: not a swipe.
    pinching = event.touches.length > 1;
    if (pinching) return;
    touchFrom = glide ? glide.to : window.scrollY;
    interrupt();
    setSnap(false);
    touching = true;
    touchStartY = event.touches[0]?.clientY ?? 0;
    touchY = touchStartY;
    touchTime = event.timeStamp;
    touchSpeed = 0;
  };
  const onTouchMove = (event: TouchEvent): void => {
    const y = event.touches[0]?.clientY ?? touchY;
    if (y !== touchY) direction = Math.sign(touchY - y);
    // The finger's speed, smoothed, in px/ms (positive: scrolling down).
    const dt = Math.max(1, event.timeStamp - touchTime);
    touchSpeed = 0.6 * touchSpeed + 0.4 * ((touchY - y) / dt);
    touchTime = event.timeStamp;
    touchY = y;
  };
  const onTouchEnd = (event: TouchEvent): void => {
    if (event.touches.length > 0) return;
    touching = false;
    if (pinching) {
      setSnap(true);
      return;
    }
    const moved = touchStartY - touchY;
    if (Math.abs(moved) > 40) {
      const way = Math.sign(moved);
      glideTo(stepAnchor(touchFrom, positions, way), Math.max(0, touchSpeed * way));
    } else {
      glideTo(settleAnchor(touchFrom, positions, 0));
    }
  };

  // The keys go anchor by anchor, whatever the browser's snapping does with them.
  const onKey = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const element = event.target instanceof HTMLElement ? event.target : null;
    if (element?.closest('input, textarea, select, [contenteditable], [role="dialog"]')) return;
    if (isMenuOpen()) return;
    const at = glide ? glide.to : window.scrollY;
    let index: number | undefined;
    if (event.key === 'ArrowDown' || event.key === 'PageDown' || (event.key === ' ' && !event.shiftKey)) {
      index = stepAnchor(at, positions, 1);
    } else if (event.key === 'ArrowUp' || event.key === 'PageUp' || (event.key === ' ' && event.shiftKey)) {
      index = stepAnchor(at, positions, -1);
    } else if (event.key === 'Home') {
      index = 0;
    } else if (event.key === 'End') {
      index = positions.length - 1;
    }
    if (index === undefined) return;
    // A space on a link or a button is the browser's.
    if (event.key === ' ' && element?.closest('a, button')) return;
    event.preventDefault();
    glideTo(index);
  };

  // Tab goes from project to project: the camera glides to the project that gets the focus, then Enter opens it.
  const onFocus = (event: FocusEvent): void => {
    const element = event.target instanceof Element ? event.target : null;
    const item = element?.closest<HTMLElement>('[data-project]');
    if (item) {
      const index = Number(item.dataset.project);
      if (focus !== index) glideTo(index + 1);
      return;
    }
    if (contact && element && contact.contains(element)) glideTo(positions.length - 1);
  };

  // A blurred card comes into focus first; the sharp one opens.
  const onClick = (event: MouseEvent): void => {
    const element = event.target instanceof Element ? event.target : null;
    if (cta && element?.closest('.cta') === cta) {
      event.preventDefault();
      glideTo(1);
      return;
    }
    const link = element?.closest<HTMLAnchorElement>('a.card');
    const item = link?.closest<HTMLElement>('[data-project]');
    if (!item) return;
    const index = Number(item.dataset.project);
    if (index !== focus) {
      event.preventDefault();
      event.stopImmediatePropagation();
      glideTo(index + 1);
    }
  };

  const onOver = (event: PointerEvent): void => {
    const element = event.target instanceof Element ? event.target : null;
    const item = element?.closest<HTMLElement>('[data-project]');
    hovered = item && element?.closest('a.card') ? Number(item.dataset.project) : -1;
    redraw = true;
  };

  // A fragment in the address (an old link, a case study's way back) lands directly on its anchor.
  const onHash = (): void => {
    const index = fragmentAnchor.get(decodeURIComponent(location.hash.slice(1)));
    if (index !== undefined) jumpTo(index);
  };

  let resizeFrame = 0;
  const onResize = (): void => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      const width = stage.clientWidth;
      const height = stage.clientHeight;
      // On phones, the address bar coming and going changes the height a little: the journey keeps its track.
      const mobile = width < 768;
      if (width === scene.view.width && (Math.abs(height - screen) < (mobile ? 160 : 1) || height === screen)) {
        if (renderer && height !== scene.view.height) {
          scene = { ...scene, view: { ...scene.view, height } };
          renderer.resize(scene.view);
          stars?.resize(scene.view, renderer.pixelRatio);
        }
        return;
      }
      const progress = current;
      layout();
      rebuildStars();
      livePlanet?.resize(planetSize, scene.view.mobile);
      jumpTo(settleAnchor(Math.round(progress * range), positions, 0));
    });
  };

  const pointer = followPointer(window);
  const ambient = ambientClock();

  // ---------- Drawing a frame ----------

  function draw(now: number): void {
    const { view } = scene;
    const u = current;
    const depth = cameraDepth(u);
    const tEnd = endProgress(u);
    const arrival = Math.max(0, Math.min(1, (tEnd - 0.2) / 0.8));
    const starsK = 1 - smoothstep(0, 0.04, arrival);
    const time = options.still ? 0 : ambient.time(now);
    const moment = html.dataset.moment === 'aube' ? 'aube' : 'crepuscule';
    const light = LIGHT[moment];
    const tiltOn = !view.mobile && !options.still;
    const sway: Sway = options.still
      ? noSway
      : { ...drift(time), ...(tiltOn ? tiltToward(pointer.pointer) : { tiltX: 0, tiltY: 0 }) };

    // The cards and their cartels.
    focus = focusedCard(scene.cards, depth, focus);
    scene.cards.forEach((place, i) => {
      const parts = cards[i];
      if (!parts) return;
      const look = cardLook(place, depth);
      const shown = look.opacity > 0.004;
      const lit = focus === i;
      set(parts.place, 'transform', cssTransform(place.x, place.y, look.depth, view, sway));
      const lift = options.still ? 0 : 12 * swing(time, place.floatDuration, place.floatDelay);
      set(parts.float, 'transform', `translateY(${lift.toFixed(2)}px)`);
      set(parts.link, 'opacity', look.opacity.toFixed(3));
      set(parts.link, 'filter', shown && look.blur > 0.05 ? `blur(${look.blur.toFixed(2)}px)` : 'none');
      set(parts.link, 'pointer-events', look.opacity > 0.3 ? 'auto' : 'none');
      set(
        parts.link,
        'transform',
        `rotateY(${place.rotateY.toFixed(2)}deg) rotateZ(${place.rotateZ.toFixed(2)}deg) translateZ(${lit && hovered === i ? '24' : '0'}px)`,
      );
      parts.item.classList.toggle('lit', lit);
      if (parts.cartel) {
        const cartel = cartelPlace(place, look, view);
        set(parts.cartel, 'translate', `${cartel.x.toFixed(1)}px ${cartel.y.toFixed(1)}px`);
        set(parts.cartel, '--cartel-width', `${cartel.width.toFixed(1)}px`);
      }
    });

    // The small worlds.
    scene.worlds.forEach((world, i) => {
      const parts = worlds[i];
      if (!parts) return;
      const look = worldLook(world, depth);
      const shown = look.opacity >= 0.01;
      set(parts.body, 'visibility', shown ? 'visible' : 'hidden');
      if (!shown) return;
      set(parts.place, 'transform', cssTransform(world.x, world.y, look.depth, view, sway));
      set(parts.body, 'opacity', (look.opacity * (0.55 + 0.45 * light.stars) * starsK).toFixed(3));
      set(parts.body, 'filter', look.blur > 0.05 ? `blur(${look.blur.toFixed(2)}px)` : 'none');
      const s = options.still ? 0 : swing(time, world.floatDuration, world.floatDelay);
      set(parts.body, 'translate', `${(4 * s).toFixed(2)}px ${(-3 * s).toFixed(2)}px`);
    });

    // The planet recedes to a point of light, drifting toward the vanishing point.
    const planetState = planetLook(depth, light.sky, arrival);
    const sP = planetState.scale;
    const mid = tiltOn ? { x: pointer.pointer.x * 14 * (1 - sP), y: pointer.pointer.y * 8 * (1 - sP) } : { x: 0, y: 0 };
    const dx = planetRest.x * (sP - 1) + mid.x + sway.dx;
    const dy = planetRest.y * (sP - 1) + mid.y + sway.dy;
    const group = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) rotate(${sway.roll.toFixed(3)}deg)`;
    if (decorGroup) set(decorGroup, 'transform', `${group} scale(${sP.toFixed(4)})`);
    if (decor) set(decor, 'opacity', planetState.decorOpacity.toFixed(3));
    if (halo) set(halo, 'opacity', planetState.haloOpacity.toFixed(3));
    if (planet) {
      const bob = options.still ? 0 : swing(time, 7000);
      set(
        planet,
        'transform',
        `${group} scale(${sP.toFixed(4)}) translateY(${(10 * bob).toFixed(2)}px) rotate(${bob.toFixed(3)}deg)`,
      );
      set(planet, 'opacity', planetState.opacity.toFixed(3));
      if (planetFrame) {
        set(planetFrame, 'filter', planetState.blur > 0.05 ? `blur(${planetState.blur.toFixed(2)}px)` : 'none');
      }
    }
    if (glow) {
      set(glow, 'transform', group);
      set(glow, 'opacity', planetState.glowOpacity.toFixed(3));
    }
    drawPlanet(now, u, planetState.blur, moment);
    // The office loads from the first project on.
    if (u >= (anchors[1] ?? 0) - 0.01) html.dataset.office = 'near';

    // The opening's text stays, then fades out rising; the call to action leaves at the first move.
    const fade = introFade(depth);
    if (intro) {
      set(intro, 'opacity', (1 - fade).toFixed(3));
      set(intro, 'transform', `translateY(${(-16 * fade).toFixed(1)}px)`);
      set(intro, 'pointer-events', fade < 0.5 ? 'auto' : 'none');
    }
    html.dataset.introFaded = fade > 0.98 ? 'true' : 'false';
    if (cta) {
      const atOpening = depth < 0.004;
      set(cta, 'opacity', atOpening ? '1' : '0');
      set(cta, 'visibility', atOpening ? 'visible' : 'hidden');
    }

    // The end: the office arrives, then the contact (the live arrival comes with the 3D office, step 7).
    if (contact) {
      set(contact, 'opacity', smoothstep(0, 0.5, arrival).toFixed(3));
      set(contact, 'pointer-events', arrival > 0.95 ? 'auto' : 'none');
      if (office) set(office, 'transform', `scale(${(1.08 - 0.08 * easeInOutCubic(arrival)).toFixed(4)})`);
      contactText.forEach((element) => {
        set(element, 'opacity', smoothstep(0.55, 1, arrival).toFixed(3));
      });
    }

    // The click hint over the sharp card.
    if (cursor) {
      const lit = cards[focus];
      cursor.update(
        pointer.pointer.clientX,
        pointer.pointer.clientY,
        !view.mobile && lit !== undefined && hovered === focus,
      );
    }

    // The stars.
    if (renderer && stars && swayMatrixOf) {
      stars.update({
        time,
        depth,
        farScale: farStarsScale(depth),
        farShiftX: (tiltOn ? pointer.pointer.x * 18 : 0) + sway.dx,
        farShiftY: (tiltOn ? pointer.pointer.y * 11 : 0) + sway.dy,
        farOpacity: light.stars * starsK,
        farFade: 1 - smoothstep(0.15, 0.75, tEnd),
        nearOpacity: (0.55 + 0.45 * light.stars) * starsK,
      });
      stars.points.matrix.copy(swayMatrixOf(sway));
      stars.points.matrixWorldNeedsUpdate = true;
      renderer.render();
    }

    // Where the camera rests, for the navigation and the tests.
    const resting = current === target && !glide ? anchorAt(scrolled, positions) : -1;
    root.dataset.anchor = resting >= 0 ? String(resting) : '';
  }

  // ---------- Start ----------

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: true });
  window.addEventListener('touchend', onTouchEnd, { passive: true });
  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', onResize);
  window.addEventListener('hashchange', onHash);
  root.addEventListener('focusin', onFocus);
  root.addEventListener('click', onClick, true);
  root.addEventListener('pointerover', onOver);

  if (fragmentAnchor.has(decodeURIComponent(location.hash.slice(1)))) onHash();
  else {
    // Back on the home without a fragment, the journey starts where the scroll is, on its nearest anchor.
    jumpTo(settleAnchor(window.scrollY, positions, 0));
  }

  // At rest, only the weightless motions move, by a few px per second: drawn 20 times a second, they look the same
  // and leave the main thread free. A glide, the camera catching up, the mouse or a hover draw at every frame.
  let lastDraw = 0;
  // The glide scrolls first in the frame, before the job title or anything else writes a style.
  const stopGlideTick = onTick(stepGlide, { first: true });
  const stopTick = onTick((now, delta) => {
    pointer.update(delta);
    followCamera(delta);
    const atRest = !glide && current === target && pointer.settled() && !redraw;
    // Before the ambient motions start, nothing moves at rest: the frame drawn last still holds.
    if (atRest && (now - lastDraw < AMBIENT_FRAME || !ambient.started())) return;
    lastDraw = now;
    redraw = false;
    draw(now);
  });

  setJourney({
    has: (id) => fragmentAnchor.has(id),
    isAt: (id) => {
      const index = fragmentAnchor.get(id);
      return index !== undefined && anchorAt(scrolled, positions) === index && current === target;
    },
    jumpTo: (id) => {
      const index = fragmentAnchor.get(id);
      if (index !== undefined) jumpTo(index);
    },
    glideTo,
  });

  return () => {
    stopped = true;
    stopTick();
    stopGlideTick();
    endGlide();
    pointer.stop();
    ambient.stop();
    clearTimeout(settleTimer);
    cancelAnimationFrame(resizeFrame);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('touchend', onTouchEnd);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('hashchange', onHash);
    root.removeEventListener('focusin', onFocus);
    root.removeEventListener('click', onClick, true);
    root.removeEventListener('pointerover', onOver);
    setJourney(null);
    stars?.dispose();
    renderer?.dispose();
    freePlanet();
    markers.forEach((marker) => {
      marker.remove();
    });
    delete html.dataset.stars;
    delete html.dataset.introFaded;
    delete html.dataset.office;
    styles.reset();
    cards.forEach(({ item }) => {
      item.classList.remove('lit');
    });
    root.dataset.anchor = '';
  };
}

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
  diveLook,
  farStarsScale,
  focusedCard,
  introFade,
  planetLook,
  smoothstep,
  still as noSway,
  worldLook,
  type Sway,
} from './camera';
import { sceneFor, type Scene, type View } from './layout';
import { setJourney } from './registry';
import {
  anchorAt,
  anchorPositions,
  easeFrom,
  easeInOutCubic,
  glideDuration,
  nearestAnchor,
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
import type { OfficeView } from '../office/view';
import { withBase } from '../../lib/url';
import { frameSampler, isSlow, markSlow, SAMPLE_TIME, type FrameSampler } from '../quality';

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

/** How far in front of the cards the cartels sit, in px (see where they are placed). */
const CARTEL_Z = 120;

/** How far the sharp card stands out toward the mouse over it, in px. */
const HOVER_LIFT = 24;
/** The dive (journey spec §6): the card's flight, the rest fading out over its first third. */
const DIVE_MS = 900;
/** Before the dive, the camera's sway comes to rest; it comes back as long after the way back. */
const SWAY_REST_MS = 600;
/**
 * Scroll left under the contact, in px, past the screen the page already keeps there. A phone's bar that hides or
 * shows changes the screen's height before the journey hears of it (Firefox on Android shows its bar again at the
 * bottom of a page): without this margin, the end of the page could stop short of the contact for a moment, and the
 * snapping would then send the page back to the last project.
 */
const TRACK_SLACK = 200;
const easeOut = (t: number): number => 1 - Math.pow(1 - t, 3);

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

/** The journey's own floor, in frames per second over the projects: under it, the list takes over. */
const JOURNEY_MIN_FPS = 25;

export interface JourneyOptions {
  /** Frozen time: no drift, no floating, no twinkle (`?still=1`). */
  still: boolean;
  /** Draw the stars in WebGL (unless `?gl=0` or without WebGL). */
  webgl: boolean;
  /**
   * Called when this device is found too slow for the journey, once the camera rests: the page turns to the list, on
   * the project shown (its fragment), or at its top.
   */
  onLite?: (fragment: string | null) => void;
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
  // Firefox sorts everything in one 3D scene plane by plane: a card's dark shadow, in the card's own plane, would
  // now and then be drawn over the card. There each card is flattened into its own picture, the perspective of its
  // turn given by its own frame, seen from the vanishing point at the card's distance: the same drawing, in one plane.
  const flatCards = CSS.supports('-moz-appearance', 'none');
  const cardPerspective = (parts: CardParts, x: number, y: number, depth: number, lift: number, view: View): void => {
    if (!flatCards) return;
    set(parts.float, 'perspective', `${Math.max(1, view.perspective * (1 - depth)).toFixed(1)}px`);
    set(parts.float, 'perspective-origin', `${(-x).toFixed(1)}px ${(-y - lift).toFixed(1)}px`);
  };

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
  const contactText = contact?.querySelectorAll<HTMLElement>('.text') ?? [];
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
  // And the other way: each anchor's first fragment (the projects' rather than the first project's).
  const anchorFragment = new Map<number, string>();
  for (const [id, index] of fragmentAnchor) if (!anchorFragment.has(index)) anchorFragment.set(index, id);

  let scene: Scene;
  let worlds: WorldParts[] = [];
  /** The screen's height the track was laid out for, in px. */
  let screen = 0;
  /** The screen's height the track's length was last set for: it follows the address bar, unlike `screen`. */
  let trackScreen = 0;
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
  /**
   * The dive into a case study, or back from it: the card at `index` between its place (0) and the opening media
   * (1). Forward, it stays on the opening media until the page leaves.
   */
  let dive: {
    index: number;
    forward: boolean;
    start: number;
    radius: number;
    lift: number;
    swift: boolean;
    done: () => void;
  } | null = null;
  /** The sway and the cards' float coming to rest for the dive (`forward`), or back once it is over. */
  let rest: { forward: boolean; start: number } | null = null;
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
    trackScreen = screen;
    set(track, 'height', `${String(Math.round(range + screen + TRACK_SLACK))}px`);
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
        // The light version, for the rest of the visit (main spec §6.3): the list, without 3D. This page turns to it
        // only while the visitor rests at the opening, so that nothing moves under their eyes.
        markSlow('lite');
        if (!glide && current === target && current < (anchors[1] ?? 0) * 0.5) options.onLite?.(null);
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

  /**
   * A finger's fling goes on long after it lifts, under the glide, which it cannot stop: once the glide is over, what
   * is left of it would carry the page on to the next anchor. While a glide started by a finger runs, the page stops
   * scrolling natively, which ends the fling; the glide still scrolls it from script.
   */
  const coarse = matchMedia('(pointer: coarse)');
  function holdFling(on: boolean): void {
    if (on && coarse.matches) html.style.overflow = 'hidden';
    else html.style.removeProperty('overflow');
  }

  function endGlide(): void {
    glide = null;
    setSnap(true);
    holdFling(false);
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
    // Held a little longer if the page stopped short of the anchor (its end moved under the glide), so that the
    // snapping never takes over away from it.
    if (t >= 1 && (Math.abs(window.scrollY - glide.to) < 2 || now - glide.start > glide.duration + 600)) endGlide();
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
    // While a glide runs, it sets the direction: the page's end moving under it is no move of the visitor's.
    if (now !== lastScroll && !glide) direction = Math.sign(now - lastScroll);
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
    holdFling(glide !== null);
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
        // The page keeps its last screen of scroll under the contact, and some more, so that the arrival still ends
        // on the contact whatever the bar does.
        if (height !== trackScreen) {
          trackScreen = height;
          set(track, 'height', `${String(Math.round(range + height + TRACK_SLACK))}px`);
          // The office fills the screen: its canvas and the screen, the pictures and the links over it follow.
          officeView?.resize();
        }
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
      // The office's framing follows the width: across the phone's limit, it is prepared again.
      if (officeLoading && officeFraming !== (scene.view.mobile ? 'mobile' : 'desktop')) freeOffice();
      else officeView?.resize();
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
    // The dive: how far the card has flown (0 to 1, eased), how much the rest still shows, how much has come to rest.
    let diveT = 0;
    let flying = false;
    if (dive) {
      if (dive.start < 0) dive.start = now;
      const e = Math.min(1, (now - dive.start) / DIVE_MS);
      diveT = dive.forward ? e : 1 - e;
      flying = e < 1;
      if (!flying) {
        const ended = dive;
        if (ended.forward) dive = { ...ended, done: () => undefined };
        else {
          dive = null;
          rest = { forward: false, start: now };
        }
        ended.done();
      }
    }
    const diving = dive?.index ?? -1;
    const k = dive?.swift ? 1 - easeOut(1 - diveT) : easeInOutCubic(diveT);
    const others = diving >= 0 ? 1 - smoothstep(0, 0.33, diveT) : 1;
    let swayRest = 0;
    let floatRest = 0;
    if (rest) {
      if (rest.start < 0) rest.start = now;
      const elapsed = now - rest.start;
      const s = easeOut(Math.min(1, elapsed / SWAY_REST_MS));
      const f = easeInOutCubic(Math.min(1, elapsed / DIVE_MS));
      swayRest = rest.forward ? s : 1 - s;
      floatRest = rest.forward ? f : 1 - f;
      if (elapsed < DIVE_MS) flying = true;
      else if (!rest.forward) rest = null;
    }
    if (flying) redraw = true;
    const swing0 = 1 - swayRest;
    const moving: Sway = options.still
      ? noSway
      : { ...drift(time), ...(tiltOn ? tiltToward(pointer.pointer) : { tiltX: 0, tiltY: 0 }) };
    const sway: Sway = {
      dx: moving.dx * swing0,
      dy: moving.dy * swing0,
      roll: moving.roll * swing0,
      tiltX: moving.tiltX * swing0,
      tiltY: moving.tiltY * swing0,
    };

    // The cards and their cartels.
    focus = diving >= 0 ? diving : focusedCard(scene.cards, depth, focus);
    scene.cards.forEach((place, i) => {
      const parts = cards[i];
      if (!parts) return;
      const look = cardLook(place, depth);
      // During the dive, no card is lit: the cartel and the ring leave, as the rest fades out.
      const lit = focus === i && diving < 0;
      const lift = options.still ? 0 : 12 * swing(time, place.floatDuration, place.floatDelay) * (1 - floatRest);
      set(parts.float, 'transform', `translateY(${lift.toFixed(2)}px)`);
      if (i === diving && dive) {
        const flight = diveLook(place, look, view, k);
        set(parts.place, 'transform', cssTransform(flight.x, flight.y, flight.depth, view, sway));
        cardPerspective(parts, flight.x, flight.y, flight.depth, lift, view);
        set(parts.link, 'opacity', '1');
        set(parts.link, 'filter', 'none');
        set(parts.link, 'pointer-events', 'none');
        set(
          parts.link,
          'transform',
          `rotateY(${(place.rotateY * (1 - k)).toFixed(2)}deg) rotateZ(${(place.rotateZ * (1 - k)).toFixed(2)}deg) translateZ(${(dive.lift * (1 - k)).toFixed(2)}px)`,
        );
        // The card follows the flight frame by frame, its shadow fading out.
        set(parts.link, 'transition', 'box-shadow 450ms ease');
        set(parts.link, 'box-shadow', '0 0 0 0 rgb(255 255 255 / 0%), 0 40px 80px -24px rgb(0 0 0 / 0%)');
        set(parts.link, 'border-radius', `${(dive.radius * (1 - k)).toFixed(2)}px`);
      } else {
        const opacity = look.opacity * others;
        const shown = opacity > 0.004;
        set(parts.place, 'transform', cssTransform(place.x, place.y, look.depth, view, sway));
        cardPerspective(parts, place.x, place.y, look.depth, lift, view);
        set(parts.link, 'opacity', opacity.toFixed(3));
        set(parts.link, 'filter', shown && look.blur > 0.05 ? `blur(${look.blur.toFixed(2)}px)` : 'none');
        set(parts.link, 'pointer-events', opacity > 0.3 && diving < 0 ? 'auto' : 'none');
        set(
          parts.link,
          'transform',
          `rotateY(${place.rotateY.toFixed(2)}deg) rotateZ(${place.rotateZ.toFixed(2)}deg) translateZ(${lit && hovered === i ? String(HOVER_LIFT) : '0'}px)`,
        );
        set(parts.link, 'transition', '');
        set(parts.link, 'box-shadow', '');
        set(parts.link, 'border-radius', '');
      }
      parts.item.classList.toggle('lit', lit);
      if (parts.cartel) {
        const cartel = cartelPlace(place, look, view);
        // Brought forward, out of reach of the turned card: in the same 3D scene, the card and its shadow would
        // otherwise cut through the cartel, half of the shadow drawn over the text. Placed and scaled back so that
        // the perspective shows it where and how big it was.
        const back = (view.perspective - CARTEL_Z) / view.perspective;
        const x = view.vpX + (cartel.x - view.vpX) * back;
        const y = view.vpY + (cartel.y - view.vpY) * back;
        set(parts.cartel, 'translate', `${x.toFixed(1)}px ${y.toFixed(1)}px ${String(CARTEL_Z)}px`);
        set(parts.cartel, 'scale', back.toFixed(4));
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
      set(parts.body, 'opacity', (look.opacity * (0.55 + 0.45 * light.stars) * starsK * others).toFixed(3));
      set(parts.body, 'filter', look.blur > 0.05 ? `blur(${look.blur.toFixed(2)}px)` : 'none');
      const s = options.still ? 0 : swing(time, world.floatDuration, world.floatDelay);
      set(parts.body, 'translate', `${(4 * s).toFixed(2)}px ${(-3 * s).toFixed(2)}px`);
    });

    // The planet recedes to a point of light, drifting toward the vanishing point.
    const planetState = planetLook(depth, light.sky, arrival);
    const sP = planetState.scale;
    const mid = tiltOn
      ? { x: pointer.pointer.x * 14 * (1 - sP) * swing0, y: pointer.pointer.y * 8 * (1 - sP) * swing0 }
      : { x: 0, y: 0 };
    const dx = planetRest.x * (sP - 1) + mid.x + sway.dx;
    const dy = planetRest.y * (sP - 1) + mid.y + sway.dy;
    const group = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) rotate(${sway.roll.toFixed(3)}deg)`;
    if (decorGroup) set(decorGroup, 'transform', `${group} scale(${sP.toFixed(4)})`);
    if (decor) set(decor, 'opacity', (planetState.decorOpacity * others).toFixed(3));
    if (halo) set(halo, 'opacity', (planetState.haloOpacity * others).toFixed(3));
    if (planet) {
      const bob = options.still ? 0 : swing(time, 7000);
      set(
        planet,
        'transform',
        `${group} scale(${sP.toFixed(4)}) translateY(${(10 * bob).toFixed(2)}px) rotate(${bob.toFixed(3)}deg)`,
      );
      set(planet, 'opacity', (planetState.opacity * others).toFixed(3));
      if (planetFrame) {
        set(planetFrame, 'filter', planetState.blur > 0.05 ? `blur(${planetState.blur.toFixed(2)}px)` : 'none');
      }
    }
    if (glow) {
      set(glow, 'transform', group);
      set(glow, 'opacity', (planetState.glowOpacity * others).toFixed(3));
    }
    drawPlanet(now, u, planetState.blur, moment);
    // The office loads from the first project on.
    if (u >= (anchors[1] ?? 0) - 0.01 && html.dataset.office !== 'live') html.dataset.office = 'near';

    // The opening's text stays, then fades out rising; the call to action leaves at the first move.
    const fade = introFade(depth);
    if (intro) {
      set(intro, 'opacity', ((1 - fade) * others).toFixed(3));
      set(intro, 'transform', `translateY(${(-16 * fade).toFixed(1)}px)`);
      set(intro, 'pointer-events', fade < 0.5 ? 'auto' : 'none');
    }
    html.dataset.introFaded = fade > 0.98 ? 'true' : 'false';
    if (cta) {
      const atOpening = depth < 0.004;
      set(cta, 'opacity', atOpening ? '1' : '0');
      set(cta, 'visibility', atOpening ? 'visible' : 'hidden');
    }

    // The end: the office arrives, then the contact. The live office plays its own arrival; its image fades in.
    drawOffice(now, u, arrival);
    if (contact) {
      set(contact, 'pointer-events', arrival > 0.95 ? 'auto' : 'none');
      if (officeView) {
        const textK = officeView.state.textK;
        set(contact, 'opacity', arrival > 0 ? '1' : '0');
        if (office) set(office, 'transform', 'none');
        contactText.forEach((element) => {
          set(element, 'opacity', textK.toFixed(3));
          set(element, 'transform', `translateY(${(12 * (1 - textK)).toFixed(1)}px)`);
        });
      } else {
        set(contact, 'opacity', smoothstep(0, 0.5, arrival).toFixed(3));
        if (office) set(office, 'transform', `scale(${(1.08 - 0.08 * easeInOutCubic(arrival)).toFixed(4)})`);
        contactText.forEach((element) => {
          set(element, 'opacity', smoothstep(0.55, 1, arrival).toFixed(3));
          set(element, 'transform', 'none');
        });
      }
    }

    // The click hint over the sharp card.
    if (cursor) {
      const lit = cards[focus];
      cursor.update(
        pointer.pointer.clientX,
        pointer.pointer.clientY,
        !view.mobile && lit !== undefined && hovered === focus && diving < 0,
      );
    }

    // The stars.
    if (renderer && stars && swayMatrixOf) {
      stars.update({
        time,
        depth,
        farScale: farStarsScale(depth),
        farShiftX: (tiltOn ? pointer.pointer.x * 18 * swing0 : 0) + sway.dx,
        farShiftY: (tiltOn ? pointer.pointer.y * 11 * swing0 : 0) + sway.dy,
        farOpacity: light.stars * starsK * others,
        farFade: 1 - smoothstep(0.15, 0.75, tEnd),
        nearOpacity: (0.55 + 0.45 * light.stars) * starsK * others,
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
  // ---------- The live office ----------

  // It is prepared from the first project on (at once on `#contact`), and drawn while the contact shows. On a phone,
  // which links its programs one by one, that takes seconds: begun at the middle of the journey, it was not ready for a
  // visitor going through the projects at a swipe each. Its first seconds on screen are measured: too slow, it gives way
  // to its layers, which also stand in without WebGL, and for the arrival when it is not ready in time.
  const OFFICE_START = anchors[1] ?? 0.1;
  // Not ready by the middle of the journey, its layers get ready too.
  const OFFICE_WARM = anchors[5] ?? 0.5;
  // `?office=live` keeps the live office whatever the rate; `?office=layers` shows the layers.
  const officeMode = new URLSearchParams(location.search).get('office');
  let officeView: OfficeView | null = null;
  let officeLoading = false;
  let officeSampler: FrameSampler | null = null;
  let officeSlow = officeMode === 'layers' || !options.webgl || (officeMode !== 'live' && isSlow('office'));
  let officeFailed = false;
  let lastOfficeDraw = 0;
  let officeFraming = '';
  /** The layers, ready to play the arrival if it comes before the live office, and what stops the live office then. */
  let standIn: OfficeView | null = null;
  let standInLoading = false;
  let officeAbort: AbortController | null = null;

  function loadOffice(): void {
    if (officeLoading || !office) return;
    const host = office;
    officeLoading = true;
    officeFraming = scene.view.mobile ? 'mobile' : 'desktop';
    const layers = officeSlow;
    const moment = html.dataset.moment === 'aube' ? 'aube' : 'crepuscule';
    const abort = new AbortController();
    officeAbort = abort;
    // Out of the frame: preparing reads the section's size, which would force a layout in the middle of a frame.
    void new Promise((resolve) => setTimeout(resolve))
      .then(() => import('../office/warmup'))
      .then(async ({ prepareOffice, prepareLayers, SlowOffice }) => {
        const created = await (layers
          ? prepareLayers(host, host, { moment, still: options.still })
          : prepareOffice(host, host, {
              modelUrl: withBase('/models/petit-prince.glb'),
              moment,
              still: options.still,
              forced: officeMode === 'live',
              signal: abort.signal,
            }).catch((error: unknown) => {
              if (error instanceof SlowOffice) {
                officeSlow = true;
                markSlow('office');
                return prepareLayers(host, host, { moment, still: options.still });
              }
              throw error;
            }));
        if (stopped || !officeLoading || abort.signal.aborted) {
          created.dispose();
          return;
        }
        // Ready before the arrival: the layers standing by are no longer needed.
        freeStandIn();
        officeView = created;
        officeSampler = officeSlow || officeMode === 'live' ? null : frameSampler();
        html.dataset.office = 'live';
        // Which one draws it, for the measurement run: the live scene or its layers.
        html.dataset.officeScene = officeSlow ? 'layers' : 'live';
        performance.mark('journey:office-ready');
        redraw = true;
      })
      .catch(() => {
        // Stopped for its layers, which play the arrival.
        if (abort.signal.aborted) return;
        officeLoading = false;
        // Without the model, the worker or the layers, the still image stays, for the rest of the page.
        officeFailed = true;
      });
  }

  /** Gets the layers ready to play the arrival in place of the live office, if it comes first. */
  function loadStandIn(): void {
    if (standIn || standInLoading || !office) return;
    const host = office;
    standInLoading = true;
    const moment = html.dataset.moment === 'aube' ? 'aube' : 'crepuscule';
    void import('../office/warmup')
      .then(({ prepareLayers }) => prepareLayers(host, host, { moment, still: options.still }))
      .then((created) => {
        if (stopped || !standInLoading || officeView) {
          created.dispose();
          return;
        }
        standInLoading = false;
        standIn = created;
      })
      .catch(() => {
        standInLoading = false;
      });
  }

  function freeStandIn(): void {
    standInLoading = false;
    standIn?.dispose();
    standIn = null;
  }

  function freeOffice(): void {
    officeLoading = false;
    officeAbort?.abort();
    officeAbort = null;
    freeStandIn();
    officeView?.dispose();
    officeView = null;
    officeSampler = null;
    if (html.dataset.office === 'live') html.dataset.office = 'near';
  }

  /** What played the first arrival of the page, and when, for the measurement run: the live office, its layers or its image. */
  function arrivedWith(scene: string): void {
    html.dataset.officeArrival = scene;
    performance.mark('journey:arrival');
  }

  /**
   * Prepares the office from the first project on, its layers too if it is not ready by the middle of the journey, and
   * draws it while the contact shows.
   */
  function drawOffice(now: number, u: number, arrival: number): void {
    if (!officeView) {
      // While the planet measures its first seconds on screen, the office's links would count against it.
      const planetMeasured =
        planetSampler !== null && html.dataset.planet !== undefined && html.dataset.planet !== 'image';
      if (!officeFailed && (u >= OFFICE_WARM - 0.01 || (u >= OFFICE_START - 0.01 && !planetMeasured))) loadOffice();
      if (u >= OFFICE_WARM - 0.01 && officeLoading && !officeSlow && officeMode !== 'live') loadStandIn();
      if (arrival <= 0) return;
      if (!html.dataset.officeArrival) arrivedWith(standIn ? 'layers' : 'image');
      if (!standIn) return;
      // The arrival comes before the live office: its layers play it, and stay for the rest of the page. Its programs
      // are now in the browser's cache, so the next visit prepares it much faster.
      officeAbort?.abort();
      officeView = standIn;
      standIn = null;
      html.dataset.office = 'live';
      html.dataset.officeScene = 'layers';
    } else if (arrival > 0 && !html.dataset.officeArrival) {
      arrivedWith(html.dataset.officeScene ?? 'live');
    }
    const previousDraw = lastOfficeDraw;
    lastOfficeDraw = now;
    // While the layers get ready to take over, the live office stays as it is.
    if (arrival <= 0 || officeReplacing) return;
    officeView.update(arrival, now, previousDraw ? now - previousDraw : 16);
    if (officeSampler && previousDraw > 0) {
      redraw = true;
      const verdict = officeSampler.add(now - previousDraw);
      if (verdict === 'fast') officeSampler = null;
      else if (verdict === 'slow') {
        // Too slow: the layers take over, from the same point of the arrival.
        officeSlow = true;
        markSlow('office');
        officeSampler = null;
        replaceOffice(arrival);
      }
    }
  }

  /**
   * Puts the layers in place of the live office, on screen: the live office stays, still, until the layers are drawn
   * where the arrival is, then goes. Freed first, the office would vanish and come back, and the layers' warming draws
   * (the arrival's start, its fades and its end) would blink on screen.
   */
  let officeReplacing = false;
  function replaceOffice(arrival: number): void {
    if (!office || officeReplacing) return;
    const host = office;
    officeReplacing = true;
    const moment = html.dataset.moment === 'aube' ? 'aube' : 'crepuscule';
    void import('../office/warmup')
      .then(({ prepareLayers }) => prepareLayers(host, host, { moment, still: options.still, at: arrival }))
      .then((created) => {
        officeReplacing = false;
        if (stopped || !officeLoading) {
          created.dispose();
          return;
        }
        officeView?.dispose();
        officeView = created;
        html.dataset.officeScene = 'layers';
        redraw = true;
      })
      .catch(() => {
        officeReplacing = false;
      });
  }

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
  // The camera keeps its pace when frames are slow: the ticker caps a frame at 64 ms, which would stretch the 3.5 s
  // arrival at the office into much more on a device drawing a few frames a second. Up to 250 ms, it moves as far as
  // the time the frame took.
  let lastFrame = 0;
  // Through the projects, a device that keeps the journey under 25 frames per second (a browser drawing without its
  // graphics card, say) is given the list for the rest of the visit, once the camera rests (main spec §6.4). Only the
  // frames of a move count. The measurement run (`?mesure=`) and `?lite=0` keep the journey; so do automated
  // browsers, which draw in software on CI, unless `?lite=auto` asks for the measure.
  const params = new URLSearchParams(location.search);
  const judged =
    params.get('lite') === 'auto' || (!navigator.webdriver && !params.has('mesure') && params.get('lite') !== '0');
  let journeySampler: FrameSampler | null = judged ? frameSampler(SAMPLE_TIME, JOURNEY_MIN_FPS) : null;
  let liteDue = false;
  const stopTick = onTick((now, delta) => {
    const frame = lastFrame > 0 ? now - lastFrame : 0;
    const elapsed = delta >= 64 && lastFrame > 0 ? Math.min(250, frame) : delta;
    lastFrame = now;
    const onProjects = current >= (anchors[1] ?? 0) && current <= LAST_PROJECT;
    // A frame over a second is a hidden tab or a pause, not the device's pace.
    if (journeySampler && frame > 0 && frame < 1000 && onProjects && (glide || current !== target)) {
      const verdict = journeySampler.add(frame);
      if (verdict !== 'measuring') journeySampler = null;
      if (verdict === 'slow') {
        markSlow('lite');
        liteDue = true;
      }
    }
    if (liteDue && !glide && current === target) {
      liteDue = false;
      options.onLite?.(anchorFragment.get(nearestAnchor(window.scrollY, positions)) ?? null);
      return;
    }
    pointer.update(delta);
    followCamera(elapsed);
    const atRest = !glide && current === target && pointer.settled() && !redraw && !officeView?.busy();
    // Before the ambient motions start, nothing moves at rest: the frame drawn last still holds.
    if (atRest && (now - lastDraw < AMBIENT_FRAME || !ambient.started())) return;
    lastDraw = now;
    redraw = false;
    draw(now);
  });

  setJourney({
    has: (id) => fragmentAnchor.has(id),
    here: () => anchorFragment.get(nearestAnchor(window.scrollY, positions)) ?? null,
    isAt: (id) => {
      const index = fragmentAnchor.get(id);
      return index !== undefined && anchorAt(scrolled, positions) === index && current === target;
    },
    jumpTo: (id) => {
      const index = fragmentAnchor.get(id);
      if (index !== undefined) jumpTo(index);
    },
    glideTo,
    dive: (id) => {
      const index = fragmentAnchor.get(id);
      const parts = index === undefined ? undefined : cards[index - 1];
      if (index === undefined || !parts || dive) return null;
      const radius = parseFloat(getComputedStyle(parts.link).borderTopLeftRadius) || 0;
      endGlide();
      // The card under the mouse stands out of the screen (its hover): the flight brings it back from there, rather
      // than jump back at its first frame.
      const lift = focus === index - 1 && hovered === index - 1 && !scene.view.mobile ? HOVER_LIFT : 0;
      return new Promise<void>((resolve) => {
        dive = { index: index - 1, forward: true, start: -1, radius, lift, swift: false, done: resolve };
        rest = { forward: true, start: -1 };
        redraw = true;
      });
    },
    undive: (id, swift = false) => {
      const index = fragmentAnchor.get(id);
      const parts = index === undefined ? undefined : cards[index - 1];
      if (index === undefined || !parts) return null;
      const radius = parseFloat(getComputedStyle(parts.link).borderTopLeftRadius) || 0;
      const back = new Promise<void>((resolve) => {
        dive = { index: index - 1, forward: false, start: -1, radius, lift: 0, swift, done: resolve };
        // Everything is already at rest: the sway and the float come back once the card is home.
        rest = { forward: true, start: performance.now() - DIVE_MS };
      });
      // Drawn now, the card on the opening media, so that it takes over from the picture in the same frame.
      draw(performance.now());
      return back;
    },
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
    freeOffice();
    markers.forEach((marker) => {
      marker.remove();
    });
    delete html.dataset.stars;
    delete html.dataset.introFaded;
    delete html.dataset.office;
    delete html.dataset.officeScene;
    delete html.dataset.officeArrival;
    styles.reset();
    cards.forEach(({ item }) => {
      item.classList.remove('lit');
    });
    root.dataset.anchor = '';
  };
}

/**
 * The journey (journey spec): one scroll-driven move back from the Little Prince's planet, through the projects, to
 * the contact. The page scrolls natively over a track as long as the journey (`SCREENS` in anchors.ts), snapped on the anchors; the scene stays on
 * screen, and at every frame the camera follows the scroll and places the planet, the cards, their cartels, the small
 * worlds and the stars. The HTML stays the one of the list (no JavaScript, "reduce motion"): the journey only places
 * it, so a screen reader reads the projects in order, then the contact.
 */
import { anchors, cameraDepth, endClock, endProgress, endProgressAt, RING, RING_DEPTH, SCREENS } from './anchors';
import {
  cardLook,
  cssTransform,
  diveLook,
  farStarsScale,
  projectCss,
  planetLook,
  smoothstep,
  still as noSway,
  worldLook,
  type Sway,
} from './camera';
import { sceneFor, type CardPlace, type Scene, type View } from './layout';
import { setJourney } from './registry';
import {
  anchorAt,
  anchorPositions,
  bracket,
  easeFrom,
  easeInOutCubic,
  easeRamp,
  glideDuration,
  isNotch,
  magnetAnchor,
  magnetOf,
  nearestAnchor,
  ON_ANCHOR,
  settleAnchor,
  stepAnchor,
  wheelGestures,
  wheelPixels,
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
import type { OfficeScene } from '../office/live';
import { withBase } from '../../lib/url';
import { frameSampler, isSlow, JOURNEY_MIN_FPS, markSlow, type FrameSampler } from '../quality';
import { lowerResolution } from '../resolution';
import { blurFilter } from './blur';
import { coverTop } from '../../lib/cover';
import { createShowcase } from '../showcase/showcase';
import { holdStill } from '../rest';
import {
  hasKept,
  keepOffice,
  keepPlanet,
  keepRenderer,
  takeOffice,
  takePlanet,
  takeRenderer,
  type KeptOffice,
} from '../keep';
import { CARTEL_GAP, fitRing, type Pose, type RingRoom } from '../showcase/ring';

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
/** On a phone, the room kept between the ring and the header above it, the arrows below it, in px. */
const RING_MARGIN = 14;

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
const easeInOutSine = (t: number): number => (1 - Math.cos(Math.PI * t)) / 2;
/** The glide between the opening and the ring of projects, in ms: about the old glide to the first project. */
const SHOWCASE_GLIDE_MS = 1150;
/** How far a finger moves, in px, before it is told whether it turns the ring or scrolls the page: under the
 * browsers' own threshold for scrolling, so that the page has not moved yet. */
const SIDEWAYS_SLOP = 8;
/**
 * Through the end (the arrival at the office), the camera's top speed on the end's clock, per ms: the whole arrival in
 * 3.2 s, plus 0.3 s to speed up and to slow down, the pace the magnet glides at too. A hand driving the scroll there
 * may play it faster, down to a second.
 */
const END_SPEED = 1 / 3200;
const END_DRIVEN_SPEED = 1 / 1000;
const END_RAMP_MS = 300;
/** How closely the camera follows the scroll through the end, in ms (a light smoothing). */
const END_EASE_MS = 160;

interface CardParts {
  item: HTMLElement;
  place: HTMLElement;
  float: HTMLElement;
  /** The card's turn: the card and its shadow turn with it. */
  spin: HTMLElement;
  /** The card's soft shadow, a box the card's size under it. */
  shade: HTMLElement;
  link: HTMLAnchorElement;
  cartel: HTMLElement | null;
}

interface WorldParts {
  place: HTMLElement;
  body: HTMLElement;
}

/**
 * Under this median rate, in frames per second, a window of the journey's moves lags: while the page still prepares a
 * scene, it pauses once to let it finish, showing that it loads (`HOLD_MAX` at most), rather than giving anything up.
 */
const LAG_FPS = 40;
/** How long a loading pause lasts at least (no flash), and at most, in ms. */
const HOLD_MIN = 600;
const HOLD_MAX = 3000;

/** A loading pause: why, since when, and the anchor the visitor asked for meanwhile. */
interface Hold {
  reason: 'lag' | 'arrival';
  start: number;
  next: number | null;
}

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

/**
 * Starts the journey in `root`; returns a function that stops it and gives the page back its list. Stopped with `keep`
 * (the home is left for another page), it keeps its scenes for the next visit of the home (`src/scene/keep.ts`).
 */
export function startJourney(root: HTMLElement, options: JourneyOptions): (keep?: boolean) => void {
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
  // The projects share one stop, the ring around the planet (`src/scene/showcase/`): the journey has three anchors,
  // the opening, the ring and the contact.
  const LAST_PROJECT = RING;
  const SHOWCASE_AT = RING;
  /** How the view follows a gesture between the anchors, and the magnet that ends it (`?scroll=0` to `3`). */
  const magnet = magnetOf(location.search);
  // Firefox sorts everything in one 3D scene plane by plane: a card's dark shadow, in the card's own plane, would
  // now and then be drawn over the card. There each card is flattened into its own picture, the perspective of its
  // turn given by its own frame, seen from the vanishing point at the card's distance: the same drawing, in one plane.
  // The ring's probe (`?mesure=anneau`, `ring-probe.ts`) stops drawing one part or another: its names, in
  // `data-probe` on the root element.
  const probing = (part: string): boolean => html.dataset.probe?.includes(part) ?? false;
  const flatCards = CSS.supports('-moz-appearance', 'none');
  const cardPerspective = (parts: CardParts, x: number, y: number, depth: number, lift: number, view: View): void => {
    if (!flatCards || probing('perspective')) return;
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
    const spin = item.querySelector<HTMLElement>('.spin');
    const shade = item.querySelector<HTMLElement>('.shade');
    const link = item.querySelector<HTMLAnchorElement>('a.card');
    if (!place || !float || !spin || !shade || !link) return [];
    return [{ item, place, float, spin, shade, link, cartel: item.querySelector<HTMLElement>('.cartel') }];
  });

  // The fragments the journey answers, by anchor: the opening, the first project, each project, the contact.
  const fragmentAnchor = new Map<string, number>();
  if (opening?.id) fragmentAnchor.set(opening.id, 0);
  if (world3d.id) fragmentAnchor.set(world3d.id, 1);
  cards.forEach(({ item }) => fragmentAnchor.set(item.id, 1));
  // Each project's card, by its fragment.
  const cardIndex = new Map<string, number>();
  cards.forEach(({ item }, i) => cardIndex.set(item.id, i));
  if (contact?.id) fragmentAnchor.set(contact.id, anchors.length - 1);
  // And the other way: each anchor's first fragment (the projects' rather than the first project's).
  const anchorFragment = new Map<number, string>();
  for (const [id, index] of fragmentAnchor) if (!anchorFragment.has(index)) anchorFragment.set(index, id);

  let scene: Scene;
  let worlds: WorldParts[] = [];
  /** Whether the next frame must be drawn, even at rest. */
  let redraw = false;
  const showcase = createShowcase(
    world3d,
    cards.map(({ item }) => item.querySelector('h3')?.textContent.trim() ?? ''),
    () => {
      redraw = true;
    },
    planetFrame,
    // The sky in WebGL, with the stars; `?ciel=2d` keeps the 2D canvases, to compare the two drawings.
    options.webgl && new URLSearchParams(location.search).get('ciel') !== '2d',
  );
  /** The screen's height the track was laid out for, in px. */
  let screen = 0;
  /** The screen's height the track's length was last set for: it follows the address bar, unlike `screen`. */
  let trackScreen = 0;
  let positions: number[] = [];
  let range = 1;
  let planetRest = { x: 0, y: 0 };
  let planetSize = 0;

  // The camera: where the scroll is (target), where the camera is (current).
  let target = 0;
  let current = 0;
  let focus = -1;
  let hovered = -1;
  /** How lit each card beside the front one is by the mouse, from 0 to 1: it eases in and out of the hover. */
  const hoverGlow: number[] = [];
  let hoverGlowAt = 0;
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
    /** Where the opening media starts, from the top of the screen (tokens.css). */
    top: number;
    done: () => void;
  } | null = null;
  /** The sway and the cards' float coming to rest for the dive (`forward`), or back once it is over. */
  let rest: { forward: boolean; start: number } | null = null;
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

  /**
   * The ring of a phone fitted to its screen (`fitRing`): between the header above, the loading pause's pill and the
   * arrows below, as the CSS places them, for the cartels as they lay out.
   */
  function fitShowcase(view: View): View['ring'] {
    const top = stage.getBoundingClientRect().top;
    const header = document.querySelector('[data-site-header]')?.getBoundingClientRect();
    const arrows = root.querySelector('.showcase-arrows')?.getBoundingClientRect();
    const pill = document.querySelector('.loading')?.getBoundingClientRect();
    const limits = [pill, arrows].flatMap((box) => (box && box.height > 0 ? [box.top - top - RING_MARGIN] : []));
    // A hidden copy of each cartel, laid out at the width asked: the cartels themselves keep the styles frames set.
    const copies = cards.flatMap(({ cartel }) => {
      if (!cartel?.parentElement) return [];
      const copy = cartel.cloneNode(true) as HTMLElement;
      copy.removeAttribute('id');
      copy.setAttribute('aria-hidden', 'true');
      copy.style.cssText = 'visibility: hidden; translate: none; scale: none; transform: none;';
      cartel.parentElement.append(copy);
      return [copy];
    });
    const heights = new Map<number, number>();
    const room: RingRoom = {
      top: (header ? header.bottom - top : 0) + RING_MARGIN,
      bottoms: limits.length > 0 ? limits : [view.height - RING_MARGIN],
      cartel: (width) => {
        const key = Math.round(width);
        let height = heights.get(key);
        if (height === undefined) {
          for (const copy of copies) copy.style.setProperty('--cartel-width', `${String(key)}px`);
          height = Math.max(0, ...copies.map((copy) => copy.offsetHeight));
          heights.set(key, height);
        }
        return height;
      },
    };
    const fit = fitRing(view, room);
    for (const copy of copies) copy.remove();
    // Too short a phone to keep the text clear of the loading pause's pill too: while the pill shows, the text fades
    // under it (Home.astro).
    if (fit && limits.length > 1 && fit.clears > 0) root.dataset.ringTight = '';
    else delete root.dataset.ringTight;
    return fit ? { lift: fit.lift, scale: fit.scale } : undefined;
  }

  function layout(): void {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    scene = sceneFor(width, height);
    if (scene.view.mobile) {
      const ring = fitShowcase(scene.view);
      if (ring) scene = { ...scene, view: { ...scene.view, ring } };
    } else delete root.dataset.ringTight;
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
    const cardWidth = showcase.ring(view).card;
    cards.forEach(({ link, shade }) => {
      const cardHeight = (cardWidth * 9) / 16;
      for (const box of [link, shade]) {
        set(box, 'width', `${cardWidth.toFixed(1)}px`);
        set(box, 'height', `${cardHeight.toFixed(1)}px`);
        set(box, 'left', `${(-cardWidth / 2).toFixed(1)}px`);
        set(box, 'top', `${(-cardHeight / 2).toFixed(1)}px`);
      }
    });
    showcase.resize(view);

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
  /** Whether the scenes are kept as the journey stops (the home is left for another page), rather than let go. */
  let keeping = false;
  let swayMatrixOf: ((sway: Sway) => Matrix4) | null = null;
  if (options.webgl) {
    void Promise.all([import('../renderer'), import('../stars/stars'), import('./camera3d')]).then(
      ([{ createRenderer }, { createStars }, { swayMatrix }]) => {
        if (stopped) return;
        // The renderer of a former visit of the home, if any: its canvas comes back into this page.
        const kept = takeRenderer();
        if (kept) {
          renderer = kept;
          stage.prepend(kept.canvas);
          kept.resize(scene.view);
        } else {
          try {
            renderer = createRenderer(stage, scene.view);
          } catch {
            // Without WebGL, the journey goes on without its stars.
            return;
          }
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
  // It stays while the ring shows.
  const PLANET_KEEP = SHOWCASE_AT + 0.02;
  const PLANET_FREE = SHOWCASE_AT + 0.2;
  /** The planet's blur, in px, past which it is only a blurred light: the image shows instead. */
  const PLANET_SHARP = 3;
  let livePlanet: LivePlanet | null = null;
  let handoff: Handoff | null = null;
  let planetLoading = false;
  /** Whether the live planet could not be made (no WebGL 2, no model): its image stays. */
  let planetFailed = false;
  let lastPlanetDraw = 0;
  // Its first seconds on screen are measured: kept too slow, it gives way to its image for the rest of the visit.
  let planetSampler: FrameSampler | null = null;
  // `?planete=live` keeps it whatever the rate, for tests and captures on machines without a GPU.
  const planetForced = new URLSearchParams(location.search).get('planete') === 'live';
  let planetSlow = !planetForced && isSlow('planet');

  function loadPlanet(): void {
    if (planetLoading || planetFailed || !planet) return;
    const container = planet;
    planetLoading = true;
    // The planet of a former visit of the home, if any: ready at once.
    const kept = takePlanet();
    void Promise.all([import('../planet/planet'), import('../planet/handoff')])
      .then(async ([{ createPlanet, SlowRenderer }, { planetHandoff }]) => {
        if (kept) {
          container.append(kept.canvas);
          kept.resize(planetSize, scene.view.mobile);
        }
        const created =
          kept ??
          (await createPlanet(container, {
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
          }));
        if (created.isLost()) {
          created.dispose();
          throw new Error('The planet lost its WebGL context.');
        }
        if (stopped || !planetLoading) {
          // Ready as the home is left: kept for the way back.
          if (stopped && keeping) keepPlanet(created);
          else created.dispose();
          return;
        }
        // Its programs linked slowly: the live office would link five times as many, seconds of halting frames on the
        // ring, and turn out too slow anyway. Its layers show from the start.
        if (!kept && created.linksSlowly && officeMode !== 'live' && !officeLoading) {
          officeSlow = true;
          markSlow('office');
        }
        livePlanet?.dispose();
        livePlanet = created;
        created.whenLost(onPlanetLost);
        handoff = planetHandoff(container, created.canvas);
        planetSampler = planetForced ? null : frameSampler();
        performance.mark('journey:planet-ready');
        redraw = true;
      })
      .catch(() => {
        // Without WebGL or the model, the fallback image stays.
        if (!stopped && planetLoading) planetFailed = true;
      });
  }

  /**
   * The planet's WebGL context is lost (the GPU taken back while the tab was away, a driver's reset): its image comes
   * back at once, and the planet is put together again, once. Lost again, the image stays for the rest of the page.
   */
  let planetLosses = 0;
  function onPlanetLost(): void {
    if (stopped || !livePlanet) return;
    planetLosses += 1;
    planetSampler = null;
    freePlanet();
    if (planetLosses > 1) planetFailed = true;
    redraw = true;
  }

  function freePlanet(keep = false): void {
    planetLoading = false;
    handoff?.reset();
    // Kept, it answers to the journey that takes it back (`src/scene/keep.ts` lets go of one lost meanwhile).
    livePlanet?.whenLost(null);
    if (keep && livePlanet) keepPlanet(livePlanet);
    else livePlanet?.dispose();
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
      // A planet kept from a former visit of the home is ready: it comes back at once.
      if ((ambient.started() || hasKept().planet) && u <= PLANET_KEEP) loadPlanet();
      return;
    }
    const previousDraw = lastPlanetDraw;
    const delta = ambient.started() && !options.still ? Math.min(100, now - previousDraw) : 0;
    lastPlanetDraw = now;
    const draws = handoff.update(blur < PLANET_SHARP, now);
    html.dataset.planet = handoff.state();
    if (!draws || probing('planete')) return;
    livePlanet.setMoment(moment);
    livePlanet.render(delta);
    if (planetSampler && previousDraw > 0) {
      // Measured at every frame, not at the resting pace.
      redraw = true;
      const verdict = planetSampler.add(now - previousDraw);
      if (verdict === 'fast') planetSampler = null;
      else if (verdict === 'lagging' && lowerResolution(window.devicePixelRatio || 1, scene.view.mobile)) {
        // Lagging: first a little less resolution on a dense screen, measured afresh.
        livePlanet.resize(planetSize, scene.view.mobile);
        planetSampler.reset();
      } else if (verdict === 'slow') {
        // Only the planet gives way, to its image: the journey has its own measure, and turns to the list only when
        // its own frames stay too slow (main spec §6.3).
        planetSlow = true;
        markSlow('planet');
        freePlanet();
      }
    }
  }

  // ---------- Following the scroll ----------

  const progressOf = (scroll: number): number => Math.max(0, Math.min(1, scroll / range));
  /** How far the arrival at the office is, from 0 to 1, with the camera at `u`. */
  const arrivalAt = (u: number): number => Math.max(0, Math.min(1, (endProgress(u) - 0.2) / 0.8));
  /**
   * Whether `u` is past the ring, toward the contact. The ring's anchor is a whole pixel, rounded from its progress
   * (1539 px for 1538.875 on a 947 px high window): resting on it is not past it.
   */
  const pastRing = (u: number): boolean => u > LAST_PROJECT + ON_ANCHOR / range;

  function followCamera(delta: number): void {
    const edge = LAST_PROJECT - 1 / range;
    // While the office finishes getting ready, the camera waits on the last project.
    const aim = hold?.reason === 'arrival' ? Math.min(target, LAST_PROJECT) : target;
    if (current >= edge && aim >= edge) {
      // Through the end, the camera runs on its own clock (the arrival at the office), eased toward the scroll's like
      // elsewhere. Its speed is held to the arrival's own pace (3.2 s from the ring to the contact) unless a hand drives
      // the scroll, which it then follows closely, the arrival played as fast as the gesture asks (a second at least).
      const q = endClock(current);
      const goal = endClock(aim);
      const d = goal - q;
      const cap = (wheel || touching ? END_DRIVEN_SPEED : END_SPEED) * delta;
      const move = Math.sign(d) * Math.min(cap, Math.abs(d) * (1 - Math.exp(-delta / END_EASE_MS)));
      if (Math.abs(d) < 1e-4) current = aim;
      else current = endProgressAt(q + move);
      return;
    }
    // Elsewhere it eases toward the scroll, like a light inertia.
    current += (aim - current) * (1 - Math.exp(-delta / (scene.view.mobile ? 150 : 130)));
    if (Math.abs(aim - current) < 0.00002) current = aim;
  }

  // ---------- Gliding from anchor to anchor ----------

  let glide: { from: number; to: number; start: number; duration: number; ease: (t: number) => number } | null = null;
  /** The loading pause under way, if any (see the frame loop). */
  let hold: Hold | null = null;

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
    // Any other way to an anchor (a key, a click, the magnet) ends a wheel's gesture.
    if (wheel) {
      wheel = null;
      clearTimeout(wheelTimer);
    }
    const to = positions[index];
    if (to === undefined) return;
    // During a loading pause, the last gesture waits for its end.
    if (hold) {
      hold.next = index;
      return;
    }
    if (glide?.to === to) return;
    // The snapping stays off from here: turned on even for a moment, it would pull a page left between two anchors
    // to the nearest one as soon as the scroll is read.
    glide = null;
    holdFling(false);
    setSnap(false);
    const from = window.scrollY;
    if (Math.abs(to - from) < 2) {
      setSnap(true);
      return;
    }
    direction = Math.sign(to - from);
    // Between the opening and the showcase, one long, even move: the camera draws back and turns toward the ring.
    const toShowcase = Math.min(from, to) < 2 && Math.abs(Math.max(from, to) - (positions[1] ?? 0)) < 2;
    // Through the end, the glide keeps the arrival's own even pace, which the camera follows.
    const throughEnd = Math.max(from, to) > (positions[1] ?? 0) + ON_ANCHOR;
    const clock = Math.abs(endClock(progressOf(to)) - endClock(progressOf(from)));
    const endDuration = END_RAMP_MS + clock / END_SPEED;
    const duration = throughEnd
      ? endDuration * magnet.pace
      : (toShowcase ? SHOWCASE_GLIDE_MS : glideDuration(to - from)) * magnet.pace;
    const ease = throughEnd
      ? easeRamp((END_RAMP_MS * magnet.pace) / duration)
      : toShowcase
        ? easeInOutSine
        : speed > 0
          ? easeFrom((speed * duration) / Math.abs(to - from))
          : easeInOutCubic;
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
    lastScroll = top;
    draw(performance.now());
  }

  // A scroll left between two anchors (a browser without snapping, an interrupted glide) comes to rest on one.
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  let touching = false;
  function settleSoon(): void {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      if (glide || touching || wheel) return;
      const at = window.scrollY;
      if (anchorAt(at, positions) >= 0) return;
      // A few px off an anchor (the anchors moved under the page, or the browser nudged it), the page goes back onto it,
      // whatever way the last gesture went: that way could lead a whole screen off.
      const near = nearestAnchor(at, positions);
      if (Math.abs((positions[near] ?? 0) - at) < OFF_ANCHOR * screen) backOnto(near);
      else glideTo(settleAnchor(at, positions, direction));
    }, 220);
  }

  /**
   * After the screen's size changed (a phone's address bar hiding, a turn), a page left resting a little off its anchor
   * goes back onto it. A browser may keep the scroll where it was while the anchors moved (Grégoire's Pixel 9, 11
   * November 2026: the ring's anchor at 1264 px, the page at 1205): the camera then never counted as resting there.
   */
  /** How far off an anchor, as a share of the screen, a resting page still belongs to it. */
  const OFF_ANCHOR = 0.15;
  let reanchorTimer: ReturnType<typeof setTimeout> | undefined;
  function reanchorSoon(): void {
    clearTimeout(reanchorTimer);
    reanchorTimer = setTimeout(() => {
      if (glide || touching || wheel || hold) return;
      const at = window.scrollY;
      if (anchorAt(at, positions) >= 0) return;
      const near = nearestAnchor(at, positions);
      if (Math.abs((positions[near] ?? 0) - at) < OFF_ANCHOR * screen) backOnto(near);
    }, 300);
  }

  /**
   * Glides back onto anchor `index`, once in a while at most: should the browser itself keep the page off it (its
   * snapping, with the address bar shown), gliding again and again would only shake the view. The page then rests where
   * it is, which still counts as that anchor (`restingAnchor`).
   */
  let backAt = -Infinity;
  function backOnto(index: number): void {
    const now = performance.now();
    if (now - backAt < 2000) return;
    backAt = now;
    glideTo(index);
  }

  /** The anchor one step from `position` in `direction`, from the anchor the page rests on, even a little off it. */
  function stepFrom(position: number, way: number): number {
    const from = restingAnchor(position);
    if (from < 0) return stepAnchor(position, positions, way);
    return Math.max(0, Math.min(positions.length - 1, from + Math.sign(way)));
  }

  /** The anchor the page rests on: exactly, or a little off it, as `backOnto` may leave it. */
  function restingAnchor(at: number): number {
    const on = anchorAt(at, positions);
    if (on >= 0) return on;
    const near = nearestAnchor(at, positions);
    return Math.abs((positions[near] ?? 0) - at) < OFF_ANCHOR * screen ? near : -1;
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
  // The wheel moves the view as far as it goes, toward one anchor at most, and the magnet ends the move once it stays
  // still (`?scroll=0`: one gesture, one anchor, whatever the device sends).
  const gestureOf = wheelGestures();
  let wheel: {
    /** The anchor the gesture started from, and the stretch it may move over. */
    from: number;
    low: number;
    high: number;
    /** Where it has taken the view. */
    at: number;
    /** Whether a mouse's notched wheel drives it: a notch always leads one anchor further. */
    notch: boolean;
  } | null = null;
  let wheelTimer: ReturnType<typeof setTimeout> | undefined;
  /** Whether the current wheel gesture started with a mouse's notch. */
  let wheelNotch = false;
  const sidewaysOf = wheelGestures();
  /** Whether the camera is on the showcase's stop, or going there. */
  const atShowcase = (): boolean => Math.abs(target - SHOWCASE_AT) < 0.01;
  const onWheel = (event: WheelEvent): void => {
    // A pinch on a trackpad, or ctrl and the wheel, zooms the page.
    if (event.ctrlKey) return;
    // Sideways, on the showcase, the wheel goes from project to project.
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      if (!atShowcase()) return;
      event.preventDefault();
      const way = sidewaysOf(event.deltaX, event.timeStamp);
      if (way !== 0) showcase.step(way);
      return;
    }
    if (event.deltaY === 0) return;
    event.preventDefault();
    const started = gestureOf(event.deltaY, event.timeStamp);
    if (!magnet.follows || hold) {
      // One gesture, one anchor (`?scroll=0`, or during a loading pause, whose end it waits for).
      if (started === 0) return;
      direction = started;
      const from = glide ? glide.to : window.scrollY;
      glideTo(stepFrom(from, started));
      return;
    }
    if (started !== 0 || !wheel) {
      // A gesture takes the view where it is, even under the magnet's glide (a trackpad's inertia, or a wheel going on
      // after a short stop, takes it back), and may take it as far as the next anchor in its direction.
      glide = null;
      holdFling(false);
      setSnap(false);
      const way = Math.sign(event.deltaY);
      const at = window.scrollY;
      const [below, above] = bracket(at, positions);
      const on = anchorAt(at, positions);
      if (started !== 0) wheelNotch = isNotch(event.deltaY, event.deltaMode);
      wheel = {
        from: on >= 0 ? on : way > 0 ? below : above,
        low: positions[below] ?? 0,
        high: positions[above] ?? 0,
        at,
        notch: wheelNotch,
      };
      direction = way;
    }
    // Each transition takes about a screen of wheel, however long its stretch of the track.
    const pixels = wheelPixels(event.deltaY, event.deltaMode, screen);
    const base = Math.max(wheel.low, Math.min(wheel.high, positions[wheel.from] ?? 0));
    const stretch = pixels > 0 ? wheel.high - base : base - wheel.low;
    const move = pixels * Math.max(1, stretch / screen);
    const top = Math.max(wheel.low, Math.min(wheel.high, wheel.at + move));
    wheel.at = top;
    window.scrollTo({ top, behavior: 'instant' });
    scrolled = top;
    target = progressOf(top);
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(releaseWheel, magnet.settle);
  };
  /** The wheel has stayed still: the magnet takes the view to an anchor. */
  function releaseWheel(): void {
    const drive = wheel;
    wheel = null;
    if (!drive) return;
    // A trackpad's own inertia has already carried a quick swipe as far as it goes: only the distance counts.
    const index = magnetAnchor(window.scrollY, positions, drive.from, 0, drive.notch, magnet);
    glideTo(index);
  }
  // A finger goes anchor by anchor too: a swipe of more than a few px leads to the next anchor in its direction, from
  // the anchor it started on; a shorter touch comes back to it. The snapping waits while the finger is down, so that
  // it never starts a move the glide would then undo.
  let touchStartY = 0;
  let touchStartX = 0;
  let touchX = 0;
  /** Whether the finger turns the ring rather than the page. */
  let sideways = false;
  /** Whether the finger has gone far enough for that to be told, once for the whole touch. */
  let decided = false;
  let touchY = 0;
  let touchFrom = 0;
  /** Where the page was when the finger came down. */
  let touchScroll = 0;
  let touchTime = 0;
  let touchSpeed = 0;
  let pinching = false;
  const onTouchStart = (event: TouchEvent): void => {
    // Two fingers zoom the page: not a swipe.
    pinching = event.touches.length > 1;
    if (pinching) return;
    touchScroll = window.scrollY;
    touchFrom = glide ? glide.to : touchScroll;
    interrupt();
    if (wheel) {
      wheel = null;
      clearTimeout(wheelTimer);
    }
    setSnap(false);
    touching = true;
    touchStartY = event.touches[0]?.clientY ?? 0;
    touchY = touchStartY;
    touchStartX = event.touches[0]?.clientX ?? 0;
    touchX = touchStartX;
    sideways = false;
    decided = false;
    touchTime = event.timeStamp;
    touchSpeed = 0;
  };
  const onTouchMove = (event: TouchEvent): void => {
    const y = event.touches[0]?.clientY ?? touchY;
    touchX = event.touches[0]?.clientX ?? touchX;
    // On the ring, a finger going sideways turns it, following the finger. Which way it goes is told once, from its
    // first moves, before the browser starts scrolling: a finger going more across than up or down turns the ring, and
    // the page holds still under it (the browser's own scrolling held back, up to the finger's last move, however it
    // drifts); else the page scrolls and the ring stays.
    const across = touchStartX - touchX;
    if (!decided && Math.max(Math.abs(across), Math.abs(touchStartY - y)) > SIDEWAYS_SLOP) {
      decided = true;
      sideways = atShowcase() && Math.abs(across) > Math.abs(touchStartY - y);
    }
    if (sideways) {
      if (event.cancelable) event.preventDefault();
      showcase.drag(across / (scene.view.width * 0.9));
    }
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
    if (sideways) {
      // A swipe of more than a few px brings the next project, or the previous one; the page stays on the ring.
      const across = touchStartX - touchX;
      showcase.release(Math.abs(across) > 40 ? Math.sign(across) : 0);
      sideways = false;
      glideTo(settleAnchor(touchFrom, positions, 0));
    } else if (magnet.follows) {
      // The view followed the finger: the magnet takes it on to the next anchor, or back.
      const from = nearestAnchor(touchFrom, positions);
      // The page scrolls with the finger, but may not have caught up with a quick one yet.
      const at = Math.abs(moved) > Math.abs(window.scrollY - touchScroll) ? touchScroll + moved : window.scrollY;
      const index = magnetAnchor(at, positions, from, touchSpeed, false, magnet);
      const way = Math.sign((positions[index] ?? 0) - window.scrollY);
      glideTo(index, Math.max(0, touchSpeed * way));
    } else if (Math.abs(moved) > 40) {
      const way = Math.sign(moved);
      glideTo(stepFrom(touchFrom, way), Math.max(0, touchSpeed * way));
    } else {
      glideTo(settleAnchor(touchFrom, positions, 0));
    }
    holdFling(glide !== null);
  };

  // A touch the system takes away (a gesture from the screen's edge, the notifications pulled down, a call coming in)
  // ends without a `touchend`: left as it was, the journey would go on waiting for the finger to lift, the snapping
  // off, and the page could rest between two anchors. It comes back to the anchor the touch started on.
  const onTouchCancel = (event: TouchEvent): void => {
    if (event.touches.length > 0 || !touching) return;
    touching = false;
    if (pinching) {
      setSnap(true);
      return;
    }
    if (sideways) {
      showcase.release(0);
      sideways = false;
    }
    glideTo(settleAnchor(touchFrom, positions, 0));
    holdFling(glide !== null);
  };

  // The keys go anchor by anchor, whatever the browser's snapping does with them.
  const onKey = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const element = event.target instanceof HTMLElement ? event.target : null;
    if (element?.closest('input, textarea, select, [contenteditable], [role="dialog"]')) return;
    if (isMenuOpen()) return;
    if (atShowcase() && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault();
      showcase.step(event.key === 'ArrowLeft' ? -1 : 1);
      return;
    }
    const at = glide ? glide.to : window.scrollY;
    let index: number | undefined;
    if (event.key === 'ArrowDown' || event.key === 'PageDown' || (event.key === ' ' && !event.shiftKey)) {
      index = stepFrom(at, 1);
    } else if (event.key === 'ArrowUp' || event.key === 'PageUp' || (event.key === ' ' && event.shiftKey)) {
      index = stepFrom(at, -1);
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
      if (!atShowcase()) glideTo(1);
      showcase.select(Number(item.dataset.project));
      return;
    }
    if (element?.closest('.showcase-ui')) {
      if (!atShowcase()) glideTo(1);
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
    // A card that is not in front comes in front first; the one in front opens.
    const index = Number(item.dataset.project);
    if (index !== focus) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!atShowcase()) glideTo(1);
      showcase.select(index);
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
    const id = decodeURIComponent(location.hash.slice(1));
    const index = fragmentAnchor.get(id);
    if (index === undefined) return;
    const card = cardIndex.get(id);
    if (card !== undefined) showcase.select(card, true);
    jumpTo(index);
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
        reanchorSoon();
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
      reanchorSoon();
    });
  };

  const pointer = followPointer(window);
  const ambient = ambientClock();

  // ---------- The showcase ----------

  /** The showcase's plane, where its cards are sharp: the first project's depth. */
  const SHOWCASE_Z = RING_DEPTH;
  let showcasePoses: Pose[] = [];

  /**
   * Places the showcase's cards and the cartel of the one in front, the whole showcase at its plane's depth: it comes
   * from behind the camera at the stop, and recedes toward the planet past it, as the cards of the journey do. Returns
   * the planet the showcase holds at its ring's centre, if any.
   */
  function drawShowcase(
    view: View,
    depth: number,
    sway: Sway,
    time: number,
    floatRest: number,
    k: number,
    diving: number,
    others: number,
  ): { x: number; y: number; diameter: number } {
    const ring = showcase.ring(view);
    const approach = ringApproach(depth, view, sway);
    let plane = cardLook({ z: SHOWCASE_Z } as CardPlace, depth);
    const relative = SHOWCASE_Z - depth;
    let presence = 1 - smoothstep(0.08, 0.45, Math.abs(relative));
    if (approach) {
      // On the way to the ring, the ring is already around the planet, larger while the camera is still close: it
      // comes into view as the camera draws back, once the opening's text has gone.
      plane = {
        depth: 0,
        scale: 1,
        opacity: smoothstep(0.4, 0.95, approach.t),
        blur: 10 * (1 - smoothstep(0.5, 1, approach.t)),
      };
      presence = smoothstep(0.7, 1, approach.t);
      set(world3d, 'transform-origin', '0 0');
      set(
        world3d,
        'transform',
        `translate(${approach.ox.toFixed(2)}px, ${approach.oy.toFixed(2)}px) scale(${approach.zoom.toFixed(4)})`,
      );
    } else set(world3d, 'transform', 'none');
    // The card in front is lit (its cartel, its hover, its click) as soon as the ring has nearly stopped on it.
    const selected = showcase.selected();
    const inFront = Math.abs(showcase.offsetOf(selected)) < 0.04 && presence > 0.9;
    focus = diving >= 0 ? diving : inFront ? selected : -1;
    const cardWidth = ring.card;
    const cardHeight = (cardWidth * 9) / 16;
    showcasePoses = scene.cards.map((_, i) => showcase.pose(i, view));
    // The hover of a card beside the front one fades in (450 ms) and out (650 ms), rather than switch.
    const glowNow = performance.now();
    const glowDelta = hoverGlowAt > 0 ? Math.min(100, glowNow - hoverGlowAt) : 0;
    hoverGlowAt = glowNow;
    showcasePoses.forEach((_, i) => {
      const want = hovered === i && focus !== i && presence > 0.9 ? 1 : 0;
      const was = hoverGlow[i] ?? 0;
      const eased = was + (want - was) * (1 - Math.exp(-glowDelta / (want > was ? 150 : 220)));
      hoverGlow[i] = Math.abs(want - eased) < 0.004 ? want : eased;
      if (hoverGlow[i] !== want) redraw = true;
    });
    showcasePoses.forEach((pose, i) => {
      const parts = cards[i];
      const place = scene.cards[i];
      if (!parts || !place) return;
      const z = Math.min(pose.z + plane.depth, 0.72);
      const scale = 1 / (1 - z);
      const lit = focus === i && diving < 0;
      // The probe's "cards held still": the cards keep the styles of the frame before, whatever the ring does.
      if (probing('cartes')) return;
      const lift = options.still ? 0 : 10 * swing(time, place.floatDuration, place.floatDelay) * (1 - floatRest);
      set(parts.float, 'transform', `translateY(${lift.toFixed(2)}px)`);
      if (i === diving && dive) {
        const card = { ...place, x: pose.x, y: pose.y, width: cardWidth * pose.scale, height: cardHeight * pose.scale };
        const flight = diveLook(card, { depth: z, scale, opacity: 1, blur: 0 }, view, k, dive.top);
        set(parts.place, 'transform', cssTransform(flight.x, flight.y, flight.depth, view, sway));
        cardPerspective(parts, flight.x, flight.y, flight.depth, lift, view);
        set(parts.link, 'opacity', '1');
        set(parts.shade, 'opacity', '1');
        set(parts.link, 'filter', 'none');
        set(parts.link, 'pointer-events', 'none');
        set(
          parts.spin,
          'transform',
          `rotateY(${(pose.rotateY * (1 - k)).toFixed(2)}deg) rotateZ(${(pose.rotateZ * (1 - k)).toFixed(2)}deg) translateZ(${(dive.lift * (1 - k)).toFixed(2)}px) scale(${pose.scale.toFixed(4)})`,
        );
        // The card's rim and its shadow fade out as it flies.
        set(parts.link, 'box-shadow', '0 0 0 0 rgb(255 255 255 / 0%)');
        set(parts.shade, 'box-shadow', '0 40px 80px -24px rgb(0 0 0 / 0%)');
        set(parts.link, 'border-radius', `${(dive.radius * (1 - k)).toFixed(2)}px`);
        set(parts.shade, 'border-radius', `${(dive.radius * (1 - k)).toFixed(2)}px`);
      } else {
        // A card the mouse is over, beside the one in front, lights up a little: a click brings it in front.
        const over = lit ? 0 : (hoverGlow[i] ?? 0);
        const opacity = Math.min(1, pose.opacity * (1 + 0.6 * over) + 0.12 * over) * plane.opacity * others;
        const blur = Math.max(pose.blur * (1 - 0.5 * over), plane.blur);
        set(parts.place, 'transform', cssTransform(pose.x, pose.y, z, view, sway));
        cardPerspective(parts, pose.x, pose.y, z, lift, view);
        set(parts.link, 'opacity', opacity.toFixed(3));
        set(parts.shade, 'opacity', opacity.toFixed(3));
        set(parts.link, 'filter', opacity > 0.004 ? blurFilter(blur) : 'none');
        set(parts.link, 'pointer-events', opacity > 0.12 && diving < 0 && presence > 0.5 ? 'auto' : 'none');
        set(
          parts.spin,
          'transform',
          `rotateY(${pose.rotateY.toFixed(2)}deg) rotateZ(${pose.rotateZ.toFixed(2)}deg) translateZ(${lit && hovered === i ? String(HOVER_LIFT) : '0'}px) scale(${pose.scale.toFixed(4)})`,
        );
        set(parts.link, 'box-shadow', '');
        set(parts.shade, 'box-shadow', '');
        set(parts.link, 'border-radius', '');
        set(parts.shade, 'border-radius', '');
      }
      parts.item.classList.toggle('lit', lit);
      if (!parts.cartel) return;
      // The cartel of the card in front: beside it on desktop, under it on a phone. It fades in as the ring settles,
      // rising a few px.
      const o = showcase.offsetOf(i);
      const shown = (1 - smoothstep(0.03, 0.3, Math.abs(o))) * presence * others * (diving >= 0 ? 0 : 1);
      const at = projectCss(pose.x, pose.y + lift, z, view, sway);
      const half = (cardWidth * pose.scale * at.scale) / 2;
      const rise = 10 * smoothstep(0, 0.3, Math.abs(o));
      let x: number;
      let y: number;
      let cartelWidth = 300;
      if (view.mobile) {
        // As wide as the card in front at rest, whatever the swipe does to this card and whatever the camera does to
        // the ring while it leaves it: its text never reflows, under the finger (Grégoire, 4 November 2026) or with
        // the scroll (11 November 2026). It follows the card's centre and its lower edge.
        const frontHalf = frontCardHalf(view, 0);
        x = at.x - frontHalf;
        y = at.y + (half * 9) / 16 + CARTEL_GAP + rise;
        cartelWidth = frontHalf * 2;
      } else {
        x = at.x + half * Math.cos((pose.rotateY * Math.PI) / 180) + 40;
        y = at.y + rise;
      }
      const back = (view.perspective - CARTEL_Z) / view.perspective;
      const bx = view.vpX + (x - view.vpX) * back;
      const by = view.vpY + (y - view.vpY) * back;
      set(parts.cartel, 'translate', `${bx.toFixed(1)}px ${by.toFixed(1)}px ${String(CARTEL_Z)}px`);
      set(parts.cartel, 'scale', back.toFixed(4));
      set(parts.cartel, '--cartel-width', `${cartelWidth.toFixed(1)}px`);
      set(parts.cartel, 'opacity', shown.toFixed(3));
      set(parts.cartel, 'transform', view.mobile ? 'none' : 'translate(0, -50%)');
    });
    return { x: ring.cx, y: ring.cy, diameter: ring.planet };
  }

  /** Half the width on screen of the card in front of the ring, at rest and without sway, for the plane at `depth`. */
  function frontCardHalf(view: View, depth: number): number {
    const front = showcase.pose(0, view, 0);
    const z = Math.min(front.z + depth, 0.72);
    const at = projectCss(front.x, front.y, z, view);
    // In whole px: the camera's sway never makes it breathe either.
    return Math.round(showcase.ring(view).card * front.scale * at.scale) / 2;
  }

  /**
   * The ring's planet on its way from the opening to the stop (depth 0 to `SHOWCASE_Z`), as one move of the camera
   * drawing back and turning: the planet, sharp all the way, shrinks by the same ratio for each step of depth and
   * slides to the ring's centre as it shrinks, as a camera receding toward that point would see it. `zoom`, `ox` and
   * `oy` map the ring as drawn at the stop onto this moment (screen = zoom · stop + offset). Null past the stop.
   */
  function ringApproach(
    depth: number,
    view: View,
    sway: Sway,
  ): { t: number; sP: number; x: number; y: number; zoom: number; ox: number; oy: number; diameter: number } | null {
    const held = showcase.ring(view);
    if (planetSize <= 0 || depth > SHOWCASE_Z) return null;
    const ringScale = held.planet / planetSize;
    const ring = projectCss(held.cx, held.cy, 0, view, sway);
    const t = Math.max(0, depth / SHOWCASE_Z);
    const sP = Math.pow(ringScale, t);
    const k = Math.abs(1 - ringScale) > 1e-3 ? (1 - sP) / (1 - ringScale) : t;
    const fromX = view.vpX + planetRest.x + sway.dx;
    const fromY = view.vpY + planetRest.y + sway.dy;
    const x = fromX + (ring.x - fromX) * k;
    const y = fromY + (ring.y - fromY) * k;
    const zoom = sP / ringScale;
    return { t, sP, x, y, zoom, ox: x - zoom * ring.x, oy: y - zoom * ring.y, diameter: held.planet };
  }

  // ---------- Drawing a frame ----------

  function draw(now: number): void {
    const { view } = scene;
    const u = current;
    const depth = cameraDepth(u);
    const tEnd = endProgress(u);
    const arrival = arrivalAt(u);
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
    const k = easeInOutCubic(diveT);
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

    // The cards on their ring, and the cartel of the one in front.
    const held = drawShowcase(view, depth, sway, time, floatRest, k, diving, others);

    // The small worlds give way to the ring's own stellar bodies around its stop.
    const worldsK = smoothstep(0.15, 0.6, Math.abs(SHOWCASE_Z - depth));
    scene.worlds.forEach((world, i) => {
      const parts = worlds[i];
      if (!parts) return;
      const look = worldLook(world, depth);
      const shown = look.opacity * worldsK >= 0.01;
      set(parts.body, 'visibility', shown ? 'visible' : 'hidden');
      if (!shown) return;
      set(parts.place, 'transform', cssTransform(world.x, world.y, look.depth, view, sway));
      set(parts.body, 'opacity', (look.opacity * (0.55 + 0.45 * light.stars) * starsK * others * worldsK).toFixed(3));
      set(parts.body, 'filter', blurFilter(look.blur));
      const s = options.still ? 0 : swing(time, world.floatDuration, world.floatDelay);
      set(parts.body, 'translate', `${(4 * s).toFixed(2)}px ${(-3 * s).toFixed(2)}px`);
    });

    // The planet: from the opening, it comes to the ring's centre, sharp all the way (see `ringApproach`); past the
    // ring, it recedes with it to a point of light, drifting toward the vanishing point.
    const approach = ringApproach(depth, view, sway);
    let sP: number;
    let dx: number;
    let dy: number;
    let blurPlanet = 0;
    if (approach) {
      sP = approach.sP;
      dx = approach.x - view.vpX - planetRest.x;
      dy = approach.y - view.vpY - planetRest.y;
    } else {
      const past = depth - SHOWCASE_Z;
      const at = projectCss(held.x, held.y, -past, view, sway);
      sP = (held.diameter / Math.max(1, planetSize)) * at.scale;
      dx = at.x - view.vpX - planetRest.x;
      dy = at.y - view.vpY - planetRest.y;
      blurPlanet = 12 * smoothstep(0.1, 0.8, past);
    }
    const planetState = { ...planetLook(Math.pow(sP, -1 / 1.3) - 1, light.sky, arrival), scale: sP, blur: blurPlanet };
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
        set(planetFrame, 'filter', blurFilter(planetState.blur));
      }
    }
    if (glow) {
      set(glow, 'transform', group);
      set(glow, 'opacity', (planetState.glowOpacity * others).toFixed(3));
    }
    drawPlanet(now, u, planetState.blur, moment);
    {
      const relative = SHOWCASE_Z - depth;
      const ring = projectCss(held.x, held.y, 0, view, sway);
      // The planet's disc hides the back of the ring: as drawn at the stop on the way there, where it is past it.
      const disc = approach
        ? { x: ring.x, y: ring.y, r: held.diameter / 2 }
        : { x: view.vpX + planetRest.x + dx, y: view.vpY + planetRest.y + dy, r: (planetSize * sP) / 2 };
      if (!probing('ciel'))
        showcase.draw({
          view,
          sway,
          shift: approach ? 0 : Math.min(relative, 0.72),
          presence:
            (approach ? smoothstep(0.4, 0.95, approach.t) : 1 - smoothstep(0.08, 0.45, Math.abs(relative))) * others,
          zoom: approach ? { k: approach.zoom, x: approach.ox, y: approach.oy } : null,
          time,
          planet: disc,
        });
    }
    // The office loads from the first project on.
    if (u >= (anchors[1] ?? 0) - 0.01 && html.dataset.office !== 'live') html.dataset.office = 'near';

    // The opening's text stays, then fades out rising; the call to action leaves at the first move.
    // It is gone before the ring's cards come into view.
    const fade = smoothstep(0.04, 0.36, depth / SHOWCASE_Z);
    if (intro) {
      set(intro, 'opacity', ((1 - fade) * others).toFixed(3));
      set(intro, 'transform', `translateY(${(-16 * fade).toFixed(1)}px)`);
      set(intro, 'pointer-events', fade < 0.5 ? 'auto' : 'none');
    }
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
    if (renderer && stars && swayMatrixOf && !probing('etoiles')) {
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
    const resting = current === target && !glide && !touching && !wheel ? restingAnchor(scrolled) : -1;
    root.dataset.anchor = resting >= 0 ? String(resting) : '';
  }

  // ---------- Start ----------

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  // Not passive: on the ring, a sideways finger holds the page still.
  window.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('touchend', onTouchEnd, { passive: true });
  window.addEventListener('touchcancel', onTouchCancel, { passive: true });
  // ---------- The live office ----------

  // It is prepared from the first project on (from the opening on a computer, at once on `#contact`), and drawn while the
  // contact shows. On a phone, which links its programs one by one, that takes seconds: begun at the middle of the
  // journey, it was not ready for a visitor going through the projects at a swipe each. Its first seconds on screen are
  // measured: lagging, it first draws at a little less resolution on a dense screen; kept too slow, it gives way to its
  // layers, which also stand in without WebGL, and for the arrival when it is still not ready after a short loading
  // pause.
  const OFFICE_START = anchors[1] ?? 0.1;
  /** On a computer, how long after the ambient motions start the office starts getting ready at the opening, in ms. */
  const OFFICE_EARLY_DELAY = 2500;
  let ambientAt = 0;
  // `?bureau=tot`: on a phone too, at the opening once the planet is ready, to try (Grégoire's choice to come; he chose
  // on 9 November 2026 not to start it at launch on phones, to keep the opening smooth).
  const officeEarlyOnPhones = new URLSearchParams(location.search).get('bureau') === 'tot';
  // Not ready by the middle of the journey, its layers get ready too.
  const OFFICE_WARM = SHOWCASE_AT;
  // `?office=live` keeps the live office whatever the rate; `?office=layers` shows the layers.
  const officeMode = new URLSearchParams(location.search).get('office');
  let officeView: OfficeView | null = null;
  let officeLoading = false;
  let officeSampler: FrameSampler | null = null;
  let officeSlow = officeMode === 'layers' || !options.webgl || (officeMode !== 'live' && isSlow('office'));
  let officeFailed = false;
  let lastOfficeDraw = 0;
  let officeFraming = '';
  /** What the live office's view draws: its scene's framing, moment and kind, for keeping it. */
  let officeScene: Omit<KeptOffice, 'scene'> = { framing: 'desktop', moment: 'crepuscule', kind: 'live' };
  /** The layers, ready to play the arrival if it comes before the live office, and what stops the live office then. */
  let standIn: OfficeView | null = null;
  let standInLoading = false;
  let officeAbort: AbortController | null = null;
  /** When the live office started getting ready, in ms. */
  let officeStartedAt = 0;
  /** How long the live office gets to be ready before its layers get ready too, in ms. */
  const STAND_IN_DELAY = 2500;
  /** Whether the live planet is still to be put together here: the ring shows it, so it comes before the office. */
  const planetComing = (): boolean =>
    options.webgl && !planetSlow && !planetFailed && !livePlanet && current <= PLANET_KEEP;

  function loadOffice(): void {
    if (officeLoading || !office) return;
    const host = office;
    officeLoading = true;
    officeStartedAt = performance.now();
    officeFraming = scene.view.mobile ? 'mobile' : 'desktop';
    const layers = officeSlow;
    const moment = html.dataset.moment === 'aube' ? 'aube' : 'crepuscule';
    const abort = new AbortController();
    officeAbort = abort;
    // Out of the frame: preparing reads the section's size, which would force a layout in the middle of a frame.
    void new Promise((resolve) => setTimeout(resolve))
      .then(() => import('../office/warmup'))
      .then(async ({ prepareOfficeScene, prepareLayersScene, viewOffice, framingOf, SlowOffice }) => {
        const framing = framingOf(host.clientWidth);
        // The scene of a former visit of the home, if it fits: only its HTML is laid again.
        let kind: 'live' | 'layers' = layers ? 'layers' : 'live';
        const kept = takeOffice(framing, moment, kind);
        const made: OfficeScene =
          kept ??
          (await (layers
            ? prepareLayersScene(host, host, { moment })
            : prepareOfficeScene(host, {
                modelUrl: withBase('/models/petit-prince.glb'),
                moment,
                still: options.still,
                forced: officeMode === 'live',
                signal: abort.signal,
              }).catch((error: unknown) => {
                if (error instanceof SlowOffice) {
                  officeSlow = true;
                  markSlow('office');
                  kind = 'layers';
                  return prepareLayersScene(host, host, { moment });
                }
                throw error;
              })));
        /** Whether the home was left meanwhile: the scene is kept for the way back, or let go. */
        const left = (scene: OfficeScene): boolean => {
          if (!stopped && officeLoading && !abort.signal.aborted) return false;
          if (stopped && keeping) keepOffice({ scene, framing, moment, kind });
          else scene.dispose();
          return true;
        };
        if (left(made)) return;
        // Its context lost on the way (see `onOfficeLost`): its layers are prepared instead, at the next frame.
        const gone = (): boolean => {
          if (!made.isLost()) return false;
          officeLoading = false;
          officeAbort = null;
          officeSlow = true;
          redraw = true;
          return true;
        };
        if (gone()) {
          made.dispose();
          return;
        }
        const created = await viewOffice(host, host, made, { moment, still: options.still, kept: kept !== null });
        if (left(made)) {
          created.release();
          return;
        }
        if (gone()) {
          created.dispose();
          return;
        }
        made.whenLost(onOfficeLost);
        officeScene = { framing, moment, kind };
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

  /** The layers' framing and moment, when they take the live office's place: what keeping them needs. */
  let standInScene: Omit<KeptOffice, 'scene'> = officeScene;

  /** Gets the layers ready to play the arrival in place of the live office, if it comes first. */
  function loadStandIn(): void {
    if (standIn || standInLoading || !office) return;
    const host = office;
    standInLoading = true;
    const moment = html.dataset.moment === 'aube' ? 'aube' : 'crepuscule';
    void import('../office/warmup')
      .then(({ prepareLayers, framingOf }) => {
        standInScene = { framing: framingOf(host.clientWidth), moment, kind: 'layers' };
        return prepareLayers(host, host, { moment, still: options.still });
      })
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

  function freeOffice(keep = false): void {
    officeLoading = false;
    // Kept, a preparation under way goes on, for the way back.
    if (!keep) officeAbort?.abort();
    officeAbort = null;
    freeStandIn();
    if (keep && officeView) {
      const scene = officeView.release();
      // Kept, it answers to the journey that takes it back (`src/scene/keep.ts` lets go of one lost meanwhile).
      scene.whenLost(null);
      keepOffice({ scene, ...officeScene });
    } else officeView?.dispose();
    officeView = null;
    officeSampler = null;
    if (html.dataset.office === 'live') html.dataset.office = 'near';
  }

  /**
   * The live office's WebGL context is lost (the GPU taken back while the tab was away, a driver's reset): its shadows
   * and environments are gone for good, so its layers take over, for the rest of the page only (nothing says the
   * device is slow). On screen, they are drawn where the arrival is; away from the contact, they are prepared when the
   * office is next asked for.
   */
  function onOfficeLost(): void {
    if (stopped || !officeView || officeScene.kind !== 'live') return;
    officeSlow = true;
    officeSampler = null;
    const arrival = arrivalAt(current);
    if (arrival > 0) replaceOffice(arrival);
    else freeOffice();
    redraw = true;
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
      // An office kept from a former visit of the home has nothing left to link: it comes back at once.
      if (hasKept().office && !officeFailed) loadOffice();
      // While the planet measures its first seconds on screen, the office's links would count against it.
      const planetMeasured =
        planetSampler !== null && html.dataset.planet !== undefined && html.dataset.planet !== 'image';
      // On a computer, it starts at the opening already, a little after the opening's arrival has played (the page's own
      // load comes first), once the planet is ready:
      // the visitor going fast through the projects then never meets its preparation.
      if (ambientAt === 0 && ambient.started()) ambientAt = now;
      const early =
        (!scene.view.mobile || officeEarlyOnPhones) &&
        ambientAt > 0 &&
        now - ambientAt > OFFICE_EARLY_DELAY &&
        !(planetLoading && !livePlanet && !planetSlow && !planetFailed && options.webgl);
      const from = early ? 0 : OFFICE_START - 0.01;
      // On the ring, the planet, which shows there, is put together first: back from a case study, the planet, the
      // office and its layers all got ready at once, and held the ring's first seconds (Grégoire, 4 November 2026). A
      // visitor heading for the contact gets the office at once (see the frame loop).
      if (!officeFailed && !planetComing() && (u >= OFFICE_WARM - 0.01 || (u >= from && !planetMeasured))) {
        loadOffice();
      }
      // Its layers get ready too only if the live office is slow to come: a few seconds after it started, or as soon
      // as the visitor heads for the contact. On a phone, as soon as the ring shows, whether the live office started or
      // not (it waits for the planet): the contact is one swipe away, and the live office, which links its programs
      // one by one there, is seldom ready in time on a first visit. The layers, pictures already loaded ahead, then
      // play the arrival rather than a loading pause (Grégoire, 10 November 2026).
      if (
        u >= OFFICE_WARM - 0.01 &&
        !officeSlow &&
        officeMode !== 'live' &&
        (officeLoading || scene.view.mobile) &&
        (scene.view.mobile || pastRing(target) || now - officeStartedAt > STAND_IN_DELAY)
      ) {
        loadStandIn();
      }
      if (arrival <= 0) return;
      if (!html.dataset.officeArrival) arrivedWith(standIn ? 'layers' : 'image');
      if (!standIn) return;
      // The arrival comes before the live office: its layers play it, and stay for the rest of the page. Its programs
      // are now in the browser's cache, so the next visit prepares it much faster.
      officeAbort?.abort();
      officeView = standIn;
      officeScene = standInScene;
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
      else if (verdict === 'lagging' && lowerResolution(window.devicePixelRatio || 1, scene.view.mobile)) {
        // Lagging: first a little less resolution on a dense screen, measured afresh.
        officeView.resize();
        officeSampler.reset();
      } else if (verdict === 'slow') {
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
      .then(({ prepareLayers, framingOf }) => {
        standInScene = { framing: framingOf(host.clientWidth), moment, kind: 'layers' };
        return prepareLayers(host, host, { moment, still: options.still, at: arrival });
      })
      .then((created) => {
        officeReplacing = false;
        if (stopped || !officeLoading) {
          created.dispose();
          return;
        }
        officeView?.dispose();
        officeView = created;
        officeScene = standInScene;
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
  /** Whether the frame where the camera came to rest has been drawn. */
  let restDrawn = true;
  // The glide scrolls first in the frame, before the job title or anything else writes a style.
  const stopGlideTick = onTick(stepGlide, { first: true });
  // The camera keeps its pace when frames are slow: the ticker caps a frame at 64 ms, which would stretch the 3.5 s
  // arrival at the office into much more on a device drawing a few frames a second. Up to 250 ms, it moves as far as
  // the time the frame took.
  let lastFrame = 0;
  // Through the projects, a device whose usual frame keeps the journey under 20 frames per second for several seconds of
  // moves (a browser drawing without its graphics card, say) is given the list for the rest of the visit, once the camera
  // rests (main spec §6.4). Only the frames of a move count, and each window of them is judged on its median frame, so
  // the hitches of a fast scroll never decide. When the moves lag while a scene is still being prepared, the page first
  // pauses once to let it finish, showing that it loads (`HOLD_MAX` at most), and measures again. The measurement run
  // (`?mesure=`) and `?lite=0` keep the journey; so do automated browsers, which draw in software on CI, unless
  // `?lite=auto` asks for the measure.
  const params = new URLSearchParams(location.search);
  const judged =
    params.get('lite') === 'auto' || (!navigator.webdriver && !params.has('mesure') && params.get('lite') !== '0');
  // The loading pauses play in the measurement run too, which reports them; not in automated browsers, unless
  // `?lite=auto` or `?pause=1` asks for them.
  const pauses = params.get('lite') === 'auto' || params.get('pause') === '1' || !navigator.webdriver;
  let journeySampler: FrameSampler | null = judged ? frameSampler(JOURNEY_MIN_FPS) : null;
  const lagSampler: FrameSampler | null = pauses ? frameSampler(LAG_FPS, undefined, 1) : null;
  let liteDue = false;
  let lagDue = false;
  let lagHeld = false;
  let arrivalHeld = false;

  /**
   * Whether a scene is still being prepared: the planet, or the live office (or its layers taking its place). The layers
   * getting ready to stand in do not count: decoding their pictures holds no frame, and on a phone they get ready on
   * the ring, where a pause would show for nothing.
   */
  const preparing = (): boolean =>
    (planetLoading && !livePlanet && !planetSlow && !planetFailed) ||
    (officeLoading && !officeView && !officeFailed) ||
    officeReplacing;
  /** Whether the live office is still getting ready, not found too slow: worth waiting for at the arrival. */
  const officeComing = (): boolean => officeLoading && !officeView && !officeFailed && !officeSlow;
  /**
   * Whether the arrival would have nothing to play it: the live office still getting ready, and its layers not ready
   * either. Once they are, they play it at once, without a pause.
   */
  const arrivalWaits = (): boolean => officeComing() && !standIn;

  function startHold(now: number, reason: Hold['reason']): void {
    hold = { reason, start: now, next: null };
    root.dataset.loading = reason;
    // At rest, a finger's native scroll waits too. The arrival's wait may begin under a glide, which goes on scrolling.
    if (reason === 'lag' && coarse.matches) html.style.overflow = 'hidden';
    performance.mark(`journey:hold-${reason}`);
  }

  function endHold(now: number): void {
    if (!hold) return;
    const { reason, start, next } = hold;
    hold = null;
    delete root.dataset.loading;
    if (reason === 'lag' && coarse.matches) html.style.removeProperty('overflow');
    performance.measure(`journey:hold-${reason}`, { start, end: now });
    // What came before the pause no longer tells the device's pace.
    journeySampler?.reset();
    lagSampler?.reset();
    if (next !== null) glideTo(next);
  }

  /**
   * While the ring turns (an arrow, a key, a finger), the scenes' long work waits, as it does for a scroll: a click on
   * an arrow is no scroll, and a shader linked meanwhile would stop the turn for a frame or more.
   */
  let turning: (() => void) | null = null;
  function holdWhileTurning(on: boolean): void {
    if (on && !turning) turning = holdStill();
    else if (!on && turning) {
      turning();
      turning = null;
    }
  }

  const stopTick = onTick((now, delta) => {
    const frame = lastFrame > 0 ? now - lastFrame : 0;
    const elapsed = delta >= 64 && lastFrame > 0 ? Math.min(250, frame) : delta;
    lastFrame = now;
    // The way to the ring and the ring itself, while the camera moves or the ring turns.
    const onProjects = current > 0 && current <= LAST_PROJECT + 1 / range;
    const moving = glide !== null || current !== target || !showcase.settled();
    if (frame > 0 && onProjects && !hold && moving) {
      const verdict = journeySampler?.add(frame);
      if (verdict === 'slow') {
        // Kept too slow: a scene still being prepared may be the cause, and gets its pause first.
        if (preparing() && !lagHeld) lagDue = true;
        else {
          markSlow('lite');
          liteDue = true;
          journeySampler = null;
        }
      }
      if (lagSampler?.add(frame) === 'slow' && preparing() && !lagHeld) lagDue = true;
    }
    // A visitor heading for the contact needs the office now, before the camera leaves the ring: one long frame may
    // carry it past.
    if (pastRing(target) && !officeView && !officeFailed) loadOffice();
    if (hold) {
      const waited = now - hold.start;
      const waiting = hold.reason === 'arrival' ? arrivalWaits() : preparing();
      if (waited >= HOLD_MAX || (waited >= HOLD_MIN && !waiting)) endHold(now);
    } else if (lagDue && !glide && current === target) {
      lagDue = false;
      lagHeld = true;
      if (preparing()) startHold(now, 'lag');
    } else if (
      pauses &&
      !arrivalHeld &&
      pastRing(target) &&
      current <= LAST_PROJECT &&
      arrivalWaits() &&
      !html.dataset.officeArrival
    ) {
      // The arrival comes before the live office and its layers are ready: the camera waits on the ring, for a few
      // seconds at most, rather than playing it with the still image.
      arrivalHeld = true;
      startHold(now, 'arrival');
    }
    if (liteDue && !glide && current === target && !hold) {
      liteDue = false;
      options.onLite?.(here());
      return;
    }
    pointer.update(delta);
    followCamera(elapsed);
    if (showcase.update(elapsed)) redraw = true;
    holdWhileTurning(!showcase.settled());
    const atRest = !glide && current === target && pointer.settled() && !redraw && !officeView?.busy();
    // Before the ambient motions start, nothing moves at rest: the frame drawn last still holds. The frame where the
    // camera comes to rest is always drawn, so that it says where it rests.
    if (atRest && restDrawn && (now - lastDraw < AMBIENT_FRAME || !ambient.started())) return;
    restDrawn = atRest;
    lastDraw = now;
    redraw = false;
    draw(now);
  });

  /** The fragment of the anchor nearest the scroll: on the ring, the project in front once it turned. */
  function here(): string | null {
    const index = nearestAnchor(window.scrollY, positions);
    const selected = showcase.selected();
    if (index === 1 && selected > 0) return cards[selected]?.item.id ?? null;
    return anchorFragment.get(index) ?? null;
  }

  /** The card of project `id`, if it is one. */
  const cardOf = (id: string): number | undefined => cardIndex.get(id);

  setJourney({
    has: (id) => fragmentAnchor.has(id),
    here,
    isAt: (id) => {
      const index = fragmentAnchor.get(id);
      const card = cardIndex.get(id);
      if (card !== undefined && (showcase.selected() !== card || !showcase.settled())) return false;
      return index !== undefined && anchorAt(scrolled, positions) === index && current === target;
    },
    jumpTo: (id) => {
      const index = fragmentAnchor.get(id);
      const card = cardIndex.get(id);
      if (card !== undefined) showcase.select(card, true);
      if (index !== undefined) jumpTo(index);
    },
    glideTo,
    turn: (way) => {
      showcase.step(way);
      redraw = true;
    },
    turned: () => showcase.settled(),
    dive: (id) => {
      const card = cardOf(id);
      const index = card === undefined ? undefined : card + 1;
      const parts = index === undefined ? undefined : cards[index - 1];
      if (index === undefined || !parts || dive) return null;
      const radius = parseFloat(getComputedStyle(parts.link).borderTopLeftRadius) || 0;
      endGlide();
      // The card under the mouse stands out of the screen (its hover): the flight brings it back from there, rather
      // than jump back at its first frame.
      const lift = focus === index - 1 && hovered === index - 1 && !scene.view.mobile ? HOVER_LIFT : 0;
      return new Promise<void>((resolve) => {
        dive = { index: index - 1, forward: true, start: -1, radius, lift, top: coverTop(), done: resolve };
        rest = { forward: true, start: -1 };
        redraw = true;
      });
    },
    undive: (id) => {
      const card = cardOf(id);
      const index = card === undefined ? undefined : card + 1;
      const parts = index === undefined ? undefined : cards[index - 1];
      if (index === undefined || !parts) return null;
      const radius = parseFloat(getComputedStyle(parts.link).borderTopLeftRadius) || 0;
      const back = new Promise<void>((resolve) => {
        dive = { index: index - 1, forward: false, start: -1, radius, lift: 0, top: coverTop(), done: resolve };
        // Everything is already at rest: the sway and the float come back once the card is home.
        rest = { forward: true, start: performance.now() - DIVE_MS };
      });
      // Drawn now, the card on the opening media, so that it takes over from the picture in the same frame.
      draw(performance.now());
      return back;
    },
  });

  return (keep = false) => {
    stopped = true;
    keeping = keep;
    stopTick();
    stopGlideTick();
    holdWhileTurning(false);
    endGlide();
    pointer.stop();
    ambient.stop();
    clearTimeout(settleTimer);
    clearTimeout(reanchorTimer);
    clearTimeout(wheelTimer);
    wheel = null;
    cancelAnimationFrame(resizeFrame);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('touchend', onTouchEnd);
    window.removeEventListener('touchcancel', onTouchCancel);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('hashchange', onHash);
    root.removeEventListener('focusin', onFocus);
    root.removeEventListener('click', onClick, true);
    root.removeEventListener('pointerover', onOver);
    setJourney(null);
    showcase.stop();
    stars?.dispose();
    if (keep && renderer) keepRenderer(renderer);
    else renderer?.dispose();
    freePlanet(keep);
    freeOffice(keep);
    markers.forEach((marker) => {
      marker.remove();
    });
    delete html.dataset.stars;
    delete html.dataset.office;
    delete html.dataset.officeScene;
    delete html.dataset.officeArrival;
    styles.reset();
    cards.forEach(({ item }) => {
      item.classList.remove('lit');
    });
    root.dataset.anchor = '';
    delete root.dataset.ringTight;
  };
}

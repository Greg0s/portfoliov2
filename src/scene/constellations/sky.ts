/**
 * The sky of constellations (proposals, `?constellations=1` to 3, desktop): the projects share one sky, on one anchor of
 * the journey, as two constellations. This controller knows where each project is on screen, which one the mouse or the
 * keyboard points at and how it shows, and what each constellation draws; it writes the labels and the legend, and
 * drives the WebGL field (`field.ts`, loaded with Three.js) that draws the stars, the planets and the lines.
 *
 * A project shows in one of two ways. On the planetarium (1), it is a planet, and its own card opens as a preview in
 * the middle. On the chart (2) and the focus (3), it is its own card from the start: the card grows and comes toward
 * the middle, on the chart pushing the other cards aside along their threads (`web.ts`), on the focus taking the focus.
 * Either way, the card is the project's: a click dives into its case study as on the journey.
 */
import './sky.css';
import { designFor, GROUP_OF, SKY_DEPTH, type BodySpec, type Group, type SkyDesign } from './designs';
import { stepWeb, webEdges, type WebEdge, type WebNode } from './web';
import { projectCss, smoothstep, type Sway } from '../journey/camera';
import type { CardPlace, View } from '../journey/layout';
import type { Pointer } from '../../motion/tilt';
import type { Renderer } from '../renderer';
import type { Field, FieldFrame } from './field';

export interface SkyInput {
  now: number;
  /** The ambient time, in ms (0 while the ambient motions wait). */
  time: number;
  depth: number;
  view: View;
  sway: Sway;
  pointer: Pointer;
  /** The card under the mouse (its index), or -1. */
  overCard: number;
  /** The card diving into its case study, or -1. */
  diving: number;
  /** How much the rest of the scene still shows during a dive (1 to 0). */
  others: number;
  /** The stars' light: the moment's, faded out at the office's arrival. */
  stars: number;
  /** How much the mouse tilts the sky (0 on still frames). */
  tilt: number;
  still: boolean;
}

export interface CardShow {
  alpha: number;
  /** The card's scale, on top of the perspective's. */
  scale: number;
  /** Its depth in front of the focus plane, in perspective units. */
  depth: number;
  /** Its blur, in px, before the perspective scales it. */
  blur: number;
  /** How far the card stands out toward the mouse over it, in px. */
  lift: number;
}

export interface CartelShow {
  /** Top left of the cartel, in px from the top left of the screen. */
  x: number;
  y: number;
  width: number;
  align: 'left' | 'center';
  alpha: number;
}

export interface SkyLook {
  /** The project shown (its card's index), or -1. */
  active: number;
  /** Each card's place, from the vanishing point, before the perspective (as the journey places its cards). */
  places: CardPlace[];
  cards: CardShow[];
  cartels: CartelShow[];
  /** The cartels' depth, in front of every card. */
  cartelDepth: number;
  /** How much a shown preview dims the Little Prince's planet behind it (0 to 1). */
  planetDim: number;
  /** Whether the "See the project" disc shows. */
  cursor: boolean;
  /** Whether something still moves on its own: the next frame must be drawn. */
  busy: boolean;
}

export interface Sky {
  design: SkyDesign;
  /** The cards' size and default place, for the journey's layout. */
  layout(view: View, cards: readonly CardPlace[]): CardPlace[];
  /** Adds the WebGL field to the renderer's scene, once Three.js has loaded. */
  attach(renderer: Renderer): void;
  frame(input: SkyInput): SkyLook;
  /** The project under the mouse (its card's index), or -1. */
  hit(): number;
  /** The card that has the keyboard's focus, or -1. */
  focusCard(index: number): void;
  /** Back from a case study: the project shows until the mouse points elsewhere. */
  hold(index: number): void;
  /** How far the card stands out toward the mouse, in px, for the dive to start from there. */
  lift(index: number): number;
  dispose(): void;
}

const HOVER_LIFT = 18;
/** On arrival, both constellations draw themselves for this long. */
const INTRO_MS = 3400;
/** After the mouse leaves a project or its card, it still shows this long, so that the mouse can reach it. */
const GRACE_MS = 520;
/** How far the sky tilts toward the mouse, in degrees, on top of the camera's own tilt: the depth shows. */
const SKY_TILT_X = 2.4;
const SKY_TILT_Y = 4.5;
/** The room a card's name, then its cartel, takes under it (the chart), in design px. */
const LABEL_ROOM = 24;
const CARTEL_ROOM = 175;
/** Where a card that shows heads for, from the vanishing point, on a 1440 × 900 screen: a little above the middle. */
const MIDDLE = { x: 0, y: -40 };

const ease = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number): number => 1 - Math.pow(1 - t, 3);
const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;

/** Moves `value` toward `target`, with a time constant of `tau` ms. */
function approach(value: number, target: number, delta: number, tau: number): number {
  const next = value + (target - value) * (1 - Math.exp(-delta / tau));
  return Math.abs(target - next) < 0.001 ? target : next;
}

/** Moves `value` toward `target` at a steady pace: from 0 to 1 in `duration` ms. */
function toward(value: number, target: number, delta: number, duration: number): number {
  const step = delta / duration;
  return value < target ? Math.min(target, value + step) : Math.max(target, value - step);
}

/** How a body fades with its depth in front of the focus plane: as the cards do (journey spec §5). */
export function depthFade(rel: number): number {
  if (rel >= 0.72) return 0;
  const near = rel > 0 ? 1 - smoothstep(0.36, 0.72, rel) : 1 - 0.75 * smoothstep(0.12, 1.3, -rel);
  return near * (1 - smoothstep(0.6, 2.2, -rel));
}

/** A card's blur out of the focus (proposal 3), in px, for its distance from the focused depth. */
function focusBlur(distance: number): number {
  return 11 * smoothstep(0.04, 0.42, distance);
}

interface BodyState {
  spec: BodySpec;
  card: number;
  group: Group;
  /** Where it is, from the vanishing point, in px at the focus plane of this screen, and its depth. */
  x: number;
  y: number;
  dz: number;
  /** Where it is on screen, and its scale there. */
  sx: number;
  sy: number;
  scale: number;
  fade: number;
  /** Its card's size on screen (the chart and the focus). */
  width: number;
  height: number;
  /** How much it stands out (0 to 1), and how much it is dimmed by another one standing out. */
  glow: number;
  dim: number;
  label: HTMLElement;
}

const LABELS: Record<Group, { fr: string; en: string }> = {
  perso: { fr: 'Projets perso', en: 'Personal projects' },
  pro: { fr: 'Projets pro', en: 'Professional projects' },
};

const LONG_NAMES: Record<Group, { fr: string; en: string }> = {
  perso: { fr: 'Projets personnels', en: 'Personal projects' },
  pro: { fr: 'Projets professionnels', en: 'Professional projects' },
};

export function createSky(variant: number, stage: HTMLElement, slugs: readonly string[]): Sky {
  const design = designFor(variant);
  const cardsSpec = design.cards;
  const lang = document.documentElement.lang.startsWith('en') ? 'en' : 'fr';
  const titles = slugs.map(
    (slug) => document.getElementById(slug)?.querySelector('.cartel h3')?.textContent.trim() ?? slug,
  );

  // ---------- The overlay: the labels, the constellations' names, the legend ----------

  const overlay = document.createElement('div');
  overlay.className = 'sky';
  overlay.dataset.look = design.look;
  overlay.setAttribute('aria-hidden', 'true');
  const journeySection = stage.querySelector('.journey');
  stage.insertBefore(overlay, journeySection);

  const bodies: BodyState[] = design.bodies.flatMap((spec) => {
    const card = slugs.indexOf(spec.slug);
    const group = GROUP_OF[spec.slug];
    if (card < 0 || !group) return [];
    const label = document.createElement('div');
    label.className = 'sky-label';
    label.dataset.group = group;
    label.dataset.slug = spec.slug;
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = titles[card] ?? spec.slug;
    label.append(name);
    overlay.append(label);
    return [
      {
        spec,
        card,
        group,
        x: 0,
        y: 0,
        dz: spec.dz,
        sx: -1000,
        sy: -1000,
        scale: 1,
        fade: 0,
        width: 0,
        height: 0,
        glow: 0,
        dim: 0,
        label,
      },
    ];
  });
  const bodyOfCard = new Map(bodies.map((body) => [body.card, body]));

  // The constellations' names, written on the chart (in space, the field writes them).
  const names = (design.namesIn === 'chart' ? (design.names ?? []) : []).map((place) => {
    const element = document.createElement('div');
    element.className = 'sky-name';
    element.dataset.group = place.group;
    element.textContent = LONG_NAMES[place.group][lang];
    overlay.append(element);
    return { place, element };
  });

  // The legend: a click draws a constellation, and keeps it until another click.
  let legendGroup: Group | null = null;
  let legendHover: Group | null = null;
  let legend: HTMLElement | null = null;
  const legendButtons = new Map<Group, HTMLButtonElement>();
  if (design.legend) {
    legend = document.createElement('div');
    legend.className = 'sky-legend';
    legend.dataset.look = design.look;
    legend.setAttribute('role', 'group');
    legend.setAttribute('aria-label', 'Constellations');
    (['perso', 'pro'] as const).forEach((group) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.group = group;
      button.setAttribute('aria-pressed', 'false');
      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      swatch.setAttribute('aria-hidden', 'true');
      const text = document.createElement('span');
      text.textContent = LABELS[group][lang];
      button.append(swatch, text);
      button.addEventListener('click', () => {
        legendGroup = legendGroup === group ? null : group;
        legendButtons.forEach((other, key) => {
          other.setAttribute('aria-pressed', String(key === legendGroup));
        });
      });
      button.addEventListener('pointerenter', () => {
        legendHover = group;
      });
      button.addEventListener('pointerleave', () => {
        if (legendHover === group) legendHover = null;
      });
      legendButtons.set(group, button);
      legend?.append(button);
    });
    // Outside the hidden overlay: the legend can be used.
    stage.insertBefore(legend, journeySection);
  }

  // ---------- The chart's threads (proposal 2) ----------

  const web: WebNode[] = [];
  let edges: WebEdge[] = [];
  if (cardsSpec?.linked) {
    for (const body of bodies) {
      web.push({
        hx: body.spec.x,
        hy: body.spec.y,
        x: body.spec.x,
        y: body.spec.y,
        vx: 0,
        vy: 0,
        hw: 0,
        hh: 0,
        below: 0,
        tx: 0,
        ty: 0,
        mass: 1,
      });
    }
    for (const minor of design.minors) {
      web.push({
        hx: minor.x,
        hy: minor.y,
        x: minor.x,
        y: minor.y,
        vx: 0,
        vy: 0,
        hw: 0,
        hh: 0,
        below: 0,
        tx: minor.x,
        ty: minor.y,
        mass: 1,
      });
    }
    const nodeOf = (ref: string | number): number =>
      typeof ref === 'number' ? bodies.length + ref : bodies.findIndex((body) => body.spec.slug === ref);
    const pairs: [number, number][] = [];
    for (const path of design.paths) {
      for (let i = 0; i + 1 < path.points.length; i += 1) {
        const from = path.points[i];
        const to = path.points[i + 1];
        if (from === undefined || to === undefined) continue;
        pairs.push([nodeOf(from), nodeOf(to)]);
      }
    }
    edges = webEdges(web, pairs);
  }
  /** Where each faint star is (the chart's move with their threads), as the field wants it. */
  const minorPlaces = design.minors.map((minor) => ({ x: 0, y: 0, dz: minor.dz }));

  // ---------- State ----------

  let view: View | null = null;
  let sxScale = 1;
  let syScale = 1;
  let previewSize = { width: 0, height: 0 };
  let field: Field | null = null;
  let attaching = false;
  let disposed = false;

  let starHover = -1;
  let keyboard = -1;
  let held = -1;
  let heldAt = { x: 0, y: 0 };
  let grace = -1;
  let graceUntil = 0;
  let lastNow = 0;
  /** When the camera first rested on the sky: both constellations draw themselves once. */
  let introAt = -1;
  /** Coming back from a case study: the constellations don't draw again as on arrival. */
  let introSkipped = false;
  /** Per card: how much its preview shows (alpha), how far it has grown out (shown), its lift. */
  const shows = slugs.map(() => ({ alpha: 0, shown: 0, lift: 0 }));
  const draws: Record<Group, number> = { perso: 0, pro: 0 };
  const lineAlpha: Record<Group, number> = { perso: 0, pro: 0 };
  const nameAlpha: Record<Group, number> = { perso: 0, pro: 0 };
  /** The depth the focus rests on (proposal 3), relative to the sky's. */
  let focusDz = 0;
  /** The card's place and look, kept still while it dives. */
  const frozen = new Map<number, { place: CardPlace; show: CardShow }>();
  const places: CardPlace[] = slugs.map((_, index) => ({
    index,
    z: SKY_DEPTH,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    rotateY: 0,
    rotateZ: 0,
    onLeft: false,
    floatDuration: 9000,
    floatDelay: 0,
  }));

  /** The width of a card at rest and once shown, in design px (1440 px wide screen). */
  const restWidth = ((cardsSpec?.rest ?? 0) / 100) * 1440;
  const shownWidth = ((cardsSpec?.shown ?? 0) / 100) * 1440;

  function skySway(input: SkyInput): Sway {
    const k = input.tilt;
    return {
      ...input.sway,
      tiltX: input.sway.tiltX + input.pointer.y * SKY_TILT_X * k,
      tiltY: input.sway.tiltY - input.pointer.x * SKY_TILT_Y * k,
    };
  }

  /** Where a card is (design px), its depth and its width (design px), at `shown` (0 to 1). */
  function cardPose(body: BodyState, shown: number): { x: number; y: number; d: number; width: number } {
    const spec = body.spec;
    const pull = cardsSpec?.pull ?? 0;
    const k = ease(shown);
    const width = lerp(restWidth / (1 - spec.dz), shownWidth, k);
    const d = lerp(spec.dz, cardsSpec?.front ?? 0, k);
    const node = web[bodies.indexOf(body)];
    if (node) return { x: node.x, y: node.y, d, width };
    return {
      x: lerp(spec.x, spec.x + (MIDDLE.x - spec.x) * pull, k),
      y: lerp(spec.y, spec.y + (MIDDLE.y - spec.y) * pull, k),
      d,
      width,
    };
  }

  /** The project under the mouse: a planet, or a card (its box now, and where it rests for the one shown). */
  function hitTest(x: number, y: number, current: View, sway: Sway, relBase: number): number {
    if (!cardsSpec) {
      let best = -1;
      let bestDistance = Infinity;
      for (const body of bodies) {
        if (body.fade < 0.3) continue;
        let radius = body.spec.r * body.scale * sxScale + 14;
        // A planet already under the mouse keeps it a little further, as the sky sways.
        if (body.card === starHover) radius *= 1.35;
        const distance = Math.hypot(x - body.sx, y - body.sy);
        if (distance < radius && distance < bestDistance) {
          best = body.card;
          bestDistance = distance;
        }
      }
      return best;
    }
    const inside = (cx: number, cy: number, w: number, h: number, margin: number): boolean =>
      Math.abs(x - cx) <= w / 2 + margin && Math.abs(y - cy) <= h / 2 + margin;
    // The nearest card first: it is drawn over the others.
    const order = [...bodies].sort((a, b) => b.dz - a.dz);
    for (const body of order) {
      if (body.fade < 0.3) continue;
      if (inside(body.sx, body.sy, body.width, body.height, 4)) return body.card;
    }
    // The card shown also keeps the place it came from, so that it doesn't run away from the mouse.
    const kept = bodyOfCard.get(starHover);
    if (kept) {
      const home = cardPose(kept, 0);
      const projected = projectCss(
        kept.spec.x * sxScale * (1 - home.d),
        kept.spec.y * syScale * (1 - home.d),
        relBase + home.d,
        current,
        sway,
      );
      const w = (restWidth * sxScale * projected.scale * (1 - home.d)) / (1 - kept.spec.dz);
      if (inside(projected.x, projected.y, w, (w * 9) / 16, 10)) return kept.card;
    }
    return -1;
  }

  const sky: Sky = {
    design,
    layout(next, cards) {
      view = next;
      sxScale = next.width / 1440;
      syScale = next.height / 900;
      const width = ((cardsSpec?.shown ?? design.previewWidth) / 100) * next.width;
      previewSize = { width, height: (width * 9) / 16 };
      field?.resize(next);
      return cards.map((card, index) => {
        const place = places[index];
        if (!place) return card;
        place.width = previewSize.width;
        place.height = previewSize.height;
        place.z = SKY_DEPTH;
        return { ...place };
      });
    },

    attach(renderer) {
      if (field || attaching) return;
      attaching = true;
      void import('./field').then(({ createField }) => {
        attaching = false;
        if (disposed || !view) return;
        const images = slugs.map((slug) => document.getElementById(slug)?.querySelector<HTMLImageElement>('.card img'));
        field = createField(design, renderer, view, {
          cards: bodies.map((body) => body.card),
          images: bodies.map((body) => images[body.card] ?? null),
          names: { perso: LABELS.perso[lang], pro: LABELS.pro[lang] },
        });
      });
    },

    frame(input) {
      const { now, view: current } = input;
      const delta = lastNow > 0 ? Math.min(100, now - lastNow) : 16;
      lastNow = now;
      const pointer = input.pointer;
      const sway = skySway(input);
      // The sky's depth in front of the focus plane: 0 when the camera rests on it.
      const relBase = SKY_DEPTH - input.depth;
      const near = 1 - smoothstep(0.03, 0.35, Math.abs(relBase));
      const settled = Math.abs(relBase) < 0.004;
      if (settled && introAt < 0) introAt = introSkipped ? now - INTRO_MS : now;
      if (Math.abs(relBase) > 0.6) {
        introAt = -1;
        introSkipped = false;
      }
      const diving = input.diving;
      let busy = false;

      // Where each project is, and on screen.
      const place = (body: BodyState): void => {
        let x = body.spec.x;
        let y = body.spec.y;
        let d = body.spec.dz;
        let width = 0;
        if (cardsSpec) {
          const pose = cardPose(body, shows[body.card]?.shown ?? 0);
          ({ x, y, d, width } = pose);
        }
        // Placed so that, the camera on the sky, it shows where the design puts it on screen.
        body.x = x * sxScale * (1 - d);
        body.y = y * syScale * (1 - d);
        body.dz = d;
        const rel = relBase + d;
        const projected = projectCss(body.x, body.y, rel, current, sway);
        body.sx = projected.x;
        body.sy = projected.y;
        body.scale = projected.scale;
        body.fade = depthFade(relBase + body.spec.dz);
        body.width = width * sxScale * projected.scale * (1 - d);
        body.height = (body.width * 9) / 16;
      };
      bodies.forEach(place);

      // Which project shows: under the mouse, its card under the mouse, the keyboard's, the one coming back.
      starHover = near > 0.6 && diving < 0 ? hitTest(pointer.clientX, pointer.clientY, current, sway, relBase) : -1;
      if (
        held >= 0 &&
        heldAt.x >= 0 &&
        Math.hypot(pointer.clientX - heldAt.x, pointer.clientY - heldAt.y) > 24 &&
        starHover !== held
      ) {
        held = -1;
      }
      const pointed = starHover >= 0 ? starHover : input.overCard;
      if (pointed >= 0) {
        grace = pointed;
        graceUntil = now + GRACE_MS;
      }
      let active = -1;
      if (diving >= 0) active = diving;
      else if (pointed >= 0) active = pointed;
      else if (grace >= 0 && now < graceUntil) active = grace;
      else if (keyboard >= 0) active = keyboard;
      else if (held >= 0) active = held;
      if (near < 0.5 && diving < 0) active = -1;
      const activeBody = bodyOfCard.get(active);
      const activeGroup = activeBody?.group ?? null;

      // How far each project shows.
      shows.forEach((show, index) => {
        const target = index === active ? 1 : 0;
        const before = show.alpha + show.shown;
        show.alpha = toward(show.alpha, target, delta, target ? 260 : 170);
        show.shown = toward(show.shown, target, delta, cardsSpec ? (target ? 480 : 380) : target ? 420 : 170);
        show.lift = approach(show.lift, index === pointed && index === active ? HOVER_LIFT : 0, delta, 120);
        if (show.alpha + show.shown !== before || (show.lift > 0.05 && show.lift < HOVER_LIFT - 0.05)) busy = true;
      });

      // The chart's threads: the card shown grows toward the middle, the others make room.
      if (cardsSpec?.linked && web.length > 0) {
        bodies.forEach((body, i) => {
          const node = web[i];
          if (!node) return;
          const shown = ease(shows[body.card]?.shown ?? 0);
          const width = lerp(restWidth / (1 - body.spec.dz), shownWidth, shown);
          node.hw = width / 2;
          node.hh = (width * 9) / 32;
          // Room for its name under it, or for its cartel once it shows.
          node.below = LABEL_ROOM + (CARTEL_ROOM - LABEL_ROOM) * shown;
          node.tx = lerp(node.hx, node.hx + (MIDDLE.x - node.hx) * cardsSpec.pull, shown);
          node.ty = lerp(node.hy, node.hy + (MIDDLE.y - node.hy) * cardsSpec.pull, shown);
          node.mass = body.card === active ? 6 : 1;
        });
        if (input.still) {
          web.forEach((node) => {
            node.x = node.tx;
            node.y = node.ty;
          });
        } else if (stepWeb(web, edges, delta / 1000)) busy = true;
        bodies.forEach(place);
      }
      design.minors.forEach((minor, i) => {
        const node = web[bodies.length + i];
        const where = minorPlaces[i];
        if (!where) return;
        where.x = (node ? node.x : minor.x) * sxScale * (1 - minor.dz);
        where.y = (node ? node.y : minor.y) * syScale * (1 - minor.dz);
      });

      // The focus rests on the project shown, come forward (proposal 3), else on the sky.
      if (design.look === 'focus') {
        const want = active >= 0 ? (cardsSpec?.front ?? 0) : 0;
        const before = focusDz;
        focusDz = approach(focusDz, want, delta, 300);
        if (before !== focusDz) busy = true;
      }

      // The cards: the previews (planetarium), or the projects' own cards (chart, focus).
      const cards: CardShow[] = [];
      const cartels: CartelShow[] = [];
      let cartelDepth = 0.1;
      slugs.forEach((_, index) => {
        const cardPlace = places[index];
        const show = shows[index];
        if (!cardPlace || !show) return;
        const body = bodyOfCard.get(index);
        const kept = frozen.get(index);
        if (index === diving && kept) {
          Object.assign(cardPlace, kept.place);
          cards.push({ ...kept.show });
          cartels.push({ x: 0, y: 0, width: 0, align: 'left', alpha: 0 });
          return;
        }
        frozen.delete(index);
        if (!cardsSpec) {
          // A preview in the middle, fading in as it rises a little.
          const k = ease(show.alpha);
          cardPlace.x = 0;
          cardPlace.y = -40 * syScale;
          cards.push({ alpha: k, scale: 0.94 + 0.06 * easeOut(show.alpha), depth: 0, blur: 0, lift: show.lift });
          cartels.push({
            x: current.vpX - cardPlace.width / 2,
            y: current.vpY + cardPlace.y + cardPlace.height / 2 + 22,
            width: cardPlace.width,
            align: 'center',
            alpha: index === diving ? 0 : Math.max(0, (show.alpha - 0.35) / 0.65),
          });
          return;
        }
        if (!body) {
          // A project in neither constellation stays out of the sky.
          cards.push({ alpha: 0, scale: 0.4, depth: 0, blur: 0, lift: 0 });
          cartels.push({ x: 0, y: 0, width: 0, align: 'left', alpha: 0 });
          return;
        }
        const shown = ease(show.shown);
        const pose = cardPose(body, show.shown);
        cardPlace.x = body.x;
        cardPlace.y = body.y;
        const depth = relBase + body.dz;
        // Its own scale, so that the perspective shows it at its width.
        const scale = ((pose.width * sxScale) / previewSize.width) * (1 - body.dz);
        // Out of focus: on arrival, as the journey's cards; on the focus, away from the focused depth.
        let blur = 12 * smoothstep(0.1, 0.8, Math.abs(relBase));
        if (design.look === 'focus') {
          const wide = active >= 0 ? 1.25 : 1;
          blur = Math.max(blur, focusBlur(Math.abs(body.dz - focusDz) * wide) * (1 - shown));
          // The project shown takes the whole focus: the others, near or far, blur away.
          if (active >= 0 && index !== active) blur = Math.max(blur, 6 * ease(shows[active]?.shown ?? 0));
        }
        const aside = active >= 0 && index !== active ? 1 : 0;
        const dimmed = design.look === 'focus' ? 0.3 : 0.12;
        cards.push({
          alpha: body.fade * (1 - dimmed * aside * ease(shows[active]?.shown ?? 0)),
          scale,
          depth,
          blur,
          lift: show.lift,
        });
        cartelDepth = Math.max(cartelDepth, depth + 0.05);
        cartels.push({
          x: body.sx - body.width / 2,
          y: body.sy + body.height / 2 + 20,
          width: Math.min(body.width, 420 * sxScale),
          align: 'left',
          alpha: Math.max(0, (shown - 0.5) / 0.5),
        });
      });
      if (diving >= 0 && !frozen.has(diving)) {
        const cardPlace = places[diving];
        const show = cards[diving];
        if (cardPlace && show) frozen.set(diving, { place: { ...cardPlace }, show: { ...show } });
      }

      // The constellations: drawn once on arrival, then when one of their projects shows or the legend asks.
      const intro = introAt >= 0 ? now - introAt : -1;
      const introDraw = intro >= 0 && intro < INTRO_MS;
      const always = design.look === 'chart';
      const legendShown = legendHover ?? legendGroup;
      (['perso', 'pro'] as const).forEach((group) => {
        const wanted = introDraw || activeGroup === group || legendShown === group || (always && intro >= 0) ? 1 : 0;
        const before = draws[group] + lineAlpha[group] + nameAlpha[group];
        draws[group] = wanted ? toward(draws[group], 1, delta, 1300) : toward(draws[group], 0, delta, 520);
        let alpha: number;
        if (always) {
          const lit = activeGroup ?? legendShown;
          alpha = lit === null ? 0.34 : lit === group ? 0.8 : 0.16;
        } else {
          alpha = wanted ? 0.62 : 0.4;
        }
        lineAlpha[group] = approach(lineAlpha[group], alpha, delta, 160);
        // In space, a constellation's name shows while one of its projects does.
        nameAlpha[group] = approach(nameAlpha[group], activeGroup === group ? 1 : 0, delta, activeGroup ? 260 : 200);
        if (draws[group] + lineAlpha[group] + nameAlpha[group] !== before) busy = true;
      });

      // How much each project stands out.
      const lit = activeGroup ?? legendShown;
      for (const body of bodies) {
        const glowTarget = body.card === active ? 1 : 0;
        const dimTarget =
          active >= 0
            ? body.card === active
              ? 0
              : body.group === activeGroup
                ? 0.25
                : 0.72
            : lit && body.group !== lit
              ? 0.6
              : 0;
        const g = body.glow;
        const d = body.dim;
        body.glow = approach(body.glow, glowTarget, delta, 140);
        body.dim = approach(body.dim, dimTarget, delta, 180);
        if (g !== body.glow || d !== body.dim) busy = true;
      }

      // The overlay: the names of the projects, and the constellations' on the chart.
      const presence = near * input.others * Math.min(1, input.stars / 0.7);
      overlay.style.opacity = presence.toFixed(3);
      overlay.style.visibility = presence > 0.004 ? 'visible' : 'hidden';
      for (const body of bodies) {
        const label = body.label;
        let alpha = body.fade;
        const x = body.sx;
        let y = body.sy;
        if (cardsSpec) {
          // Under its card, until the card shows its cartel.
          y += body.height / 2 + 10;
          alpha *= 1 - smoothstep(0, 0.4, shows[body.card]?.shown ?? 0);
          alpha *= 1 - 0.55 * body.dim;
          if (design.look === 'focus') alpha *= 1 - 0.45 * smoothstep(0.04, 0.42, Math.abs(body.dz - focusDz));
        } else {
          y += body.spec.r * body.scale * sxScale + 12;
          alpha *= 1 - 0.75 * body.dim;
        }
        label.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        label.style.opacity = alpha.toFixed(3);
        label.classList.toggle('on', body.card === active);
      }
      for (const { place: name, element } of names) {
        const projected = projectCss(name.x * sxScale, name.y * syScale, relBase, current, sway);
        element.style.transform = `translate(${projected.x.toFixed(1)}px, ${projected.y.toFixed(1)}px) translate(-50%, -50%) rotate(${String(name.angle)}deg)`;
        const alpha = lit === null ? 0.7 : lit === name.group ? 1 : 0.28;
        element.style.opacity = alpha.toFixed(3);
      }
      if (legend) {
        legend.style.opacity = (near * input.others).toFixed(3);
        legend.style.visibility = near > 0.05 ? 'visible' : 'hidden';
        legendButtons.forEach((button, group) => {
          button.classList.toggle('on', lit === group);
        });
      }

      // The field.
      if (field) {
        const frame: FieldFrame = {
          time: input.time,
          view: current,
          sway,
          relBase,
          presence: input.others * input.stars,
          bodies: bodies.map((body) => ({ x: body.x, y: body.y, dz: body.dz, glow: body.glow, dim: body.dim })),
          minors: minorPlaces,
          draws,
          lineAlpha,
          nameAlpha,
          focusDz,
          sx: sxScale,
          sy: syScale,
        };
        if (field.update(frame)) busy = true;
      }

      return {
        active,
        places,
        cards,
        cartels,
        cartelDepth,
        planetDim: ease(shows[active]?.alpha ?? 0) * (cardsSpec ? 0 : 1),
        cursor: diving < 0 && near > 0.6 && (starHover >= 0 || input.overCard >= 0),
        busy,
      };
    },

    hit: () => starHover,

    focusCard(index) {
      keyboard = index;
    },

    hold(index) {
      held = index;
      heldAt = { x: -1, y: -1 };
      introSkipped = true;
      // The project shows already, as its card comes back into its place.
      const show = shows[index];
      if (show) {
        show.alpha = 1;
        show.shown = 1;
      }
      const body = bodyOfCard.get(index);
      const node = body ? web[bodies.indexOf(body)] : undefined;
      if (node && cardsSpec) {
        node.x = node.hx + (MIDDLE.x - node.hx) * cardsSpec.pull;
        node.y = node.hy + (MIDDLE.y - node.hy) * cardsSpec.pull;
      }
    },

    lift: (index) => shows[index]?.lift ?? 0,

    dispose() {
      disposed = true;
      field?.dispose();
      field = null;
      overlay.remove();
      legend?.remove();
    },
  };

  // The mouse that comes back from a case study starts where it is: the project held stays until it moves.
  const onMove = (event: PointerEvent): void => {
    if (held >= 0 && heldAt.x < 0) heldAt = { x: event.clientX, y: event.clientY };
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  const dispose = sky.dispose.bind(sky);
  sky.dispose = () => {
    window.removeEventListener('pointermove', onMove);
    dispose();
  };

  return sky;
}

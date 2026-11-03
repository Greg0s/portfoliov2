/**
 * The sky of constellations (proposals, `?constellations=1` to 5, desktop): the projects share one sky, on one anchor of
 * the journey, as two constellations. This controller knows where each project is on screen, which one the mouse or the
 * keyboard points at, how its preview shows (the project's own card, which dives into the case study on a click), and
 * what each constellation draws; it writes the labels and the legend, and drives the WebGL field (`field.ts`, loaded
 * with Three.js) that draws the stars, the planets and the lines.
 */
import './sky.css';
import { designFor, GROUP_OF, SKY_DEPTH, type BodySpec, type Group, type SkyDesign } from './designs';
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
  scale: number;
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
  /** The preview's place for each card, at the camera's depth. */
  places: CardPlace[];
  cards: CardShow[];
  cartels: CartelShow[];
  /** Whether the "See the project" disc shows. */
  cursor: boolean;
  /** Whether something still moves on its own: the next frame must be drawn. */
  busy: boolean;
}

export interface Sky {
  design: SkyDesign;
  /** The preview's size and default place for each card, for the journey's layout. */
  layout(view: View, cards: readonly CardPlace[]): CardPlace[];
  /** Adds the WebGL field to the renderer's scene, once Three.js has loaded. */
  attach(renderer: Renderer): void;
  frame(input: SkyInput): SkyLook;
  /** The project under the mouse (its card's index), or -1. */
  hit(): number;
  /** The card that has the keyboard's focus, or -1. */
  focusCard(index: number): void;
  /** Back from a case study: its preview shows until the mouse points elsewhere. */
  hold(index: number): void;
  /** How far the card stands out toward the mouse, in px, for the dive to start from there. */
  lift(index: number): number;
  dispose(): void;
}

const HOVER_LIFT = 18;
/** On arrival, both constellations draw themselves for this long. */
const INTRO_MS = 3400;
/** After the mouse leaves a star or its preview, the preview stays this long, so that the mouse can reach it. */
const GRACE_MS = 520;
/** How far the sky tilts toward the mouse, in degrees, on top of the camera's own tilt: the depth shows. */
const SKY_TILT_X = 2.4;
const SKY_TILT_Y = 4.5;

const ease = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number): number => 1 - Math.pow(1 - t, 3);

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
  /** How much it stands out (0 to 1), and how much it is dimmed by another one standing out. */
  glow: number;
  dim: number;
  label: HTMLElement;
}

const LABELS: Record<Group, { fr: string; en: string }> = {
  perso: { fr: 'Projets perso', en: 'Personal projects' },
  pro: { fr: 'Projets pro', en: 'Professional projects' },
};

const FIGURE_NAMES: Record<Group, { fr: string; en: string }> = {
  perso: { fr: 'Le Renard', en: 'The Fox' },
  pro: { fr: 'La Rose', en: 'The Rose' },
};

const LONG_NAMES: Record<Group, { fr: string; en: string }> = {
  perso: { fr: 'Projets personnels', en: 'Personal projects' },
  pro: { fr: 'Projets professionnels', en: 'Professional projects' },
};

export function createSky(variant: number, stage: HTMLElement, slugs: readonly string[]): Sky {
  const design = designFor(variant);
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
    if (spec.letter) {
      const letter = document.createElement('span');
      letter.className = 'letter';
      letter.textContent = spec.letter;
      label.append(letter);
    }
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
        glow: 0,
        dim: 0,
        label,
      },
    ];
  });
  const bodyOfCard = new Map(bodies.map((body) => [body.card, body]));

  // The constellations' names, as on a chart, or the systems' suns.
  const names = (design.names ?? []).map((place) => {
    const element = document.createElement('div');
    element.className = 'sky-name';
    element.dataset.group = place.group;
    if (design.look === 'figures') {
      const figure = document.createElement('span');
      figure.className = 'figure';
      figure.textContent = FIGURE_NAMES[place.group][lang];
      const kind = document.createElement('span');
      kind.className = 'kind';
      kind.textContent = LABELS[place.group][lang];
      element.append(figure, kind);
    } else {
      element.textContent = LONG_NAMES[place.group][lang];
    }
    overlay.append(element);
    return { place, element };
  });
  const suns = (design.systems ?? []).map((system) => {
    const element = document.createElement('div');
    element.className = 'sky-sun';
    element.dataset.group = system.group;
    element.textContent = LABELS[system.group][lang];
    overlay.append(element);
    return { system, element, sx: 0, sy: 0 };
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
    legend.setAttribute('aria-label', lang === 'en' ? 'Constellations' : 'Constellations');
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
  let lastActive = -1;
  let lastNow = 0;
  /** The time the sky's own motions run on (the systems' orbits), slowed down while a project shows. */
  let orbitTime = 0;
  let orbitSpeed = 1;
  /** When the camera first rested on the sky: both constellations draw themselves once. */
  let introAt = -1;
  /** Coming back from a case study: the constellations don't draw again as on arrival. */
  let introSkipped = false;
  const shows = slugs.map(() => ({ alpha: 0, lift: 0, bloom: 0 }));
  const draws: Record<Group, number> = { perso: 0, pro: 0 };
  const lineAlpha: Record<Group, number> = { perso: 0, pro: 0 };
  /** The depth the focus rests on (proposal 3), relative to the sky's. */
  let focusDz = 0;
  /** The preview's place, kept still while its card dives. */
  const frozen = new Map<number, CardPlace>();
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

  function previewCenter(body: BodyState | undefined, current: View): { x: number; y: number; from: number } {
    const { width, height } = previewSize;
    const margin = 36;
    const maxX = current.width / 2 - width / 2 - margin;
    const top = -current.height / 2 + 96 + height / 2;
    // Low enough for its cartel to clear the legend.
    const bottom = current.height / 2 - height / 2 - 220 * syScale;
    if (!body) return { x: 0, y: -40 * syScale, from: 0 };
    const bx = body.sx - current.vpX;
    const by = body.sy - current.vpY;
    const side = bx < 0 ? 1 : -1;
    switch (design.preview) {
      case 'center':
        return { x: 0, y: -40 * syScale, from: 0 };
      case 'opposite':
        return { x: side * 370 * sxScale, y: -30 * syScale, from: 0 };
      case 'beside': {
        const gap = 64 * sxScale + body.spec.r * 2 * body.scale;
        const x = Math.max(-maxX, Math.min(maxX, bx + side * (gap + width / 2)));
        return { x, y: Math.max(top, Math.min(bottom, by - 24 * syScale)), from: 0 };
      }
      case 'bloom': {
        const gap = 40 * sxScale;
        const x = Math.max(-maxX, Math.min(maxX, bx + side * (gap + width / 2)));
        return { x, y: Math.max(top, Math.min(bottom, by - 20 * syScale)), from: 1 };
      }
    }
  }

  /** Where each body is, from the vanishing point, before the camera's projection. */
  function placeBodies(): void {
    const systems = design.systems ?? [];
    const orbits = design.orbits ?? [];
    for (const body of bodies) {
      const orbit = orbits.find(({ slug }) => slug === body.spec.slug);
      const system = systems.find(({ group }) => group === body.group);
      if (orbit && system) {
        const angle = 2 * Math.PI * (orbit.phase + orbitTime / orbit.period);
        const lean = ((90 - system.tilt) * Math.PI) / 180;
        const roll = (system.roll * Math.PI) / 180;
        const ox = orbit.radius * Math.cos(angle);
        const oy = orbit.radius * Math.sin(angle) * Math.sin(lean);
        const oz = orbit.radius * Math.sin(angle) * Math.cos(lean);
        const rx = ox * Math.cos(roll) - oy * Math.sin(roll);
        const ry = ox * Math.sin(roll) + oy * Math.cos(roll);
        body.x = (system.x + rx) * sxScale;
        body.y = (system.y + ry) * syScale;
        body.dz = oz / 1000;
      } else {
        // Placed so that, the camera on the sky, it shows where the design puts it on screen.
        const back = 1 - body.spec.dz;
        body.x = body.spec.x * sxScale * back;
        body.y = body.spec.y * syScale * back;
        body.dz = body.spec.dz;
      }
    }
  }

  function skySway(input: SkyInput): Sway {
    const k = input.tilt;
    return {
      ...input.sway,
      tiltX: input.sway.tiltX + input.pointer.y * SKY_TILT_X * k,
      tiltY: input.sway.tiltY - input.pointer.x * SKY_TILT_Y * k,
    };
  }

  function hitTest(x: number, y: number): number {
    let best = -1;
    let bestDistance = Infinity;
    for (const body of bodies) {
      if (body.fade < 0.3) continue;
      let radius =
        design.look === 'planets' || design.look === 'systems'
          ? body.spec.r * body.scale * sxScale + 14
          : Math.max(38, body.spec.r * 3 * body.scale);
      // A star already under the mouse keeps it a little further, as the sky sways.
      if (body.card === starHover) radius *= 1.35;
      const distance = Math.hypot(x - body.sx, y - body.sy);
      if (distance < radius && distance < bestDistance) {
        best = body.card;
        bestDistance = distance;
      }
    }
    return best;
  }

  const sky: Sky = {
    design,
    layout(next, cards) {
      view = next;
      sxScale = next.width / 1440;
      syScale = next.height / 900;
      const width = (design.previewWidth / 100) * next.width;
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

      // The orbits slow down to a stop while a project shows (proposal 4).
      orbitSpeed = approach(orbitSpeed, lastActive >= 0 ? 0 : 1, delta, 420);
      if (!input.still && input.time > 0) orbitTime += delta * orbitSpeed;
      placeBodies();

      // Where each body is on screen.
      for (const body of bodies) {
        const rel = relBase + body.dz;
        const projected = projectCss(body.x, body.y, rel, current, sway);
        body.sx = projected.x;
        body.sy = projected.y;
        body.scale = projected.scale;
        body.fade = depthFade(rel);
      }
      for (const sun of suns) {
        const projected = projectCss(sun.system.x * sxScale, sun.system.y * syScale, relBase, current, sway);
        sun.sx = projected.x;
        sun.sy = projected.y;
      }

      // Which project shows: under the mouse, its preview under the mouse, the keyboard's, the one coming back.
      const diving = input.diving;
      starHover = near > 0.6 && diving < 0 ? hitTest(pointer.clientX, pointer.clientY) : -1;
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
      lastActive = active;
      const activeBody = bodyOfCard.get(active);
      const activeGroup = activeBody?.group ?? null;

      // The previews: one at a time, fading in as it rises a little, or growing out of its star.
      let busy = false;
      const cards: CardShow[] = shows.map((show, index) => {
        const target = index === active ? 1 : 0;
        const before = show.alpha;
        show.alpha = toward(show.alpha, target, delta, target ? 260 : 170);
        show.bloom = toward(show.bloom, target, delta, target ? 420 : 170);
        show.lift = approach(show.lift, index === input.overCard && index === active ? HOVER_LIFT : 0, delta, 120);
        if (show.alpha !== before || (show.lift > 0.05 && show.lift < HOVER_LIFT - 0.05)) busy = true;
        const k = ease(show.alpha);
        return { alpha: k, scale: 0.94 + 0.06 * easeOut(show.alpha), lift: show.lift };
      });

      // The previews' places, and their cartels.
      const cartels: CartelShow[] = [];
      slugs.forEach((_, index) => {
        const place = places[index];
        const show = cards[index];
        if (!place || !show) return;
        const body = bodyOfCard.get(index);
        if (index === diving) {
          const kept = frozen.get(index);
          if (kept) Object.assign(place, kept);
        } else {
          frozen.delete(index);
          if (show.alpha > 0) {
            const { x, y, from } = previewCenter(body, current);
            if (from > 0 && body) {
              // It grows out of its star.
              const k = easeOut(shows[index]?.bloom ?? 1);
              const bx = body.sx - current.vpX;
              const by = body.sy - current.vpY;
              place.x = bx + (x - bx) * k;
              place.y = by + (y - by) * k;
              show.scale = 0.18 + 0.82 * k;
            } else {
              place.x = x;
              place.y = y;
            }
          }
        }
        const left = current.vpX + place.x - (place.width * show.scale) / 2;
        const below = current.vpY + place.y + (place.height * show.scale) / 2 + 22;
        const centered = design.preview === 'center' || design.preview === 'opposite';
        cartels.push({
          x: centered ? current.vpX + place.x - place.width / 2 : left,
          y: below,
          width: centered ? place.width : Math.min(place.width, 380 * sxScale),
          align: centered ? 'center' : 'left',
          alpha: index === diving ? 0 : Math.max(0, (show.alpha - 0.35) / 0.65),
        });
      });
      if (diving >= 0 && !frozen.has(diving)) {
        const place = places[diving];
        if (place) frozen.set(diving, { ...place });
      }

      // The constellations: drawn once on arrival, then when one of their projects shows or the legend asks.
      const intro = introAt >= 0 ? now - introAt : -1;
      const introDraw = intro >= 0 && intro < INTRO_MS;
      const always = design.look === 'chart' || design.look === 'figures';
      const shown = legendHover ?? legendGroup;
      (['perso', 'pro'] as const).forEach((group) => {
        const wanted = introDraw || activeGroup === group || shown === group || (always && intro >= 0) ? 1 : 0;
        const before = draws[group];
        draws[group] = wanted ? toward(draws[group], 1, delta, 1300) : toward(draws[group], 0, delta, 520);
        let alpha: number;
        if (always) {
          const lit = activeGroup ?? shown;
          alpha = lit === null ? 0.34 : lit === group ? 0.85 : 0.1;
        } else {
          alpha = wanted ? 0.62 : 0.4;
        }
        const before2 = lineAlpha[group];
        lineAlpha[group] = approach(lineAlpha[group], alpha, delta, 160);
        if (draws[group] !== before || lineAlpha[group] !== before2) busy = true;
      });

      // How much each body stands out.
      const lit = activeGroup ?? shown;
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

      // The focus rests on the project shown (proposal 3), else between the two constellations.
      if (design.look === 'focus') {
        const want = activeBody ? activeBody.dz : lit ? meanDepth(lit) : 0.02;
        const before = focusDz;
        focusDz = approach(focusDz, want, delta, 260);
        if (before !== focusDz) busy = true;
      }

      // The overlay.
      const presence = near * input.others * Math.min(1, input.stars / 0.7);
      overlay.style.opacity = presence.toFixed(3);
      overlay.style.visibility = presence > 0.004 ? 'visible' : 'hidden';
      for (const body of bodies) {
        const label = body.label;
        let alpha = body.fade * (1 - 0.75 * body.dim);
        let x = body.sx;
        let y = body.sy;
        if (design.look === 'planets' || design.look === 'systems') {
          y += body.spec.r * body.scale * sxScale + 12;
          if (design.look === 'systems') alpha *= 0.55 + 0.45 * body.glow;
        } else if (design.look === 'focus') {
          // The name of a light out of focus stays, fainter.
          const blur = Math.abs(body.dz - focusDz);
          alpha *= Math.max(body.glow, 1 - 0.55 * smoothstep(0.02, 0.2, blur));
          y += 16 + 26 * smoothstep(0.02, 0.4, blur);
        } else {
          x += body.spec.r * 1.6 * body.scale + 8;
          y -= 1;
        }
        label.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        label.style.opacity = alpha.toFixed(3);
        label.classList.toggle('on', body.card === active);
      }
      for (const { place, element } of names) {
        const projected = projectCss(place.x * sxScale, place.y * syScale, relBase, current, sway);
        element.style.transform = `translate(${projected.x.toFixed(1)}px, ${projected.y.toFixed(1)}px) translate(-50%, -50%) rotate(${String(place.angle)}deg)`;
        const alpha = lit === null ? 0.7 : lit === place.group ? 1 : 0.28;
        element.style.opacity = alpha.toFixed(3);
      }
      for (const sun of suns) {
        // Under its system, below the widest orbit.
        sun.element.style.transform = `translate(${sun.sx.toFixed(1)}px, ${(sun.sy + 150 * syScale).toFixed(1)}px)`;
        const alpha = lit === null ? 0.75 : lit === sun.system.group ? 1 : 0.3;
        sun.element.style.opacity = alpha.toFixed(3);
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
          bodies: bodies.map((body) => ({
            x: body.x,
            y: body.y,
            dz: body.dz,
            glow: body.glow,
            dim: body.dim,
          })),
          draws,
          lineAlpha,
          focusDz,
          activeBody: activeBody ? bodies.indexOf(activeBody) : -1,
          sx: sxScale,
          sy: syScale,
        };
        if (field.update(frame)) busy = true;
      }
      if (design.look === 'systems' && orbitSpeed > 0.001 && input.time > 0) busy = true;

      return {
        active,
        places,
        cards,
        cartels,
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
      // The preview is there already, as the card comes back into it.
      const show = shows[index];
      if (show) {
        show.alpha = 1;
        show.bloom = 1;
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

  function meanDepth(group: Group): number {
    const members = bodies.filter((body) => body.group === group);
    return members.reduce((sum, body) => sum + body.dz, 0) / Math.max(1, members.length);
  }

  // The mouse that comes back from a case study starts where it is: the held preview stays until it moves.
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

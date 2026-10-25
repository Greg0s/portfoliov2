import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  anchors,
  cameraDepth,
  cardDepth,
  endClock,
  endProgressAt,
  LAST_PROJECT,
  PROJECTS,
  projectAnchor,
  SCREENS,
} from '../../src/scene/journey/anchors';
import { cardLook, diveLook, focusedCard, planetLook, projectCss, type Sway } from '../../src/scene/journey/camera';
import { projectThree } from '../../src/scene/journey/camera3d';
import { sceneFor, seeded, worldCount } from '../../src/scene/journey/layout';
import {
  anchorAt,
  anchorPositions,
  easeFrom,
  settleAnchor,
  stepAnchor,
  wheelGestures,
} from '../../src/scene/journey/snap';
import { step, stepSpeed } from '../../src/scene/journey/steps';

describe('the steps of a project', () => {
  it('go from 0 to 1, always forward', () => {
    expect(step(0)).toBe(0);
    expect(step(1)).toBeCloseTo(1, 12);
    for (let s = 0; s < 1; s += 0.01) expect(step(s + 0.01)).toBeGreaterThan(step(s));
  });

  it('slow to 25 % of the mean speed in the middle and speed up to 175 % at the ends', () => {
    expect(stepSpeed(0.5)).toBeCloseTo(0.25, 12);
    expect(stepSpeed(0)).toBeCloseTo(1.75, 12);
    expect(stepSpeed(1)).toBeCloseTo(1.75, 12);
  });
});

describe('the anchors of the journey', () => {
  it('are the opening, the 8 projects and the contact, over 12.5 screens', () => {
    expect(SCREENS).toBe(12.5);
    expect(anchors).toHaveLength(PROJECTS + 2);
    expect(anchors[0]).toBe(0);
    expect(anchors.at(-1)).toBe(1);
    // The opening takes 1 screen, each project 1.25, its anchor in the middle.
    expect(projectAnchor(0) * SCREENS).toBeCloseTo(1.625, 12);
    expect(projectAnchor(7) * SCREENS).toBeCloseTo(10.375, 12);
  });

  it('put each card in focus on its anchor', () => {
    for (let i = 0; i < PROJECTS; i += 1) expect(cameraDepth(projectAnchor(i))).toBeCloseTo(cardDepth(i), 10);
    expect(cameraDepth(0)).toBe(0);
  });

  it('move the camera only back', () => {
    for (let u = 0; u < 1; u += 0.001) expect(cameraDepth(u + 0.001)).toBeGreaterThanOrEqual(cameraDepth(u));
  });

  it('run the end on a clock that goes both ways', () => {
    expect(endClock(LAST_PROJECT)).toBe(0);
    expect(endClock(1)).toBeCloseTo(1, 12);
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), (q) => {
        expect(endClock(endProgressAt(q))).toBeCloseTo(q, 9);
      }),
    );
  });
});

describe('the focus', () => {
  it('on each project anchor, makes its card sharp and the others blurred', () => {
    for (const [width, height] of [
      [1440, 900],
      [390, 844],
    ] as const) {
      const { cards } = sceneFor(width, height);
      cards.forEach((card, i) => {
        const depth = cameraDepth(projectAnchor(i));
        expect(focusedCard(cards, depth)).toBe(i);
        expect(cardLook(card, depth).blur).toBe(0);
        expect(cardLook(card, depth).opacity).toBe(1);
        cards
          .filter((other) => other.index !== i)
          .forEach((other) => {
            const look = cardLook(other, depth);
            // Blurred, or already gone.
            expect(look.blur > 1 || look.opacity < 0.01).toBe(true);
          });
      });
    }
  });

  it('keeps the card in focus a little longer than it takes it (hysteresis)', () => {
    const { cards } = sceneFor(1440, 900);
    expect(focusedCard(cards, cardDepth(2) + 0.12)).toBe(-1);
    expect(focusedCard(cards, cardDepth(2) + 0.12, 2)).toBe(2);
  });

  it('lets the planet recede to a point of light', () => {
    expect(planetLook(0, 0.7, 0).scale).toBe(1);
    expect(planetLook(0, 0.7, 0).blur).toBe(0);
    expect(planetLook(0, 0.7, 0).decorOpacity).toBeCloseTo(0.42, 10);
    expect(planetLook(29, 0.7, 0).glowOpacity).toBeGreaterThan(0.9);
  });
});

describe('the dive', () => {
  it('starts on the card and lands on the opening media, full width and flush with the top', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: 2560 }),
        fc.integer({ min: 480, max: 1600 }),
        fc.integer({ min: 0, max: PROJECTS - 1 }),
        (width, height, index) => {
          const { cards, view } = sceneFor(width, height);
          const card = cards[index];
          if (!card) return;
          const look = cardLook(card, card.z);
          const start = diveLook(card, look, view, 0);
          const from = projectCss(start.x, start.y, start.depth, view);
          const sharp = projectCss(card.x, card.y, look.depth, view);
          expect(from.x).toBeCloseTo(sharp.x, 6);
          expect(from.y).toBeCloseTo(sharp.y, 6);
          expect(from.scale).toBeCloseTo(sharp.scale, 6);
          const end = diveLook(card, look, view, 1);
          const to = projectCss(end.x, end.y, end.depth, view);
          // The card keeps its format: its width becomes the screen's, its height follows.
          expect(card.width * to.scale).toBeCloseTo(width, 6);
          expect(to.x).toBeCloseTo(width / 2, 6);
          expect(to.y - (card.height * to.scale) / 2).toBeCloseTo(0, 6);
        },
      ),
    );
  });
});

describe('the scene', () => {
  it('has 21 small worlds on desktop and 16 on mobile', () => {
    expect(worldCount).toEqual({ desktop: 21, mobile: 16 });
    expect(sceneFor(1440, 900).worlds).toHaveLength(21);
    expect(sceneFor(390, 844).worlds).toHaveLength(16);
  });

  it('draws the same sky as the mockup', () => {
    // The mockup's seeded sequence (mulberry32): the first draws for its desktop seed.
    const rand = seeded(7);
    const first = [rand(), rand(), rand()];
    expect(first.every((n) => n >= 0 && n < 1)).toBe(true);
    expect(seeded(7)()).toBe(first[0]);
    const { stars } = sceneFor(1440, 900);
    expect(stars.filter((star) => !star.near)).toHaveLength(90);
    expect(stars.filter((star) => star.near)).toHaveLength(56);
  });
});

describe('one camera for the CSS and WebGL', () => {
  const sway = fc.record<Sway>({
    dx: fc.double({ min: -5, max: 5, noNaN: true }),
    dy: fc.double({ min: -3, max: 3, noNaN: true }),
    roll: fc.double({ min: -0.2, max: 0.2, noNaN: true }),
    tiltX: fc.double({ min: -1, max: 1, noNaN: true }),
    tiltY: fc.double({ min: -1.5, max: 1.5, noNaN: true }),
  });

  it('lands a point on the same pixel, on desktop and on mobile', () => {
    for (const [width, height] of [
      [1440, 900],
      [390, 844],
    ] as const) {
      const { view } = sceneFor(width, height);
      fc.assert(
        fc.property(
          fc.double({ min: -1500, max: 1500, noNaN: true }),
          fc.double({ min: -1000, max: 1000, noNaN: true }),
          fc.double({ min: -20, max: 0.7, noNaN: true }),
          sway,
          (x, y, z, s) => {
            const css = projectCss(x, y, z, view, s);
            const three = projectThree(x, y, z, view, s);
            expect(Math.abs(css.x - three.x)).toBeLessThanOrEqual(0.5);
            expect(Math.abs(css.y - three.y)).toBeLessThanOrEqual(0.5);
          },
        ),
      );
    }
  });
});

describe('anchor to anchor', () => {
  const positions = anchorPositions(anchors, SCREENS, 900);

  it('never leaves the scroll between two anchors, whatever the gestures', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            // A wheel: a run of events, one gesture.
            fc.record({ kind: fc.constant('wheel' as const), delta: fc.integer({ min: -400, max: 400 }) }),
            // A key, or a swipe of a finger.
            fc.record({ kind: fc.constant('step' as const), delta: fc.integer({ min: -1, max: 1 }) }),
            // The scroll left anywhere (a scrollbar, a browser without snapping).
            fc.record({ kind: fc.constant('drop' as const), delta: fc.integer({ min: 0, max: 11_250 }) }),
          ),
          { maxLength: 40 },
        ),
        (gestures) => {
          let position = 0;
          let time = 0;
          const gestureOf = wheelGestures();
          for (const gesture of gestures) {
            time += 500;
            if (gesture.kind === 'wheel') {
              const way = gestureOf(gesture.delta, time);
              if (way !== 0) position = positions[stepAnchor(position, positions, way)] ?? position;
            } else if (gesture.kind === 'step') {
              if (gesture.delta !== 0) position = positions[stepAnchor(position, positions, gesture.delta)] ?? position;
            } else {
              position = positions[settleAnchor(gesture.delta, positions, Math.sign(gesture.delta - position))] ?? 0;
            }
            expect(anchorAt(position, positions)).toBeGreaterThanOrEqual(0);
          }
        },
      ),
    );
  });

  it('takes one wheel gesture, with its inertia, as one step', () => {
    const gestureOf = wheelGestures();
    // A swipe on a trackpad: a burst, then a long tail of slowing events.
    const tail = [40, 60, 55, 48, 40, 33, 27, 20, 15, 11, 8, 5, 3, 2, 1];
    const starts = tail.map((delta, i) => gestureOf(delta, i * 16)).filter((way) => way !== 0);
    expect(starts).toEqual([1]);
    // A pause, then another notch: a new gesture; turning back is one too.
    expect(gestureOf(100, 2000)).toBe(1);
    expect(gestureOf(-100, 2010)).toBe(-1);
  });

  it('goes one anchor at a time, and stops at the ends', () => {
    expect(stepAnchor(0, positions, -1)).toBe(0);
    expect(stepAnchor(0, positions, 1)).toBe(1);
    expect(stepAnchor(positions.at(-1) ?? 0, positions, 1)).toBe(positions.length - 1);
    // Between two anchors, a step goes to the next one in its direction.
    expect(stepAnchor((positions[3] ?? 0) + 100, positions, 1)).toBe(4);
    expect(stepAnchor((positions[3] ?? 0) + 100, positions, -1)).toBe(3);
  });

  it('starts a finger glide at the finger speed, without overshooting', () => {
    const ease = easeFrom(2);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBeCloseTo(1, 12);
    for (let t = 0; t < 1; t += 0.01) expect(ease(t)).toBeLessThanOrEqual(1);
    expect((ease(0.001) - ease(0)) / 0.001).toBeCloseTo(2, 1);
  });
});

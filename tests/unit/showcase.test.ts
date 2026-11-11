import { describe, expect, it } from 'vitest';
import { viewFor } from '../../src/scene/journey/layout';
import { CARTEL_GAP, fitRing, offset, ringFor, ringPose } from '../../src/scene/showcase/ring';

describe('the ring of projects', () => {
  it('wraps the offsets around the selection', () => {
    expect(offset(0, 0, 8)).toBe(0);
    expect(offset(7, 0, 8)).toBe(-1);
    expect(offset(1, 7, 8)).toBe(2);
    expect(offset(0, 7.5, 8)).toBe(0.5);
  });

  it.each([
    [1440, 900],
    [390, 844],
  ] as const)('puts the selected project in front, sharp and whole, at %i × %i', (width, height) => {
    const view = viewFor(width, height);
    for (let i = 0; i < 8; i += 1) {
      const pose = ringPose(i, i, 8, view);
      expect(pose.opacity).toBeCloseTo(1, 6);
      expect(pose.blur).toBeCloseTo(0, 6);
      expect(pose.scale).toBeCloseTo(1, 6);
      for (let j = 0; j < 8; j += 1) if (j !== i) expect(ringPose(j, i, 8, view).opacity).toBeLessThan(0.3);
    }
  });

  it('shows the card in front at 78 % of a phone’s width', () => {
    const view = viewFor(390, 844);
    const ring = ringFor(view);
    expect(ring.card / (1 - ring.rz)).toBeCloseTo(0.78 * 390, 6);
  });

  it('turns its cards smoothly', () => {
    const view = viewFor(1440, 900);
    for (let i = 0; i < 8; i += 1) {
      for (let s = 0; s < 8; s += 0.05) {
        const a = ringPose(i, s, 8, view);
        const b = ringPose(i, s + 0.01, 8, view);
        if (a.opacity > 0.05 && b.opacity > 0.05) {
          expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(60);
          expect(Math.abs(a.z - b.z)).toBeLessThan(0.1);
        }
      }
    }
  });

  describe('on a phone, fitted to its screen', () => {
    /** Where the card in front and its cartel `height` px tall end on screen, and how high the planet reaches. */
    const extent = (view: ReturnType<typeof viewFor>, height: number): { cartel: number; planet: number } => {
      const ring = ringFor(view);
      const k = 1 / (1 - ring.rz);
      const card = view.vpY + (ring.cy + ring.ry) * k + ((ring.card * 9) / 32) * k;
      return { cartel: card + CARTEL_GAP + height, planet: view.vpY + ring.cy - ring.planet / 2 };
    };
    const room = (height: number, bottoms: number[]) => ({ top: 78, bottoms, cartel: () => height });

    it('leaves the ring as drawn on a phone tall enough', () => {
      const view = viewFor(390, 844);
      expect(fitRing(view, room(150, [700, 756]))).toEqual({ lift: 0, scale: 1, clears: 0 });
      expect(fitRing(viewFor(1440, 900), room(150, [700]))).toBeNull();
    });

    it.each([
      [375, 667, 150],
      [360, 640, 150],
      [320, 568, 170],
    ])('keeps the text above the arrows and the planet under the header at %i × %i', (width, height, cartel) => {
      const view = viewFor(width, height);
      const arrows = height - 74 - 14;
      const fit = fitRing(view, room(cartel, [arrows - 58, arrows]));
      expect(fit).not.toBeNull();
      if (!fit) return;
      const bottom = [arrows - 58, arrows][fit.clears] ?? arrows;
      const at = extent({ ...view, ring: { lift: fit.lift, scale: fit.scale } }, cartel);
      expect(at.cartel).toBeLessThanOrEqual(bottom);
      expect(at.planet).toBeGreaterThanOrEqual(78 - 0.01);
      expect(fit.scale).toBeGreaterThanOrEqual(0.72);
    });
  });
});

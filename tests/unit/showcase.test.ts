import { describe, expect, it } from 'vitest';
import { viewFor } from '../../src/scene/journey/layout';
import { offset, ringFor, ringPose } from '../../src/scene/showcase/ring';

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
});

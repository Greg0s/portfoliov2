import { describe, expect, it } from 'vitest';
import { anchors, journeyTrack, SCREENS } from '../../src/scene/journey/anchors';
import { viewFor } from '../../src/scene/journey/layout';
import { designs, offset } from '../../src/scene/showcase/designs';

describe('the journey track', () => {
  it('keeps the journey project by project as it was', () => {
    const track = journeyTrack(8);
    expect(track.screens).toBe(12.5);
    expect(SCREENS).toBe(12.5);
    expect(track.anchors).toEqual(anchors);
    expect(track.endClock(0.904)).toBeCloseTo(0.12, 10);
  });

  it('stops once for the showcase, sharp at depth 1.5', () => {
    const track = journeyTrack(1);
    expect(track.anchors).toHaveLength(3);
    expect(track.cameraDepth(track.anchors[1] ?? 0)).toBeCloseTo(1.5, 10);
    expect(track.cameraDepth(1)).toBeCloseTo(22, 10);
    for (let q = 0; q <= 1; q += 0.05) expect(track.endClock(track.endProgressAt(q))).toBeCloseTo(q, 8);
  });
});

describe('the showcase proposals', () => {
  const view = viewFor(1440, 900);

  it('wrap the offsets around the selection', () => {
    expect(offset(0, 0, 8)).toBe(0);
    expect(offset(7, 0, 8)).toBe(-1);
    expect(offset(1, 7, 8)).toBe(2);
    expect(offset(0, 7.5, 8, -1)).toBe(0.5);
  });

  it.each(designs.map((design) => [design.id, design] as const))(
    'proposal %i puts the selected project in front, sharp and whole',
    (_, design) => {
      for (let i = 0; i < 8; i += 1) {
        const pose = design.pose(i, i, 8, view);
        expect(pose.opacity).toBeCloseTo(1, 6);
        expect(pose.blur).toBeCloseTo(0, 6);
        expect(pose.scale).toBeCloseTo(1, 6);
        // Every other card shows less.
        for (let j = 0; j < 8; j += 1) {
          if (j !== i) expect(design.pose(j, i, 8, view).opacity).toBeLessThan(0.9);
        }
      }
    },
  );

  it.each(designs.map((design) => [design.id, design] as const))(
    'proposal %i moves its cards smoothly',
    (_, design) => {
      for (let i = 0; i < 8; i += 1) {
        for (let s = 0; s < 8; s += 0.05) {
          const a = design.pose(i, s, 8, view);
          const b = design.pose(i, s + 0.01, 8, view);
          // A visible card never jumps between two close selections.
          if (a.opacity > 0.05 && b.opacity > 0.05) {
            expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(60);
            expect(Math.abs(a.z - b.z)).toBeLessThan(0.1);
          }
        }
      }
    },
  );
});

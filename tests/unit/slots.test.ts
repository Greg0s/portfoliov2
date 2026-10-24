import { describe, expect, it } from 'vitest';
import { slotAt, slots } from '../../src/scene/slots';

describe('the slots of the journey', () => {
  it('place the 8 projects, alternating sides, each facing the centre', () => {
    expect(slots).toHaveLength(8);
    slots.forEach((slot, index) => {
      expect(slot.side).toBe(index % 2 === 0 ? 'left' : 'right');
      // A card on the left is offset to the left and turns to the right, and the other way around.
      expect(Math.sign(slot.x)).toBe(slot.side === 'left' ? -1 : 1);
      expect(Math.sign(slot.rotateY)).toBe(slot.side === 'left' ? 1 : -1);
      expect(slot.width).toBeGreaterThanOrEqual(30);
      expect(slot.width).toBeLessThanOrEqual(38);
    });
  });

  it('starts the slots over past the eighth project', () => {
    expect(slotAt(8)).toEqual(slots[0]);
    expect(slotAt(3)).toEqual(slots[3]);
  });
});

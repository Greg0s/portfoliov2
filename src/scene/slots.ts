/**
 * Where the 8 projects sit along the journey (journey spec §5), by slot, in the order of the projects: the side, the
 * offset from the centre of the screen when the card is sharp (in % of its width and height), the card's sharp width
 * (in % of the screen's width) and its rotation (Y, Z, in degrees). The static home (step 5) uses the side and the
 * width; the journey (step 6) uses all of it.
 *
 * On mobile (journey spec §8) the projects pass near the centre with a light alternation: the offset is in % of the
 * width, the vertical offset in px below the vanishing point, and every sharp card is 78 % of the width.
 */
export interface Slot {
  side: 'left' | 'right';
  x: number;
  y: number;
  width: number;
  rotateY: number;
  rotateZ: number;
}

export const slots: readonly Slot[] = [
  { side: 'left', x: -27, y: -6, width: 38, rotateY: 12, rotateZ: -1.5 },
  { side: 'right', x: 25, y: 8, width: 32, rotateY: -10, rotateZ: 2 },
  { side: 'left', x: -30, y: 10, width: 34, rotateY: 9, rotateZ: 1 },
  { side: 'right', x: 28, y: -9, width: 30, rotateY: -12, rotateZ: -2 },
  { side: 'left', x: -24, y: -2, width: 36, rotateY: 11, rotateZ: 1.5 },
  { side: 'right', x: 31, y: 5, width: 33, rotateY: -9, rotateZ: -1 },
  { side: 'left', x: -29, y: 12, width: 31, rotateY: 10, rotateZ: 2 },
  { side: 'right', x: 26, y: -7, width: 35, rotateY: -11, rotateZ: -1.5 },
];

export interface MobileSlot {
  x: number;
  y: number;
  rotateY: number;
  rotateZ: number;
}

export const MOBILE_CARD_WIDTH = 78;

export const mobileSlots: readonly MobileSlot[] = [
  { x: -6, y: 76, rotateY: 5, rotateZ: -1 },
  { x: 7, y: 92, rotateY: -5, rotateZ: 1.2 },
  { x: -8, y: 66, rotateY: 4, rotateZ: 0.8 },
  { x: 5, y: 100, rotateY: -6, rotateZ: -1.2 },
  { x: -5, y: 82, rotateY: 5, rotateZ: 1 },
  { x: 8, y: 70, rotateY: -4, rotateZ: -0.8 },
  { x: -7, y: 96, rotateY: 5, rotateZ: 1.2 },
  { x: 6, y: 78, rotateY: -5, rotateZ: -1 },
];

/** The slot of the project at `index`; past the eighth, the slots start over. */
export function slotAt(index: number): Slot {
  const slot = slots[index % slots.length];
  if (!slot) throw new Error('No journey slot is defined.');
  return slot;
}

/** The mobile slot of the project at `index`; past the eighth, the slots start over. */
export function mobileSlotAt(index: number): MobileSlot {
  const slot = mobileSlots[index % mobileSlots.length];
  if (!slot) throw new Error('No mobile journey slot is defined.');
  return slot;
}

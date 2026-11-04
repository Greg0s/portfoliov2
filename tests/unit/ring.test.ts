import { describe, expect, it } from 'vitest';
import { neighbours, sideOf } from '../../src/lib/ring';

const ring = ['lyrix', 'siemens', 'what-we-play', 'perfmanager', 'obaine', 'litterature-combinatoire', 'sncf-wrapped'];

describe('neighbours', () => {
  it('are the items on either side, round the ring', () => {
    expect(neighbours(ring, 3)).toEqual({ previous: 'what-we-play', next: 'obaine' });
    expect(neighbours(ring, 0)).toEqual({ previous: 'sncf-wrapped', next: 'siemens' });
    expect(neighbours(ring, 6)).toEqual({ previous: 'litterature-combinatoire', next: 'lyrix' });
  });

  it('throw outside the ring', () => {
    expect(() => neighbours([], 0)).toThrow(RangeError);
  });
});

describe('sideOf', () => {
  it('reads the next and the previous one, round the ring', () => {
    expect(sideOf(ring, 'lyrix', 'siemens')).toBe('next');
    expect(sideOf(ring, 'siemens', 'lyrix')).toBe('previous');
    expect(sideOf(ring, 'sncf-wrapped', 'lyrix')).toBe('next');
    expect(sideOf(ring, 'lyrix', 'sncf-wrapped')).toBe('previous');
  });

  it('goes the shorter way round, forward on a tie', () => {
    expect(sideOf(ring, 'lyrix', 'perfmanager')).toBe('next');
    expect(sideOf(ring, 'lyrix', 'obaine')).toBe('previous');
    expect(sideOf(['a', 'b', 'c', 'd'], 'a', 'c')).toBe('next');
  });

  it('is null for the same page, or one outside the ring', () => {
    expect(sideOf(ring, 'lyrix', 'lyrix')).toBeNull();
    expect(sideOf(ring, 'lyrix', '/')).toBeNull();
    expect(sideOf(ring, '/', 'lyrix')).toBeNull();
  });
});

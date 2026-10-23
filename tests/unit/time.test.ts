import { afterEach, describe, expect, it, vi } from 'vitest';
import { currentMoment, momentAt, momentFromSearch, msUntilNextChange, onMomentChange } from '../../src/scene/time';

const at = (hours: number, minutes = 0, seconds = 0): Date => new Date(2026, 9, 23, hours, minutes, seconds);

describe('momentAt', () => {
  it('is dawn before noon and dusk from noon on, bounds included', () => {
    expect(momentAt(at(0))).toBe('aube');
    expect(momentAt(at(11, 59, 59))).toBe('aube');
    expect(momentAt(at(12))).toBe('crepuscule');
    expect(momentAt(at(23, 59, 59))).toBe('crepuscule');
  });
});

describe('the ?heure= parameter', () => {
  it('forces a moment over the clock', () => {
    expect(momentFromSearch('?heure=aube')).toBe('aube');
    expect(currentMoment(at(18), '?heure=aube')).toBe('aube');
    expect(currentMoment(at(8), '?still=1&heure=crepuscule')).toBe('crepuscule');
  });

  it('is ignored when it names no moment', () => {
    expect(momentFromSearch('?heure=nuit')).toBeUndefined();
    expect(currentMoment(at(8), '?heure=nuit')).toBe('aube');
    expect(currentMoment(at(13), '')).toBe('crepuscule');
  });
});

describe('moment changes', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('come at noon and at midnight', () => {
    expect(msUntilNextChange(at(11, 59))).toBe(60_000);
    expect(msUntilNextChange(at(12))).toBe(12 * 3_600_000);
    expect(msUntilNextChange(at(23, 0))).toBe(3_600_000);
  });

  it('are announced during the visit, unless the URL forces a moment', () => {
    vi.useFakeTimers({ now: at(11, 59) });
    const seen: string[] = [];
    const stop = onMomentChange((moment) => seen.push(moment), '');
    const stopForced = onMomentChange((moment) => seen.push(`forced ${moment}`), '?heure=aube');
    vi.advanceTimersByTime(2 * 60_000);
    expect(seen).toEqual(['crepuscule']);
    vi.advanceTimersByTime(12 * 3_600_000);
    expect(seen).toEqual(['crepuscule', 'aube']);
    stop();
    stopForced();
    vi.advanceTimersByTime(24 * 3_600_000);
    expect(seen).toHaveLength(2);
  });
});

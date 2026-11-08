import { describe, expect, it } from 'vitest';
import { sparing } from '../../src/scene/ahead';

describe('loading ahead', () => {
  it('spares the data saver and slow connections, and loads everything elsewhere', () => {
    expect(sparing(undefined)).toBe(false);
    expect(sparing({ effectiveType: '4g' })).toBe(false);
    expect(sparing({ saveData: true, effectiveType: '4g' })).toBe(true);
    for (const effectiveType of ['slow-2g', '2g', '3g']) expect(sparing({ effectiveType })).toBe(true);
  });
});

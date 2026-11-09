import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACCENT_STOPS, accentAt, cssRgb } from '../../src/scene/accent';

const tokens = readFileSync(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8');

describe('the accent', () => {
  it('has the same stops in the scenes as in the stylesheet', () => {
    const [start, middle, end] = ACCENT_STOPS;
    expect(tokens).toContain(`--color-accent-fill: linear-gradient(90deg, ${start}, ${middle} 50%, ${end});`);
    expect(tokens).toContain(`--color-accent: ${middle};`);
  });

  it('runs from its first stop to its last', () => {
    expect(cssRgb(accentAt(0))).toBe('rgb(109 185 110 / 100%)');
    expect(cssRgb(accentAt(0.5))).toBe('rgb(113 196 187 / 100%)');
    expect(cssRgb(accentAt(1))).toBe('rgb(144 211 244 / 100%)');
    expect(cssRgb(accentAt(-1))).toBe(cssRgb(accentAt(0)));
    expect(cssRgb(accentAt(2))).toBe(cssRgb(accentAt(1)));
  });
});

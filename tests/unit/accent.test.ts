import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { projectAccent } from '../../src/lib/project-accent';
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

  it("is the project's on its case study: the middle of its two colours, the two as a gradient", () => {
    const style = projectAccent(['#ec6a2c', '#f2843f']);
    expect(style).toContain('--project-from: #ec6a2c; --project-to: #f2843f');
    expect(style).toContain('--color-accent: rgb(239 119 54 / 100%)');
    expect(style).toContain('--color-accent-fill: linear-gradient(90deg, #ec6a2c, #f2843f)');
    expect(style).toContain('--color-accent-glow: rgb(239 119 54 / 38%)');
  });
});

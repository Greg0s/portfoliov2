/**
 * The accent colour proposals' light (8 November 2026): with `?accent=` and `?lumiere=1…3` (src/lib/accent.ts), the 3D
 * scenes light with the accent's colours, which they read here from the page's tokens
 * (src/styles/accent-proposals.css): `--accent`, the solid accent, and `--accent-light`, the stops of its gradient as a
 * list of hex colours. Without the parameters, `accentLight()` is null and the scenes stay as they are.
 */

/** A colour as sRGB components, from 0 to 1. */
export type Rgb = readonly [number, number, number];

export interface AccentLight {
  /**
   * How the planet takes the light (`?lumiere=1…3`): 1, backlit by two rim lights; 2, its own lights take the
   * colours, none added; 3, two spots in opposite corners of the screen. The other scenes take it the same way.
   */
  mode: 1 | 2 | 3;
  /** The solid accent. */
  solid: Rgb;
  /** The gradient's stops, one for a solid accent. */
  stops: readonly Rgb[];
  /** The colour `t` of the way along the gradient, from 0 to 1. */
  at(t: number): Rgb;
}

const HEX = /^#[0-9a-f]{6}$/i;

const parse = (value: string): Rgb => [
  parseInt(value.slice(1, 3), 16) / 255,
  parseInt(value.slice(3, 5), 16) / 255,
  parseInt(value.slice(5, 7), 16) / 255,
];

/** The colour `t` of the way from `a` to `b`. */
export function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** A colour for a 2D canvas or CSS, at an opacity from 0 to 1. */
export function cssRgb([r, g, b]: Rgb, alpha = 1): string {
  const c = (x: number): number => Math.round(Math.max(0, Math.min(1, x)) * 255);
  return `rgb(${String(c(r))} ${String(c(g))} ${String(c(b))} / ${String(Math.round(alpha * 1000) / 10)}%)`;
}

/** The accent's light when the page asks for it, or null. */
export function accentLight(root: HTMLElement = document.documentElement): AccentLight | null {
  if (root.dataset.accent === undefined || root.dataset.lumiere === undefined) return null;
  const style = getComputedStyle(root);
  const solid = style.getPropertyValue('--accent').trim();
  const stops = style
    .getPropertyValue('--accent-light')
    .trim()
    .split(/\s+/)
    .filter((value) => HEX.test(value))
    .map(parse);
  if (!HEX.test(solid) || stops.length === 0) return null;
  const last = stops.length - 1;
  const mode = root.dataset.lumiere === '2' ? 2 : root.dataset.lumiere === '3' ? 3 : 1;
  return {
    mode,
    solid: parse(solid),
    stops,
    at(t) {
      const x = Math.max(0, Math.min(1, t)) * last;
      const i = Math.min(last, Math.floor(x));
      const a = stops[i] ?? stops[0] ?? [1, 1, 1];
      const b = stops[Math.min(last, i + 1)] ?? a;
      return mixRgb(a, b, x - i);
    },
  };
}

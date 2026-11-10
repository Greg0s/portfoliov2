/**
 * The accent in the 3D scenes' light (main spec §5.2 and §6.3, Grégoire's choice of 9 November 2026): the stops of its
 * gradient, his first portfolio's green, turquoise and sky blue, the same as `--color-accent-fill` in
 * src/styles/tokens.css (a unit test holds them together). The planet's own lights take them, none added; the halo,
 * the ring's dust and line and one star in three take them too. The office keeps its light.
 */

/** A colour as sRGB components, from 0 to 1. */
export type Rgb = readonly [number, number, number];

/** The gradient's stops, from its start (the green) to its end (the sky blue). */
export const ACCENT_STOPS = ['#6db96e', '#71c4bb', '#90d3f4'] as const;

/** A `#rrggbb` colour as sRGB components. */
export const fromHex = (hex: string): Rgb => [
  parseInt(hex.slice(1, 3), 16) / 255,
  parseInt(hex.slice(3, 5), 16) / 255,
  parseInt(hex.slice(5, 7), 16) / 255,
];

const STOPS: readonly Rgb[] = ACCENT_STOPS.map(fromHex);

/** The colour `t` of the way from `a` to `b`. */
export function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** The accent's colour `t` of the way along its gradient, from 0 (its start) to 1 (its end). */
export function accentAt(t: number): Rgb {
  const last = STOPS.length - 1;
  const x = Math.max(0, Math.min(1, t)) * last;
  const i = Math.min(last - 1, Math.floor(x));
  const a = STOPS[i] ?? [1, 1, 1];
  const b = STOPS[i + 1] ?? a;
  return mixRgb(a, b, x - i);
}

/** A colour for a 2D canvas or CSS, at an opacity from 0 to 1. */
export function cssRgb([r, g, b]: Rgb, alpha = 1): string {
  const c = (x: number): number => Math.round(Math.max(0, Math.min(1, x)) * 255);
  return `rgb(${String(c(r))} ${String(c(g))} ${String(c(b))} / ${String(Math.round(alpha * 1000) / 10)}%)`;
}

/**
 * A case study's accent (main spec §4, Grégoire's choice of 9 November 2026): its project's rather than the site's.
 * The middle of the project's two colours for text, icons and thin lines, the two as a gradient for fills: the site's
 * accent tokens (src/styles/tokens.css), redefined for the case study's parts.
 */
import { cssRgb, fromHex, mixRgb } from '../scene/accent';

/** The inline style that gives an element the project's two colours and its accent. */
export function projectAccent([from, to]: readonly [string, string]): string {
  const middle = mixRgb(fromHex(from), fromHex(to), 0.5);
  return [
    `--project-from: ${from}`,
    `--project-to: ${to}`,
    `--color-accent: ${cssRgb(middle)}`,
    `--color-accent-fill: linear-gradient(90deg, ${from}, ${to})`,
    `--color-accent-soft: ${cssRgb(middle, 0.16)}`,
    `--color-accent-glow: ${cssRgb(middle, 0.38)}`,
  ].join('; ');
}

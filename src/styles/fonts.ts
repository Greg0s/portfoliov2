/**
 * Self-hosted variable fonts (main spec §5.1): Libre Franklin (roman and italic) and Manrope, Latin subset only. The
 * two romans are preloaded; the italic, used by the animated job title and the wall labels, is not.
 */
import franklinItalic from '@fontsource-variable/libre-franklin/files/libre-franklin-latin-wght-italic.woff2?url';
import franklin from '@fontsource-variable/libre-franklin/files/libre-franklin-latin-wght-normal.woff2?url';
import manrope from '@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2?url';

/** Fontsource's Latin unicode range. */
const latin =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';

interface Face {
  family: string;
  style: 'normal' | 'italic';
  weight: string;
  url: string;
  preload: boolean;
}

const faces: Face[] = [
  { family: 'Libre Franklin Variable', style: 'normal', weight: '100 900', url: franklin, preload: true },
  { family: 'Libre Franklin Variable', style: 'italic', weight: '100 900', url: franklinItalic, preload: false },
  { family: 'Manrope Variable', style: 'normal', weight: '200 800', url: manrope, preload: true },
];

export const preloadedFonts = faces.filter((face) => face.preload).map((face) => face.url);

export const fontFaceCss = faces
  .map(
    (face) =>
      `@font-face{font-family:'${face.family}';font-style:${face.style};font-display:swap;font-weight:${face.weight};` +
      `src:url(${face.url}) format('woff2-variations');unicode-range:${latin}}`,
  )
  .join('');

/**
 * The wind on the planet (main spec §6.3, as validated on the mockup): a wave runs through the scarf's ribbon from the
 * neck to its free end in 6 s, the rose sways from −1.2° to 2.4° and back in 3 s each way, and every 7 to 14 s a gust
 * quickens both, 1.6 times, for 2.2 s. The gust eases in and out over a few hundred ms, so nothing jolts. The fox
 * takes the same wind (Grégoire's wish, 5 November 2026): its tail sways ±8° in 4.2 s loops (±4° at first, made more visible on 5 November), and its ears ±3° in 2.6 s
 * loops, the left one a little behind the right, so that they never move as one.
 */

export const SCARF_LOOP = 6000;
const ROSE_SWING = 3000;
const GUST_RATE = 1.6;
const GUST_LENGTH = 2200;
const GUST_EASE = 400;
const TAIL_LOOP = 4200;
const TAIL_SWING = 8;
const EAR_LOOP = 2600;
const EAR_SWING = 3;
/** How far behind the right ear the left one moves, in loops. */
const EAR_LAG = 0.18;

export interface WindState {
  /** The scarf's wave, from 0 to 1 over one loop. */
  scarfPhase: number;
  /** The rose's angle on screen, in degrees, clockwise. */
  roseDeg: number;
  /** The fox's tail, in degrees from its pose. */
  tailDeg: number;
  /** The fox's ears, in degrees from their pose: the left one, then the right one. */
  earsDeg: [number, number];
}

export interface Wind {
  /** Moves the wind on by `delta` ms. */
  advance(delta: number): WindState;
  /** How fast the wind runs now: 1, or up to 1.6 in a gust. */
  rate(): number;
}

/** The fox's tail and ears at `windTime`: sines from their pose, so that the wind rises from the modelled pose. */
export function foxAngles(windTime: number): Pick<WindState, 'tailDeg' | 'earsDeg'> {
  const ear = (lag: number): number => EAR_SWING * Math.sin(2 * Math.PI * (windTime / EAR_LOOP - lag));
  return {
    tailDeg: TAIL_SWING * Math.sin((2 * Math.PI * windTime) / TAIL_LOOP),
    earsDeg: [ear(EAR_LAG), ear(0)],
  };
}

/** The rose's angle at `windTime` (ms on the wind's clock): an eased swing between −1.2° and 2.4°. */
export function roseAngle(windTime: number): number {
  return 0.6 - 1.8 * Math.cos((Math.PI * windTime) / ROSE_SWING);
}

export function createWind(random: () => number = Math.random): Wind {
  let windTime = 0;
  let clock = 0;
  let nextGust = 7000 + random() * 7000;
  let gustStart = -Infinity;
  let rate = 1;

  return {
    advance(delta) {
      clock += delta;
      if (clock >= nextGust) {
        gustStart = nextGust;
        nextGust += GUST_LENGTH + 7000 + random() * 7000;
      }
      const inGust = clock - gustStart;
      const k =
        inGust < 0 || inGust > GUST_LENGTH + GUST_EASE
          ? 0
          : Math.min(1, inGust / GUST_EASE, (GUST_LENGTH + GUST_EASE - inGust) / GUST_EASE);
      rate = 1 + (GUST_RATE - 1) * k;
      windTime += delta * rate;
      return { scarfPhase: (windTime / SCARF_LOOP) % 1, roseDeg: roseAngle(windTime), ...foxAngles(windTime) };
    },
    rate: () => rate,
  };
}

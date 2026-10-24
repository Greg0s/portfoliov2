/**
 * The weightless motions of the journey (journey spec §4 and §5): the cards float by ±12 px over 8 to 10.5 s, the
 * small worlds by a few px, the planet by ±10 px; the camera drifts a few px and a fraction of a degree over 11 s.
 * They are computed from the time, so that the one loop draws them with the camera.
 */

/** An eased swing from -1 to 1 and back, `duration` ms each way, started `delay` ms ago (negative: already going). */
export function swing(time: number, duration: number, delay = 0): number {
  return -Math.cos((Math.PI * (time - delay)) / duration);
}

/** The camera's drift at `time`: ±5 px across, ±3 px up and down, ±0.2° of roll, over 11 s each way. */
export function drift(time: number): { dx: number; dy: number; roll: number } {
  const s = swing(time, 11_000);
  return { dx: 5 * s, dy: -3 * s, roll: 0.2 * s };
}

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { HANDOFF_FADE, planetHandoff } from '../../src/scene/planet/handoff';
import { MOMENT_FADE, mixMoments, momentColors } from '../../src/scene/planet/lights';
import { createWind, roseAngle, SCARF_LOOP } from '../../src/scene/planet/wind';
import { frameSampler } from '../../src/scene/quality';
import { craterPlanet, crumpledBall, type Arrays, type Calm } from '../../src/scene/workers/relief';

const hash = (arrays: Arrays): string =>
  createHash('sha256')
    .update(new Uint8Array(arrays.position.buffer))
    .update(new Uint8Array(arrays.index.buffer))
    .digest('hex');

const calm: Calm[] = [{ dir: [0, 1, 0], radius: 0.42, floor: 0.15 }];

describe('the relief', () => {
  it('is the same planet and the same hair from one build to the next', () => {
    expect(hash(craterPlanet(16, calm))).toBe(hash(craterPlanet(16, calm)));
    expect(hash(crumpledBall(12))).toBe(hash(crumpledBall(12)));
    expect(hash(craterPlanet(16, calm))).not.toBe(hash(craterPlanet(16, calm, 6)));
  });

  it('stays calm where the characters stand', () => {
    const planet = craterPlanet(24, calm);
    const free = craterPlanet(24, []);
    // How far from the unit sphere the surface goes, around the calm direction and elsewhere.
    const spread = (arrays: Arrays, near: boolean): number => {
      let max = 0;
      for (let i = 0; i < arrays.position.length; i += 3) {
        const [x = 0, y = 0, z = 0] = arrays.position.subarray(i, i + 3);
        const r = Math.hypot(x, y, z);
        if (y / r > 0.97 === near) max = Math.max(max, Math.abs(r - 1));
      }
      return max;
    };
    expect(spread(planet, true)).toBeLessThan(spread(free, true) * 0.5);
    expect(spread(planet, false)).toBeCloseTo(spread(free, false), 2);
  });
});

describe('the wind', () => {
  it('runs the scarf in 6 s loops and sways the rose between −1.2° and 2.4°', () => {
    expect(roseAngle(0)).toBeCloseTo(-1.2);
    expect(roseAngle(3000)).toBeCloseTo(2.4);
    // No gust in the first 7 s.
    const wind = createWind(() => 0.5);
    const state = wind.advance(SCARF_LOOP / 4);
    expect(state.scarfPhase).toBeCloseTo(0.25);
    expect(wind.rate()).toBe(1);
  });

  it('quickens 1.6 times in a gust, smoothly, then calms down', () => {
    const wind = createWind(() => 0);
    const rates: number[] = [];
    for (let t = 0; t < 12_000; t += 50) {
      wind.advance(50);
      rates.push(wind.rate());
    }
    expect(Math.max(...rates)).toBeCloseTo(1.6);
    // Never more than a small step from one frame to the next.
    const steps = rates.slice(1).map((rate, i) => Math.abs(rate - (rates[i] ?? 1)));
    expect(Math.max(...steps)).toBeLessThan(0.1);
    expect(rates.at(-1)).toBe(1);
  });
});

describe('the moment', () => {
  it('cross-fades the spot and the sky at noon', () => {
    const start = mixMoments('aube', 'crepuscule', 0);
    const end = mixMoments('aube', 'crepuscule', MOMENT_FADE);
    expect(start.spot.getHex()).toBe(momentColors.aube.spot);
    expect(end.spot.getHex()).toBe(momentColors.crepuscule.spot);
    expect(end.sky.getHex()).toBe(momentColors.crepuscule.sky);
    const mid = mixMoments('aube', 'crepuscule', MOMENT_FADE / 2).spot.getHex();
    expect(mid).not.toBe(momentColors.aube.spot);
    expect(mid).not.toBe(momentColors.crepuscule.spot);
  });
});

describe('the handoff', () => {
  const element = (): HTMLElement & HTMLCanvasElement => {
    const style: { opacity?: string; backgroundImage?: string; removeProperty: (name: string) => void } = {
      removeProperty: (name) => {
        if (name === 'background-image') delete style.backgroundImage;
      },
    };
    return { style } as unknown as HTMLElement & HTMLCanvasElement;
  };

  it('fades the live planet in over its image, takes the image away, and gives it back when blurred', () => {
    const image = element();
    const canvas = element();
    const handoff = planetHandoff(image, canvas);
    expect(handoff.update(false, 0)).toBe(false);
    expect(handoff.update(true, 100)).toBe(true);
    expect(handoff.state()).toBe('in');
    expect(canvas.style.opacity).toBe('1');
    expect(image.style.backgroundImage).toBeUndefined();
    handoff.update(true, 100 + HANDOFF_FADE);
    expect(handoff.state()).toBe('live');
    expect(image.style.backgroundImage).toBe('none');
    // Receding: the image is back at once, the canvas fades out and still draws until it is gone.
    expect(handoff.update(false, 1000)).toBe(true);
    expect(image.style.backgroundImage).toBeUndefined();
    expect(canvas.style.opacity).toBe('0');
    expect(handoff.update(false, 1000 + HANDOFF_FADE)).toBe(false);
    expect(handoff.state()).toBe('image');
  });
});

describe('the quality', () => {
  it('lets a scene keep going at 40 fps or more over 3 s, and stops it under', () => {
    const fast = frameSampler();
    const slow = frameSampler();
    let fastVerdict = 'measuring';
    let slowVerdict = 'measuring';
    for (let i = 0; i < 200; i += 1) {
      fastVerdict = fast.add(1000 / 45);
      slowVerdict = slow.add(1000 / 30);
    }
    expect(fastVerdict).toBe('fast');
    expect(slowVerdict).toBe('slow');
    expect(frameSampler().add(1000)).toBe('measuring');
  });
});

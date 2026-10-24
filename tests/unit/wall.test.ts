import { describe, expect, it } from 'vitest';
import { cartelFields, draw } from '../../src/lib/wall';

describe('draw', () => {
  const pools = new Map([
    ['film', ['a', 'b', 'c']],
    ['album', ['x']],
    ['painting', []],
  ]);

  it('gives each frame one of its own pictures and leaves out an empty frame', () => {
    for (let run = 0; run < 50; run += 1) {
      const drawn = draw(pools);
      expect(['a', 'b', 'c']).toContain(drawn.get('film'));
      expect(drawn.get('album')).toBe('x');
      expect(drawn.has('painting')).toBe(false);
    }
  });

  it('changes the picture of a frame that has several', () => {
    const previous = new Map([['film', 'b']]);
    for (const value of [0, 0.4, 0.99]) {
      expect(draw(pools, previous, () => value).get('film')).not.toBe('b');
    }
  });

  it('keeps the only picture of a frame that has one', () => {
    expect(draw(pools, new Map([['album', 'x']])).get('album')).toBe('x');
  });
});

describe('cartelFields', () => {
  it('shows a title with its author and year', () => {
    expect(cartelFields({ title: 'La Nuit étoilée', author: 'Vincent van Gogh', year: 1889 }, 'fr')).toEqual({
      main: 'La Nuit étoilée',
      isTitle: true,
      sub: 'Vincent van Gogh, 1889',
      original: undefined,
      credit: undefined,
    });
  });

  it('leads with the author when there is no title', () => {
    expect(cartelFields({ author: 'Bill Anders', year: 1968, credit: 'NASA, Apollo 8' }, 'en')).toEqual({
      main: 'Bill Anders',
      isTitle: false,
      sub: '1968',
      original: undefined,
      credit: 'NASA, Apollo 8',
    });
  });

  it('has no cartel when nothing is known', () => {
    expect(cartelFields({}, 'fr')).toBeUndefined();
    expect(cartelFields({ credit: 'Unsplash' }, 'fr')).toBeUndefined();
  });

  it('gives French films their French title with the original below, English ones the original only', () => {
    const film = {
      title: { fr: 'Le Voyage de Chihiro', en: 'Spirited Away' },
      originalTitle: 'Sen to Chihiro no Kamikakushi',
      year: 2001,
    };
    expect(cartelFields(film, 'fr')).toMatchObject({
      main: 'Le Voyage de Chihiro',
      original: 'Sen to Chihiro no Kamikakushi',
    });
    expect(cartelFields(film, 'en')).toMatchObject({ main: 'Sen to Chihiro no Kamikakushi', original: undefined });
  });
});

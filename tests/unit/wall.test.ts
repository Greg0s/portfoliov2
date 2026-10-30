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
      credit: undefined,
    });
  });

  it('leads with the author when there is no title', () => {
    expect(cartelFields({ author: 'Bill Anders', year: 1968, credit: 'NASA, Apollo 8' }, 'en')).toEqual({
      main: 'Bill Anders',
      isTitle: false,
      sub: '1968',
      credit: 'NASA, Apollo 8',
    });
  });

  it('puts the place between the author and the year', () => {
    expect(cartelFields({ title: 'Alone?', place: 'Louvre, Paris', year: 2023 }, 'fr')).toEqual({
      main: 'Alone?',
      isTitle: true,
      sub: 'Louvre, Paris, 2023',
      credit: undefined,
    });
    const eibsee = { place: { fr: 'Eibsee, Allemagne', en: 'Eibsee, Germany' }, year: 2024 };
    expect(cartelFields(eibsee, 'fr')).toMatchObject({ main: 'Eibsee, Allemagne' });
    expect(cartelFields(eibsee, 'en')).toMatchObject({
      main: 'Eibsee, Germany',
      isTitle: false,
      sub: '2024',
    });
  });

  it('has no cartel when nothing is known', () => {
    expect(cartelFields({}, 'fr')).toBeUndefined();
    expect(cartelFields({ credit: 'Unsplash' }, 'fr')).toBeUndefined();
  });

  it('gives films their French title on the French site and their original title on the English one', () => {
    const film = {
      title: { fr: 'Le Voyage de Chihiro', en: 'Spirited Away' },
      originalTitle: 'Sen to Chihiro no Kamikakushi',
      year: 2001,
    };
    expect(cartelFields(film, 'fr')).toEqual({
      main: 'Le Voyage de Chihiro',
      isTitle: true,
      sub: '2001',
      credit: undefined,
    });
    expect(cartelFields(film, 'en')).toMatchObject({ main: 'Sen to Chihiro no Kamikakushi' });
  });
});

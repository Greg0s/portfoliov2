import { describe, expect, it } from 'vitest';
import { joinBase, withBase } from '../../src/lib/url';

describe('joinBase', () => {
  it('prefixes a page with the base and adds the trailing slash', () => {
    expect(joinBase('/portfoliov2/', '/en/')).toBe('/portfoliov2/en/');
    expect(joinBase('/portfoliov2/', 'en')).toBe('/portfoliov2/en/');
    expect(joinBase('/portfoliov2/', '/projets/lyrix')).toBe('/portfoliov2/projets/lyrix/');
  });

  it('works without a base', () => {
    expect(joinBase('/', '/en/')).toBe('/en/');
    expect(joinBase('/', 'en')).toBe('/en/');
    expect(joinBase('', '/')).toBe('/');
    expect(joinBase('/', '')).toBe('/');
  });

  it('accepts a base with or without its slashes', () => {
    expect(joinBase('portfoliov2', '/en/')).toBe('/portfoliov2/en/');
    expect(joinBase('/portfoliov2', 'en/')).toBe('/portfoliov2/en/');
  });

  it('gives the home page with and without a leading slash', () => {
    expect(joinBase('/portfoliov2/', '/')).toBe('/portfoliov2/');
    expect(joinBase('/portfoliov2/', '')).toBe('/portfoliov2/');
  });

  it('keeps a fragment after the trailing slash', () => {
    expect(joinBase('/portfoliov2/', '/#contact')).toBe('/portfoliov2/#contact');
    expect(joinBase('/portfoliov2/', '#contact')).toBe('/portfoliov2/#contact');
    expect(joinBase('/portfoliov2/', 'en#projects')).toBe('/portfoliov2/en/#projects');
    expect(joinBase('/', '/en/#contact')).toBe('/en/#contact');
  });

  it('keeps a query string', () => {
    expect(joinBase('/portfoliov2/', '/?still=1')).toBe('/portfoliov2/?still=1');
    expect(joinBase('/portfoliov2/', 'en?gl=0#contact')).toBe('/portfoliov2/en/?gl=0#contact');
  });

  it('adds no trailing slash to a file', () => {
    expect(joinBase('/portfoliov2/', '/cv/gregoire-tinnes-cv.pdf')).toBe('/portfoliov2/cv/gregoire-tinnes-cv.pdf');
    expect(joinBase('/', 'models/petit-prince.glb')).toBe('/models/petit-prince.glb');
  });
});

describe('withBase', () => {
  it('uses the base path of the build', () => {
    expect(withBase('/en/')).toBe(joinBase(import.meta.env.BASE_URL, '/en/'));
    expect(withBase('/')).toBe(import.meta.env.BASE_URL.replace(/\/?$/, '/'));
  });
});

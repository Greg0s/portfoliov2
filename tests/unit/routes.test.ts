import { describe, expect, it } from 'vitest';
import { getLocale, stripBase } from '../../src/i18n';
import { alternate, fragments, locales, parsePath, pathFor, translateFragment } from '../../src/i18n/routes';

describe('pathFor', () => {
  it('puts French at the root and English under /en/', () => {
    expect(pathFor({ id: 'home' }, 'fr')).toBe('/');
    expect(pathFor({ id: 'home' }, 'en')).toBe('/en/');
  });

  it('names the case studies in each language, with the same slug', () => {
    expect(pathFor({ id: 'project', slug: 'lyrix' }, 'fr')).toBe('/projets/lyrix/');
    expect(pathFor({ id: 'project', slug: 'lyrix' }, 'en')).toBe('/en/projects/lyrix/');
  });
});

describe('parsePath', () => {
  it('reads every route back in every language', () => {
    for (const locale of locales) {
      for (const route of [{ id: 'home' }, { id: 'project', slug: 'sncf-wrapped' }] as const) {
        expect(parsePath(pathFor(route, locale))).toEqual({ locale, route });
      }
    }
  });

  it('accepts paths without their trailing slash, or with a query and a fragment', () => {
    expect(parsePath('/en')).toEqual({ locale: 'en', route: { id: 'home' } });
    expect(parsePath('/projets/recoding?still=1#x')).toEqual({
      locale: 'fr',
      route: { id: 'project', slug: 'recoding' },
    });
  });

  it('knows no route for a path the site does not have', () => {
    expect(parsePath('/projects/lyrix/').route).toBeUndefined();
    expect(parsePath('/en/projets/lyrix/').route).toBeUndefined();
    expect(parsePath('/projets/').route).toBeUndefined();
    expect(parsePath('/projets/lyrix/extra/').route).toBeUndefined();
    expect(parsePath('/about.html').route).toBeUndefined();
  });
});

describe('alternate', () => {
  it('leads to the equivalent page', () => {
    expect(alternate('/', 'en')).toBe('/en/');
    expect(alternate('/en/', 'fr')).toBe('/');
    expect(alternate('/projets/obaine/', 'en')).toBe('/en/projects/obaine/');
    expect(alternate('/en/projects/obaine/', 'fr')).toBe('/projets/obaine/');
    expect(alternate('/', 'fr')).toBe('/');
  });

  it('translates the home anchors and keeps a project slug', () => {
    expect(alternate('/#projets', 'en')).toBe('/en/#projects');
    expect(alternate('/en/#home', 'fr')).toBe('/#accueil');
    expect(alternate('/#contact', 'en')).toBe('/en/#contact');
    expect(alternate('/#lyrix', 'en')).toBe('/en/#lyrix');
  });

  it('sends an unknown page to the other home', () => {
    expect(alternate('/nulle-part/', 'en')).toBe('/en/');
  });
});

describe('fragments', () => {
  it('has a name for every anchor in every language, each translating to the other', () => {
    for (const names of Object.values(fragments)) {
      for (const from of locales) {
        for (const to of locales) {
          expect(translateFragment(names[from], to)).toBe(names[to]);
        }
      }
    }
  });
});

describe('getLocale and stripBase', () => {
  it('read the language under the base path', () => {
    expect(stripBase('/portfoliov2/en/', '/portfoliov2/')).toBe('/en/');
    expect(stripBase('/portfoliov2/', '/portfoliov2/')).toBe('/');
    expect(stripBase('/portfoliov2', '/portfoliov2/')).toBe('/');
    expect(stripBase('/en/', '/')).toBe('/en/');
    expect(stripBase('/portfoliov2-old/', '/portfoliov2/')).toBe('/portfoliov2-old/');
    const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
    expect(getLocale(new URL(`https://example.com${base}en/projects/lyrix/`))).toBe('en');
    expect(getLocale(new URL(`https://example.com${base}projets/lyrix/`))).toBe('fr');
  });
});

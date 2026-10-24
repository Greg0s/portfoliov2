import { describe, expect, it } from 'vitest';
import { en } from '../../src/i18n/en';
import { fr, type Key } from '../../src/i18n/fr';
import { t } from '../../src/i18n';

describe('interface strings', () => {
  it('exist in English for every French key, and no more', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
    for (const value of Object.values(en)) expect(value.trim()).not.toBe('');
  });

  it('are read per language', () => {
    expect(t('fr')('nav.projects')).toBe('Projets');
    expect(t('en')('nav.projects')).toBe('Projects');
  });

  it('fail the type check when a key is missing', () => {
    // @ts-expect-error A dictionary without all the keys does not type-check (`astro check` runs on the tests).
    const missing: Record<Key, string> = { 'site.title': 'Grégoire Tinnes' };
    expect(missing).toBeDefined();
  });
});

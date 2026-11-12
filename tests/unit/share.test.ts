import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { locales } from '../../src/i18n/routes';
import { caseStudyData, homeData, SHARE_SIZE, shareImagePath } from '../../src/lib/share';
import { sitemapLinks } from '../../src/lib/sitemap';

const slugs = readdirSync(resolve('src/content/projects'));

describe('share images', () => {
  it('exist for the home and every case study, in each language, at 1200 × 630', async () => {
    for (const locale of locales) {
      for (const page of ['home', ...slugs]) {
        const file = resolve('public', shareImagePath(locale, page).replace(/^\//, ''));
        expect(existsSync(file), file).toBe(true);
        const { width, height } = await sharp(file).metadata();
        expect({ width, height }).toEqual(SHARE_SIZE);
      }
    }
  });
});

describe('structured data', () => {
  it('describes the home as a site and the person it presents', () => {
    const data = homeData({
      siteUrl: 'https://example.com/',
      locale: 'fr',
      description: 'Description',
      jobTitle: 'Développeur créatif',
      image: 'https://example.com/images/share/fr/home.jpg',
    });
    const graph = data['@graph'] as Record<string, unknown>[];
    expect(graph.map((node) => node['@type'])).toEqual(['Person', 'WebSite']);
    expect(graph[0]).toMatchObject({ name: 'Grégoire Tinnes', jobTitle: 'Développeur créatif' });
    expect((graph[0]?.sameAs as string[]).length).toBeGreaterThan(0);
  });

  it('credits a case study to the same person', () => {
    const data = caseStudyData({
      siteUrl: 'https://example.com/',
      url: 'https://example.com/projets/lyrix/',
      locale: 'fr',
      name: 'Lyrix',
      description: 'Description',
      image: 'https://example.com/images/share/fr/lyrix.jpg',
      year: 2026,
      keywords: ['React', 'TypeScript'],
      jobTitle: 'Développeur créatif',
    });
    expect(data).toMatchObject({ '@type': 'CreativeWork', dateCreated: '2026', keywords: 'React, TypeScript' });
    expect(data.author).toMatchObject({ '@id': 'https://example.com/#person' });
  });
});

describe('sitemap alternates', () => {
  it('pair a case study with its other language, whose path differs', () => {
    expect(sitemapLinks('https://example.com/portfoliov2/projets/lyrix/', '/portfoliov2/')).toEqual([
      { lang: 'fr', url: 'https://example.com/portfoliov2/projets/lyrix/' },
      { lang: 'en', url: 'https://example.com/portfoliov2/en/projects/lyrix/' },
      { lang: 'x-default', url: 'https://example.com/portfoliov2/projets/lyrix/' },
    ]);
  });

  it('pair the homes, at the root too', () => {
    expect(sitemapLinks('https://example.com/en/', '/').map(({ url }) => url)).toEqual([
      'https://example.com/',
      'https://example.com/en/',
      'https://example.com/',
    ]);
  });

  it('leave out a page outside the routes', () => {
    expect(sitemapLinks('https://example.com/portfoliov2/about.html/', '/portfoliov2/')).toEqual([]);
  });
});

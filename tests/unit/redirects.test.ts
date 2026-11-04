import { describe, expect, it } from 'vitest';
import { buildRedirects } from '../../src/redirects';

describe('the old site’s URLs', () => {
  const redirects = buildRedirects('/portfoliov2/');

  it('send each kept project to its case study, under the base path', () => {
    expect(redirects['/obaine.html']).toBe('/portfoliov2/projets/obaine/');
    expect(redirects['/what-we-play.html']).toBe('/portfoliov2/projets/what-we-play/');
    expect(redirects['/litterature-combinatoire-pub.html']).toBe('/portfoliov2/projets/litterature-combinatoire/');
  });

  it('send the dropped projects to the home', () => {
    expect(redirects['/la-fabrique-des-mondes.html']).toBe('/portfoliov2/');
    expect(redirects['/recoding.html']).toBe('/portfoliov2/');
  });

  it('send about and contact to the home and its contact', () => {
    expect(redirects['/about.html']).toBe('/portfoliov2/');
    expect(redirects['/contact.html']).toBe('/portfoliov2/#contact');
  });

  it('follow the base path, "/" once the site is live', () => {
    expect(buildRedirects('/')['/obaine.html']).toBe('/projets/obaine/');
  });

  it('leave the home page alone, and anything else to the 404', () => {
    expect(redirects['/index.html']).toBeUndefined();
    expect(redirects['/spotify.html']).toBeUndefined();
  });
});

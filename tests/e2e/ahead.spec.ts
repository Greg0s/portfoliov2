import { expect, test, type Page } from '@playwright/test';
import { trackErrors } from './helpers';

// Loading ahead (src/scene/ahead.ts): once the opening shows, what the rest of the visit asks for is fetched in the
// background, after the page's load, in the order the visitor meets it.

/** The files the page fetched, in order, with when each one started and when the page's load ended, in ms. */
async function fetched(page: Page): Promise<{ load: number; files: { url: string; at: number }[] }> {
  return page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    return {
      load: navigation?.loadEventEnd ?? 0,
      files: performance
        .getEntriesByType('resource')
        .map((entry) => ({ url: new URL(entry.name).pathname, at: entry.startTime }))
        .sort((a, b) => a.at - b.at),
    };
  });
}

const caseStudy = /\/projets\/[^/]+\/$/;
const layer = /\/images\/office\/layers\/.+\.webp$/;
const capture = /\/images\/screen\/(linkedin|github|instagram|cv)/;

test('after the page has loaded, the case studies come first, then the office, its wall and its screen', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await page.goto('./');
  await expect
    .poll(async () => (await fetched(page)).files.some(({ url }) => capture.test(url)), { timeout: 60_000 })
    .toBe(true);
  const { load, files } = await fetched(page);
  const at = (test: RegExp): number[] => files.filter(({ url }) => test.test(url)).map(({ at: start }) => start);
  const cases = at(caseStudy);
  expect(cases).toHaveLength(7);
  // Nothing ahead before the page's own load and a little after: the opening keeps the network to itself.
  expect(Math.min(...cases)).toBeGreaterThan(load + 1500);
  expect(Math.max(...cases)).toBeLessThan(Math.min(...at(layer)));
  expect(Math.max(...at(layer))).toBeLessThan(Math.min(...at(capture)));
  expect(errors).toEqual([]);
});

test.describe('with the data saver on', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'connection', { value: { saveData: true, effectiveType: '4g' } });
    });
  });

  test('only the case studies’ pages are fetched ahead', async ({ page }) => {
    await page.goto('./');
    await expect
      .poll(async () => (await fetched(page)).files.filter(({ url }) => caseStudy.test(url)).length, {
        timeout: 60_000,
      })
      .toBe(7);
    await page.waitForTimeout(2000);
    const { files } = await fetched(page);
    expect(files.filter(({ url }) => capture.test(url) || layer.test(url))).toEqual([]);
  });
});

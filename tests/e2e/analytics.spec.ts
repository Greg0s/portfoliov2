import { expect, test, type Page } from '@playwright/test';
import { trackErrors } from './helpers';

// The visit's counter (src/motion/analytics.ts): Umami's script is added only on the site's domain, never here; the
// clicks that matter reach `umami.track` when it is there, without changing what the click does.

/** Stands in for Umami's script: records each event instead of sending it. */
async function fakeUmami(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const events: unknown[] = [];
    Object.assign(window, {
      events,
      umami: { track: (name: string, data?: Record<string, string>) => events.push({ name, data }) },
    });
  });
}

const events = (page: Page): Promise<unknown[]> =>
  page.evaluate(() => (window as unknown as { events: unknown[] }).events);

test('Umami stays off the tests: its script is added only on the site’s domain', async ({ page }) => {
  const asked: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('umami')) asked.push(request.url());
  });
  await page.goto('en/');
  await page.waitForLoadState('load');
  await page.waitForTimeout(500);
  expect(await page.locator('script[data-website-id]').count()).toBe(0);
  expect(asked).toEqual([]);
});

test('a card, the next project and the language switch are counted, and still do what they do', async ({ page }) => {
  const errors = trackErrors(page);
  await fakeUmami(page);
  await page.goto('./#what-we-play');
  await expect(page.locator('html')).toHaveAttribute('data-journey', 'on');
  await expect(page.locator('[data-journey-root]')).toHaveAttribute('data-anchor', '1', { timeout: 20_000 });

  await page.locator('#what-we-play a.card').click();
  await expect(page).toHaveURL(/projets\/what-we-play\/$/);
  // The client router kept the document: the dive played, and the page did not load again.
  expect(await events(page)).toEqual([{ name: 'case-study', data: { project: 'what-we-play', from: 'ring' } }]);

  await page.locator('.next a').click();
  await expect(page).not.toHaveURL(/what-we-play/);
  const next = new URL(page.url()).pathname.split('/').filter(Boolean).pop();
  await page.locator('[data-lang-switch="en"]:visible').first().click();
  await expect(page).toHaveURL(/\/en\//);
  expect(await events(page)).toEqual([
    { name: 'case-study', data: { project: 'what-we-play', from: 'ring' } },
    { name: 'case-study', data: { project: next, from: 'next' } },
    { name: 'language', data: { to: 'en' } },
  ]);
  expect(errors).toEqual([]);
});

test('the contact’s links and the email are counted', async ({ page, context, isMobile }) => {
  test.skip(isMobile, 'the email’s bubble is covered by the office tests; one layout is enough here');
  await context.route(/linkedin\.com|github\.com|instagram\.com/, (route) => route.abort());
  await fakeUmami(page);
  await page.goto('./#contact');
  await page.waitForLoadState('load');
  for (const name of ['LinkedIn', 'GitHub', 'Instagram']) {
    const popup = context.waitForEvent('page');
    await page.locator(`.contact .links a[data-screen-page="${name}"]`).click();
    await (await popup).close();
  }
  await page.locator('.contact [data-email] > a').evaluate((link) => {
    // The mail app is not opened: only the click is dispatched, as the visitor's would be.
    link.addEventListener(
      'click',
      (event) => {
        event.preventDefault();
      },
      { once: true },
    );
  });
  await page.locator('.contact [data-email] .copy').click();
  expect(await events(page)).toEqual([
    { name: 'linkedin' },
    { name: 'github' },
    { name: 'instagram' },
    { name: 'email', data: { action: 'copy' } },
  ]);
});

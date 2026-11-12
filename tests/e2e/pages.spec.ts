import { expect, test } from '@playwright/test';
import { trackErrors } from './helpers';

const homes = [
  { path: './', lang: 'fr', other: 'en/' },
  { path: 'en/', lang: 'en', other: './' },
] as const;

for (const { path, lang } of homes) {
  test(`the ${lang} home answers, declares its language and alternates, and logs no error`, async ({
    page,
    baseURL,
  }) => {
    const errors = trackErrors(page);
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // The alternates are absolute, on the site's domain, under the same base path as the build being tested.
    const home = new URL(new URL(baseURL ?? '').pathname, process.env.SITE_URL ?? 'https://gregoiretinn.es').href;
    await expect(page.locator('link[rel="alternate"][hreflang="fr"]')).toHaveAttribute('href', home);
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', `${home}en/`);
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute('href', home);
    expect(errors).toEqual([]);
  });
}

test('a shared link shows a title, a description and a share image that loads', async ({ page, request }) => {
  for (const path of ['./', 'en/projects/lyrix/']) {
    await page.goto(path);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', await page.title());
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', /\S/);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
    const image = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(image).toMatch(/^https:\/\/.+\.jpg$/);
    // The image's address is absolute, for the production host: its path is fetched from the preview.
    const response = await request.get(new URL(image ?? '').pathname);
    expect(response.status()).toBe(200);
    const data = await page.locator('script[type="application/ld+json"]').textContent();
    expect(JSON.parse(data ?? '{}')).toHaveProperty('@context', 'https://schema.org');
  }
});

test('an unknown path serves the 404 page, in both languages', async ({ page }) => {
  const response = await page.goto('cette-page-n-existe-pas/');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page introuvable' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to the home page' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('the favicons are declared and served', async ({ page, baseURL }) => {
  await page.goto('./');
  const icons = [
    ['link[rel="icon"][type="image/svg+xml"]', 'image/svg+xml'],
    ['link[rel="icon"][sizes="32x32"]', 'image/'],
    ['link[rel="apple-touch-icon"]', 'image/png'],
  ] as const;
  for (const [selector, type] of icons) {
    const href = await page.locator(selector).getAttribute('href');
    expect(href?.startsWith(new URL(baseURL ?? '').pathname)).toBe(true);
    const response = await page.request.get(new URL(href ?? '', page.url()).href);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain(type);
  }
});

test('the skip link leads to the content', async ({ page }) => {
  await page.goto('./');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Aller au contenu' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
});

test('?heure= sets the moment, and the clock sets it otherwise', async ({ page }) => {
  await page.goto('./?heure=aube');
  await expect(page.locator('html')).toHaveAttribute('data-moment', 'aube');
  await page.goto('en/?heure=crepuscule');
  await expect(page.locator('html')).toHaveAttribute('data-moment', 'crepuscule');
  await page.clock.setFixedTime(new Date(2026, 9, 23, 9, 30));
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-moment', 'aube');
  await page.clock.setFixedTime(new Date(2026, 9, 23, 12, 0));
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-moment', 'crepuscule');
});

test("the page's background glows with the accent's ends, the same at dawn and at dusk", async ({ page }) => {
  const glow = (): Promise<string> => page.evaluate(() => getComputedStyle(document.body, '::before').backgroundImage);
  await page.goto('./?heure=aube');
  const dawn = await glow();
  expect(dawn).toContain('rgba(109, 185, 110, 0.2)');
  expect(dawn).toContain('rgba(144, 211, 244, 0.2)');
  await page.goto('./?heure=crepuscule');
  expect(await glow()).toBe(dawn);
});

test('the moment survives a page change through the client router', async ({ page, isMobile }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 23, 20, 0));
  await page.goto('./');
  if (isMobile) {
    await page.getByRole('button', { name: 'Menu' }).click();
    await page
      .getByRole('dialog')
      .getByRole('link', { name: /English/ })
      .click();
  } else {
    await page
      .getByRole('banner')
      .getByRole('link', { name: /English/ })
      .click();
  }
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('data-moment', 'crepuscule');
});

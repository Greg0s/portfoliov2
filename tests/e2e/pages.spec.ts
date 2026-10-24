import { expect, test } from '@playwright/test';
import { trackErrors } from './helpers';

const homes = [
  { path: './', lang: 'fr', other: 'en/' },
  { path: 'en/', lang: 'en', other: './' },
] as const;

for (const { path, lang } of homes) {
  test(`the ${lang} home answers, declares its language and alternates, and logs no error`, async ({ page }) => {
    const errors = trackErrors(page);
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('link[rel="alternate"][hreflang="fr"]')).toHaveAttribute('href', /\/portfoliov2\/$/);
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', /\/portfoliov2\/en\/$/);
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute(
      'href',
      /\/portfoliov2\/$/,
    );
    expect(errors).toEqual([]);
  });
}

test('an unknown path serves the 404 page, in both languages', async ({ page }) => {
  const response = await page.goto('cette-page-n-existe-pas/');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page introuvable' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to the home page' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
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

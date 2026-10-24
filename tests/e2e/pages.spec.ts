import { expect, test, type Page } from '@playwright/test';

/** Collects console errors and uncaught exceptions for the whole test. */
function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

const homes = [
  { path: './', lang: 'fr' },
  { path: 'en/', lang: 'en' },
] as const;

for (const { path, lang } of homes) {
  test(`the ${lang} home answers, declares its language and logs no error`, async ({ page }) => {
    const errors = trackErrors(page);
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('the language links lead to the other home', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('link', { name: 'English' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.getByRole('link', { name: 'Français' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
});

test('an unknown path serves the 404 page', async ({ page }) => {
  const errors = trackErrors(page);
  const response = await page.goto('cette-page-n-existe-pas/');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page introuvable' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  expect(errors.filter((error) => !error.includes('404'))).toEqual([]);
});

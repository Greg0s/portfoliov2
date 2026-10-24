import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

for (const path of ['./', 'en/', 'projets/lyrix/', 'en/projects/la-fabrique-des-mondes/', 'cette-page-n-existe-pas/']) {
  test(`axe finds no violation on ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}

test('axe finds no violation in the open mobile menu', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'the menu only exists on small screens');
  await page.goto('./');
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('dialog')).toHaveAttribute('data-state', 'in');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

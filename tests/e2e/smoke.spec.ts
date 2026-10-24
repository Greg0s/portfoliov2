import { expect, test } from '@playwright/test';
import { trackErrors } from './helpers';

// A quick pass on every browser, Safari included: the home plays its journey, and the keys and fragments move it.
test('the journey plays and moves', async ({ page }) => {
  test.slow();
  const errors = trackErrors(page);
  const root = page.locator('[data-journey-root]');
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-journey', 'on');
  await expect(root).toHaveAttribute('data-anchor', '0');
  await page.keyboard.press('ArrowDown');
  await expect(root).toHaveAttribute('data-anchor', '1', { timeout: 20_000 });
  await expect(page.locator('[data-project="0"]')).toHaveClass(/\blit\b/);
  await page.keyboard.press('End');
  await expect(root).toHaveAttribute('data-anchor', '9', { timeout: 20_000 });
  await expect(page.getByRole('link', { name: 'contact@gregoiretinn.es' })).toBeVisible();

  await page.goto('./#lyrix');
  await expect(page.locator('#lyrix')).toHaveClass(/\blit\b/);
  expect(errors).toEqual([]);
});

import { expect, test } from '@playwright/test';
import { trackErrors } from './helpers';

// CI's WebKit draws WebGL in software, and its driver now and then fails to allocate a texture: the browser says so in
// the console and takes the context away. The site lives with it (the ring's sky turns to 2D canvases), and the
// journey below must play all the same: these two lines of the browser's are not the site's.
const DRIVER_GAVE_OUT = [/^WebGL: INVALID_OPERATION: .*Unexpected driver error\.$/, /^WebGL: context lost\.$/];

// A quick pass on every browser, Safari included: the home plays its journey, and the keys and fragments move it.
test('the journey plays and moves', async ({ page }) => {
  test.slow();
  const errors = trackErrors(page);
  const root = page.locator('[data-journey-root]');
  // CI's WebKit draws WebGL in software without saying so: its live planet would be found too slow and turn the visit
  // into the light version, and its live office would crawl until found too slow, as they should on such a device.
  // This pass is about the journey: both scenes are known slow, so the planet stays an image and the office its layers.
  await page.addInitScript(() => {
    sessionStorage.setItem('portfolio:slow', 'planet,office');
  });
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-journey', 'on');
  await expect(root).toHaveAttribute('data-anchor', '0');
  await page.keyboard.press('ArrowDown');
  await expect(root).toHaveAttribute('data-anchor', '1', { timeout: 20_000 });
  await expect(page.locator('[data-project="0"]')).toHaveClass(/\blit\b/);
  await page.keyboard.press('End');
  await expect(root).toHaveAttribute('data-anchor', '2', { timeout: 20_000 });
  await expect(page.getByRole('link', { name: 'gregoire.tinnes@gmail.com' })).toBeVisible();

  await page.goto('./#lyrix');
  await expect(page.locator('#lyrix')).toHaveClass(/\blit\b/);
  expect(errors.filter((error) => !DRIVER_GAVE_OUT.some((line) => line.test(error)))).toEqual([]);
});

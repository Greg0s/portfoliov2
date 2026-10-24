import { expect, test, type Page } from '@playwright/test';
import { trackErrors } from './helpers';

// The dive into a case study and back (src/motion/dive.ts): the overlay lives for about a second, so the page counts
// each one it sees.
async function countDives(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const record = window as unknown as { dives: number };
    record.dives = 0;
    new MutationObserver((records) => {
      for (const { addedNodes } of records)
        for (const node of addedNodes)
          if (node instanceof HTMLElement && node.classList.contains('dive')) record.dives += 1;
    }).observe(document, { childList: true, subtree: true });
  });
}
const dives = (page: Page): Promise<number> => page.evaluate(() => (window as unknown as { dives: number }).dives);

test('the sharp card dives into its case study, and the way back lands on it', async ({ page }) => {
  const errors = trackErrors(page);
  await countDives(page);
  await page.goto('./#what-we-play');
  await expect(page.locator('html')).toHaveAttribute('data-journey', 'on');
  const root = page.locator('[data-journey-root]');
  await expect(root).toHaveAttribute('data-anchor', '2', { timeout: 20_000 });

  await page.locator('#what-we-play a.card').click();
  await expect(page).toHaveURL(/projets\/what-we-play\/$/);
  expect(await dives(page)).toBe(1);
  await expect(page.locator('.dive')).toHaveCount(0);

  // Back to the projects: the picture comes back over the home and shrinks into the same card.
  await page.getByRole('link', { name: 'Retour aux projets' }).click();
  await expect(page).toHaveURL(/#what-we-play$/);
  await expect(root).toHaveAttribute('data-anchor', '2', { timeout: 20_000 });
  expect(await dives(page)).toBe(2);
  await expect(page.locator('.dive')).toHaveCount(0, { timeout: 6000 });

  // The browser's Back button, from the case study, does the same.
  await page.goBack();
  await expect(page).toHaveURL(/projets\/what-we-play\/$/);
  // Once the case study is shown: the router drops a Back pressed while it still swaps the page.
  await expect(page.locator('[data-case-slug]')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/#what-we-play$/);
  await expect(root).toHaveAttribute('data-anchor', '2', { timeout: 20_000 });
  expect(await dives(page)).toBe(3);
  await expect(page.locator('.dive')).toHaveCount(0, { timeout: 6000 });
  expect(errors).toEqual([]);
});

test('the next project dives from one case study into the next', async ({ page }) => {
  const errors = trackErrors(page);
  await countDives(page);
  await page.goto('projets/what-we-play/');
  await page.getByRole('navigation', { name: 'Projet suivant' }).getByRole('link').click();
  await expect(page).toHaveURL(/projets\/litterature-combinatoire\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await dives(page)).toBe(1);
  await expect(page.locator('.dive')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the router fades instead of the dive', async ({ page }) => {
    await countDives(page);
    await page.goto('./#what-we-play');
    await page.locator('#what-we-play a.card').click();
    await expect(page).toHaveURL(/projets\/what-we-play\/$/);
    await page.getByRole('link', { name: 'Retour aux projets' }).click();
    await expect(page).toHaveURL(/#what-we-play$/);
    await expect(page.locator('#what-we-play a.card')).toBeInViewport();
    expect(await dives(page)).toBe(0);
  });
});

import { expect, test, type Page } from '@playwright/test';
import { trackErrors } from './helpers';

// The dive into a case study and back (src/motion/dive.ts): the overlay lives for about a second, so the page counts
// each one it sees, and checks that it hands over on the opening media's place, which keeps the cards' format.
async function countDives(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const record = window as unknown as { dives: number; offMedia: string[] };
    record.dives = 0;
    record.offMedia = [];
    // Each picture is checked once its view transition's name is set, when it hands over to the router.
    const checked = new WeakSet<HTMLElement>();
    new MutationObserver((records) => {
      for (const { addedNodes } of records)
        for (const node of addedNodes)
          if (node instanceof HTMLElement && node.classList.contains('dive')) record.dives += 1;
      for (const picture of document.querySelectorAll<HTMLElement>('.dive-picture')) {
        if (checked.has(picture) || !picture.style.viewTransitionName) continue;
        checked.add(picture);
        const box = picture.getBoundingClientRect();
        const width = document.documentElement.clientWidth;
        if (Math.abs(box.top) > 1 || Math.abs(box.width - width) > 1 || Math.abs(box.height - (width * 9) / 16) > 1)
          record.offMedia.push(`${String(box.top)} ${String(box.width)}×${String(box.height)}`);
      }
    }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
  });
}
const dives = (page: Page): Promise<number> => page.evaluate(() => (window as unknown as { dives: number }).dives);
const offMedia = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { offMedia: string[] }).offMedia);

test('the sharp card dives into its case study, and the way back lands on it', async ({ page }) => {
  const errors = trackErrors(page);
  await countDives(page);
  await page.goto('./#what-we-play');
  await expect(page.locator('html')).toHaveAttribute('data-journey', 'on');
  const root = page.locator('[data-journey-root]');
  await expect(root).toHaveAttribute('data-anchor', '3', { timeout: 20_000 });

  await page.locator('#what-we-play a.card').click();
  await expect(page).toHaveURL(/projets\/what-we-play\/$/);
  expect(await dives(page)).toBe(1);
  await expect(page.locator('.dive')).toHaveCount(0);

  // Back to the projects: the picture comes back over the home and shrinks into the same card.
  await page.getByRole('link', { name: 'Retour aux projets' }).click();
  await expect(page).toHaveURL(/#what-we-play$/);
  await expect(root).toHaveAttribute('data-anchor', '3', { timeout: 20_000 });
  expect(await dives(page)).toBe(2);
  await expect(page.locator('.dive')).toHaveCount(0, { timeout: 6000 });

  // The browser's Back button, from the case study, does the same.
  await page.goBack();
  await expect(page).toHaveURL(/projets\/what-we-play\/$/);
  // Once the case study is shown: the router drops a Back pressed while it still swaps the page.
  await expect(page.locator('[data-case-slug]')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/#what-we-play$/);
  await expect(root).toHaveAttribute('data-anchor', '3', { timeout: 20_000 });
  expect(await dives(page)).toBe(3);
  await expect(page.locator('.dive')).toHaveCount(0, { timeout: 6000 });
  expect(await offMedia(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('the next project dives from one case study into the next', async ({ page }) => {
  const errors = trackErrors(page);
  await countDives(page);
  await page.goto('projets/what-we-play/');
  await page.getByRole('navigation', { name: 'Projet suivant' }).getByRole('link').click();
  await expect(page).toHaveURL(/projets\/perfmanager\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await dives(page)).toBe(1);
  await expect(page.locator('.dive')).toHaveCount(0);
  expect(await offMedia(page)).toEqual([]);
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

test('a slow case study keeps the home still under the picture, then opens', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the wheel and the keys are the desktop gestures');
  const errors = trackErrors(page);
  await page.goto('./#what-we-play');
  const root = page.locator('[data-journey-root]');
  await expect(root).toHaveAttribute('data-anchor', '3', { timeout: 20_000 });
  // The case study takes three seconds to come.
  await page.route('**/projets/what-we-play/', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await route.continue();
  });
  const before = await page.evaluate(() => window.scrollY);
  await page.locator('#what-we-play a.card').click();
  await page.waitForTimeout(1200);
  await page.mouse.wheel(0, 600);
  await page.keyboard.press('PageDown');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
  await expect(page).toHaveURL(/projets\/what-we-play\/$/, { timeout: 10_000 });
  await expect(page.locator('[data-case-slug]')).toBeVisible();
  await expect(page.locator('.dive')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a fling still running in the case study does not carry the home away on the way back', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'a finger flings the page on phones');
  await page.goto('./#obaine');
  const root = page.locator('[data-journey-root]');
  await expect(root).not.toHaveAttribute('data-anchor', '', { timeout: 20_000 });
  const anchor = await root.getAttribute('data-anchor');
  await page.locator('#obaine a.card').tap();
  await expect(page.locator('[data-case-slug]')).toBeVisible();
  await page.waitForTimeout(1000);
  // Down, then a quick swipe up, whose fling is still running when Back is pressed.
  const cdp = await page.context().newCDPSession(page);
  for (const [from, to] of [
    [700, 0],
    [700, 0],
    [100, 700],
  ] as const) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: from }] });
    for (let i = 1; i <= 12; i += 1) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: 200, y: from + ((to - from) * i) / 12 }],
      });
      await page.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  await page.goBack();
  await expect(page).toHaveURL(/#obaine$/);
  // On the same project, and soon: the picture does not wait for a journey carried elsewhere.
  await expect(root).toHaveAttribute('data-anchor', anchor ?? '', { timeout: 2000 });
  await expect(page.locator('.dive')).toHaveCount(0, { timeout: 2500 });
});

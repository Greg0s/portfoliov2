import { expect, test, type Page } from '@playwright/test';
import { trackErrors } from './helpers';

// The WebGL contexts of the home (the stars, the ring's sky, the planet, the office): a browser keeps only so many (8
// on a phone) and drops the oldest when one more comes, and a context can be lost at any time (the GPU taken back
// while the tab was away). The page notes each context it makes, to count those still alive and to lose one.
interface Noted {
  contexts: { canvas: HTMLCanvasElement; context: WebGL2RenderingContext }[];
}

async function noteContexts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const noted: Noted = { contexts: [] };
    (window as unknown as { noted: Noted }).noted = noted;
    // eslint-disable-next-line @typescript-eslint/unbound-method -- called with its canvas below
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: unknown[]) {
      const context = (getContext as (...all: unknown[]) => unknown).apply(this, args);
      if (context instanceof WebGL2RenderingContext && !noted.contexts.some((entry) => entry.context === context))
        noted.contexts.push({ canvas: this, context });
      return context;
    } as typeof getContext;
  });
}

/** How many of the contexts the page made are still alive. */
const alive = (page: Page): Promise<number> =>
  page.evaluate(
    () =>
      (window as unknown as { noted: Noted }).noted.contexts.filter(({ context }) => !context.isContextLost()).length,
  );

test('a case study and back leaves no WebGL context behind', async ({ page }) => {
  const errors = trackErrors(page);
  await noteContexts(page);
  await page.goto('./#what-we-play');
  const root = page.locator('[data-journey-root]');
  await expect(root).toHaveAttribute('data-anchor', '1', { timeout: 20_000 });
  await expect(page.locator('html')).toHaveAttribute('data-stars', 'webgl');
  const atFirst = await alive(page);
  expect(atFirst).toBeGreaterThan(0);

  for (let round = 0; round < 2; round += 1) {
    await page.locator('#what-we-play a.card').click();
    await expect(page).toHaveURL(/projets\/what-we-play\/$/);
    await page.getByRole('link', { name: 'Retour aux projets' }).click();
    await expect(page).toHaveURL(/#what-we-play$/);
    await expect(root).toHaveAttribute('data-anchor', '1', { timeout: 20_000 });
    await expect(page.locator('html')).toHaveAttribute('data-stars', 'webgl');
    await expect(page.locator('.dive')).toHaveCount(0, { timeout: 6000 });
  }
  // The sky's canvases of the visits before gave their contexts back; the stars' renderer was kept.
  expect(await alive(page)).toBe(atFirst);
  expect(errors).toEqual([]);
});

test('the live planet whose WebGL context is lost gives way to its image, then comes back', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'the same code on every screen: once is enough for a slow test');
  test.slow();
  const errors = trackErrors(page);
  await noteContexts(page);
  // Forced live: without a GPU, the measured rate would hand the planet back to its image.
  await page.goto('./?planete=live');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-journey', 'on');
  await page.mouse.move(200, 200);
  await expect(html).toHaveAttribute('data-planet', 'live', { timeout: 60_000 });

  await page.evaluate(() => {
    const planet = (window as unknown as { noted: Noted }).noted.contexts.find(({ canvas }) =>
      canvas.classList.contains('planet-canvas'),
    );
    // Seen when the image is back: the planet's canvas gone, before a new one comes.
    new MutationObserver((_, observer) => {
      if (document.querySelector('.planet-canvas')) return;
      document.documentElement.dataset.planetWasLost = '';
      observer.disconnect();
    }).observe(document.body, { childList: true, subtree: true });
    planet?.context.getExtension('WEBGL_lose_context')?.loseContext();
  });
  await expect(html).toHaveAttribute('data-planet-was-lost', '', { timeout: 10_000 });
  // Put together again, on a new context.
  await expect(html).toHaveAttribute('data-planet', 'live', { timeout: 60_000 });
  await expect(page.locator('.planet-canvas')).toHaveCount(1);
  expect(errors).toEqual([]);
});

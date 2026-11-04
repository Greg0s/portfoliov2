import { expect, test, type Page } from '@playwright/test';
import { trackErrors } from './helpers';

// The case studies side by side (src/motion/slide.ts, src/motion/swipe.ts): the page records each slide it plays, the
// side it went, from the root element's attributes, which the client router keeps from one page to the next.
async function recordSlides(page: Page, { hint = false } = {}): Promise<void> {
  await page.addInitScript((keepHint) => {
    const record = window as unknown as { slides: string[] };
    record.slides = [];
    // Unless a test looks at it, the swipe hint stays away: it moves the page by itself.
    if (!keepHint) localStorage.setItem('portfolio:swiped', '1');
    // On the document: the root element does not exist yet when this runs.
    new MutationObserver((mutations) => {
      for (const { target, oldValue } of mutations) {
        const html = document.documentElement;
        if (target === html && oldValue === null && html.hasAttribute('data-slid'))
          record.slides.push(html.dataset.slide ?? '?');
      }
    }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-slid'], attributeOldValue: true });
  }, hint);
}
const slides = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { slides: string[] }).slides);

/** Once the slide is over: the root element no longer carries it. */
const settled = (page: Page): Promise<void> => expect(page.locator('html')).not.toHaveAttribute('data-slide', /.*/);

/** A finger on the screen, from `from` to `to`, in small steps. */
async function drag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  { steps = 10, stepMs = 16 } = {},
): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
  for (let i = 1; i <= steps; i += 1) {
    const point = { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
    await page.waitForTimeout(stepMs);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

test('the next project slides the page sideways, and Back slides it the other way', async ({ page }) => {
  const errors = trackErrors(page);
  await recordSlides(page);
  await page.goto('projets/what-we-play/');
  await page.getByRole('navigation', { name: 'Projet suivant' }).getByRole('link').click();
  await expect(page).toHaveURL(/projets\/perfmanager\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Perfmanager' })).toBeVisible();
  await settled(page);
  // No dive: the page slides.
  await expect(page.locator('.dive')).toHaveCount(0);
  expect(await slides(page)).toEqual(['next']);
  // The page that came in shows in place, without its opening rise.
  await expect(page.locator('.sheet')).toHaveCSS('animation-name', 'none');

  await page.goBack();
  await expect(page).toHaveURL(/projets\/what-we-play\/$/);
  await settled(page);
  expect(await slides(page)).toEqual(['next', 'previous']);
  expect(errors).toEqual([]);
});

test('the last case study slides on to the first, round the ring', async ({ page }) => {
  await recordSlides(page);
  await page.goto('en/projects/sncf-wrapped/');
  await page.getByRole('navigation', { name: 'Next project' }).getByRole('link').click();
  await expect(page).toHaveURL(/en\/projects\/lyrix\/$/);
  await settled(page);
  expect(await slides(page)).toEqual(['next']);
});

test('the other language and the home do not slide', async ({ page }) => {
  await recordSlides(page);
  await page.goto('projets/lyrix/');
  await page.getByRole('link', { name: /^EN/ }).first().click();
  await expect(page).toHaveURL(/en\/projects\/lyrix\/$/);
  await page.getByRole('link', { name: 'Back to projects' }).click();
  await expect(page).toHaveURL(/en\/#lyrix$/);
  expect(await slides(page)).toEqual([]);
});

test.describe('on a touch screen', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(!isMobile, 'a finger swipes on phones');
  });

  test('a swipe to the left leads to the next case study, to the right to the previous, round the ring', async ({
    page,
  }) => {
    const errors = trackErrors(page);
    await recordSlides(page);
    await page.goto('projets/lyrix/');
    await expect(page.getByRole('heading', { level: 1, name: 'Lyrix' })).toBeVisible();

    await drag(page, { x: 330, y: 500 }, { x: 100, y: 500 });
    await expect(page).toHaveURL(/projets\/siemens\/$/);
    await settled(page);

    await drag(page, { x: 60, y: 500 }, { x: 300, y: 500 });
    await expect(page).toHaveURL(/projets\/lyrix\/$/);
    await settled(page);

    await drag(page, { x: 60, y: 500 }, { x: 300, y: 500 });
    await expect(page).toHaveURL(/projets\/sncf-wrapped\/$/);
    await settled(page);

    expect(await slides(page)).toEqual(['next', 'previous', 'previous']);
    expect(errors).toEqual([]);
  });

  test('the page follows the finger, showing the neighbour, and springs back from a short swipe', async ({ page }) => {
    await recordSlides(page);
    await page.goto('projets/obaine/');
    await expect(page.getByRole('heading', { level: 1, name: 'Obaine' })).toBeVisible();
    // Once the page is idle, both neighbours' pages are laid beside it.
    const next = page.locator('[data-peek="next"]');
    await expect(next).toHaveAttribute('data-filled', '');
    await expect(page.locator('[data-peek="previous"]')).toHaveAttribute('data-filled', '');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 300, y: 500 }] });
    for (let x = 290; x >= 160; x -= 10) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: 500 }] });
      await page.waitForTimeout(16);
    }
    // Halfway: the page is 140 px to the left, the next case study's page comes in from the right edge, beside it.
    expect(await page.locator('main').evaluate((main) => main.style.transform)).toBe('translateX(-140px)');
    await expect(next).toBeInViewport();
    const edges = await page.evaluate(() => ({
      page: document.querySelector('main')?.getBoundingClientRect().right,
      next: document.querySelector('[data-peek="next"]')?.getBoundingClientRect().left,
    }));
    expect(edges.next).toBeCloseTo(edges.page ?? 0, 0);
    // Back almost to the start, slowly: the finger changed its mind.
    for (let x = 170; x <= 280; x += 10) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: 500 }] });
      await page.waitForTimeout(40);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(600);
    await expect(page).toHaveURL(/projets\/obaine\/$/);
    expect(await page.locator('main').evaluate((main) => main.style.transform)).toBe('');
    expect(await slides(page)).toEqual([]);
  });

  test('a finger moving up or down scrolls, and never changes the case study', async ({ page }) => {
    await recordSlides(page);
    await page.goto('projets/siemens/');
    await expect(page.getByRole('heading', { level: 1, name: 'Siemens' })).toBeVisible();
    await drag(page, { x: 200, y: 700 }, { x: 260, y: 200 });
    await page.waitForTimeout(600);
    await expect(page).toHaveURL(/projets\/siemens\/$/);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
    expect(await slides(page)).toEqual([]);
  });

  test('the first case studies hint that the next one lies beside them, until a first swipe', async ({ page }) => {
    await recordSlides(page, { hint: true });
    await page.goto('projets/lyrix/');
    // The page leans toward the next case study once it has settled.
    await expect.poll(() => page.evaluate(() => localStorage.getItem('portfolio:swipe-hints'))).toBe('1');
    await page.waitForTimeout(1600);
    await drag(page, { x: 330, y: 500 }, { x: 100, y: 500 });
    await expect(page).toHaveURL(/projets\/siemens\/$/);
    expect(await page.evaluate(() => localStorage.getItem('portfolio:swiped'))).toBe('1');
    // Swiped once: no hint any more.
    await page.waitForTimeout(2500);
    expect(await page.evaluate(() => localStorage.getItem('portfolio:swipe-hints'))).toBe('1');
  });
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the router fades instead of the slide', async ({ page }) => {
    await recordSlides(page);
    await page.goto('projets/lyrix/');
    await page.getByRole('navigation', { name: 'Projet suivant' }).getByRole('link').click();
    await expect(page).toHaveURL(/projets\/siemens\/$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Siemens' })).toBeVisible();
    expect(await slides(page)).toEqual([]);
  });
});

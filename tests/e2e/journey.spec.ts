import { expect, test, type Page } from '@playwright/test';
import { trackErrors } from './helpers';

// The journey's anchors: 0 is the opening, 1 to 8 the projects in order, 9 the contact.
const CONTACT = 9;

/** The anchor the journey rests on, once it has settled there. */
async function expectAnchor(page: Page, anchor: number): Promise<void> {
  await expect(page.locator('[data-journey-root]')).toHaveAttribute('data-anchor', String(anchor), { timeout: 20_000 });
}

/** Waits for the journey to start: it marks the page, then rests on an anchor. */
async function openJourney(page: Page, path = './'): Promise<void> {
  await page.goto(path);
  await expect(page.locator('html')).toHaveAttribute('data-journey', 'on');
  await expect(page.locator('[data-journey-root]')).not.toHaveAttribute('data-anchor', '');
}

/** A swipe of a finger, `distance` px up (a negative distance swipes down). */
async function swipe(page: Page, distance: number): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const x = 195;
  const y = distance > 0 ? 650 : 250;
  const steps = 10;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= steps; i += 1) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: y - (distance * i) / steps }],
    });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test('the journey starts on the opening and logs no error', async ({ page }) => {
  const errors = trackErrors(page);
  await openJourney(page);
  await expectAnchor(page, 0);
  await expect(page.locator('html')).toHaveAttribute('data-stars', 'webgl');
  expect(errors).toEqual([]);
});

test('before its scripts run, the home shows the opening alone', async ({ page }) => {
  await page.route(/\/_astro\/.*\.js$/, (route) => route.abort());
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-journey', 'on');
  await expect(page.locator('.opening h1')).toBeVisible();
  await expect(page.locator('.contact')).toBeHidden();
  await expect(page.locator('.journey')).toBeHidden();
});

test('the live planet takes over its image after a gesture, and leaves it to the image as it recedes', async ({
  page,
}) => {
  test.slow();
  const errors = trackErrors(page);
  // Forced live: without a GPU, the measured rate would hand the planet back to its image.
  await openJourney(page, './?planete=live');
  await expect(page.locator('html')).not.toHaveAttribute('data-planet', /.*/);
  await page.mouse.move(200, 200);
  await expect(page.locator('html')).toHaveAttribute('data-planet', 'live', { timeout: 60_000 });
  await expect(page.locator('.planet-canvas')).toHaveCount(1);
  await page.keyboard.press('ArrowDown');
  await expectAnchor(page, 1);
  await expect(page.locator('html')).toHaveAttribute('data-planet', 'image');
  expect(errors).toEqual([]);
});

test('?gl=0 keeps the planet as an image', async ({ page }) => {
  await openJourney(page, './?gl=0');
  await page.mouse.move(200, 200);
  await page.waitForTimeout(1500);
  await expect(page.locator('.planet-canvas')).toHaveCount(0);
  await expect(page.locator('.planet-image')).toHaveCSS('background-image', /planet-/);
});

test('the wheel goes anchor by anchor to the contact, and back', async ({ page, isMobile }) => {
  test.skip(isMobile, 'phones have no wheel');
  test.slow();
  await openJourney(page);
  await page.mouse.move(720, 450);
  for (let anchor = 1; anchor <= CONTACT; anchor += 1) {
    await page.mouse.wheel(0, 120);
    await expectAnchor(page, anchor);
    if (anchor <= 8) await expect(page.locator(`[data-project="${String(anchor - 1)}"]`)).toHaveClass(/\blit\b/);
  }
  await page.mouse.wheel(0, -120);
  await expectAnchor(page, 8);
});

test('a swipe goes anchor by anchor to the contact, and a short touch stays', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'the swipe is a phone gesture');
  test.slow();
  await openJourney(page);
  for (let anchor = 1; anchor <= CONTACT; anchor += 1) {
    await swipe(page, 300);
    await expectAnchor(page, anchor);
  }
  await swipe(page, -300);
  await expectAnchor(page, 8);
  await swipe(page, 20);
  await page.waitForTimeout(800);
  await expectAnchor(page, 8);
});

test('a flick lands one anchor further, its fling held while the page glides there', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'the swipe is a phone gesture');
  await openJourney(page, './#recoding');
  await expectAnchor(page, 5);
  await swipe(page, 400);
  // What is left of the finger's fling would carry the page past the next anchor once the glide is over.
  await expect(page.locator('html')).toHaveCSS('overflow-y', 'hidden');
  await expectAnchor(page, 6);
  await expect(page.locator('html')).not.toHaveCSS('overflow-y', 'hidden');
  await page.waitForTimeout(1500);
  await expectAnchor(page, 6);
});

test('the keys go anchor by anchor to the contact, and to either end', async ({ page }) => {
  test.slow();
  await openJourney(page);
  for (let anchor = 1; anchor <= CONTACT; anchor += 1) {
    await page.keyboard.press(anchor % 2 ? 'ArrowDown' : 'PageDown');
    await expectAnchor(page, anchor);
  }
  await page.keyboard.press('ArrowUp');
  await expectAnchor(page, 8);
  await page.keyboard.press('Home');
  await expectAnchor(page, 0);
  await page.keyboard.press('End');
  await expectAnchor(page, CONTACT);
});

test('a project or contact link lands on its anchor', async ({ page }) => {
  await openJourney(page, './#lyrix');
  const lyrix = page.getByRole('listitem').filter({ hasText: 'Lyrix' });
  const index = Number(await lyrix.getAttribute('data-project'));
  await expectAnchor(page, index + 1);
  await expect(lyrix).toHaveClass(/\blit\b/);

  await openJourney(page, './#contact');
  await expectAnchor(page, CONTACT);
  await expect(page.getByRole('link', { name: 'contact@gregoiretinn.es' })).toBeVisible();
});

test('the focus goes from card to card, with its cartel, and Enter opens the case study', async ({ page }) => {
  await openJourney(page);
  const first = page.locator('[data-project="0"]');
  const card = first.getByRole('link');
  // Tab through the header and the opening until the first card.
  for (let i = 0; i < 20 && !(await card.evaluate((node) => node === document.activeElement)); i += 1) {
    await page.keyboard.press('Tab');
  }
  await expect(card).toBeFocused();
  await expectAnchor(page, 1);
  await expect(first).toHaveClass(/\blit\b/);
  await expect(first.locator('.cartel')).toBeVisible();

  await page.keyboard.press('Tab');
  await expectAnchor(page, 2);
  await expect(page.locator('[data-project="1"]').getByRole('link')).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/projets\/[^/]+\/$/);
});

test('with reduced motion, the home stays a still list', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await expect(page.locator('html')).not.toHaveAttribute('data-journey', 'on');
  await expect(page.locator('.scene-canvas')).toHaveCount(0);
  // Only the job title changes, in a fade (main spec §5.5): it is left out of the pictures.
  const shot = async (): Promise<Buffer> => page.screenshot({ mask: [page.locator('[data-jobs]')] });
  await page.waitForTimeout(3000);
  const before = await shot();
  await page.waitForTimeout(1000);
  // Compared as bytes: a diff of two pictures would take minutes to print.
  expect((await shot()).equals(before)).toBe(true);
});

test('?lite=1 keeps the list, for slow machines', async ({ page }) => {
  await page.goto('./?lite=1');
  await expect(page.locator('html')).not.toHaveAttribute('data-journey', 'on');
  await expect(page.getByRole('list', { name: 'Projets' }).getByRole('listitem')).toHaveCount(8);
});

// The plan asks for no long task over 50 ms while scrolling. Without a GPU, as on CI, the browser composites in
// software and its own commits take longer than that, whatever the page does: the frame rate is measured on real
// devices with `?mesure=1`. What the page controls is its own work, and the classic cause of slow frames: writing
// styles, then reading the layout back, which forces the browser to lay the page out again in the middle of a
// frame. So the test checks that the journey's frames never force a layout (a gesture's handler may read the scroll
// once), and reports the longest frame.
test('the frames of the journey never force a layout', async ({ page }, testInfo) => {
  test.slow();
  await openJourney(page);
  await page.evaluate(() => {
    // The Long Animation Frames API, not yet in TypeScript's DOM types.
    interface LongFrame extends PerformanceEntry {
      scripts: { invoker: string; forcedStyleAndLayoutDuration: number }[];
    }
    const journeyFrames: { duration: number; forced: number }[] = [];
    Object.assign(window, { journeyFrames });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as LongFrame[]) {
        const forced = entry.scripts
          .filter((script) => script.invoker === 'FrameRequestCallback')
          .reduce((sum, script) => sum + script.forcedStyleAndLayoutDuration, 0);
        journeyFrames.push({ duration: Math.round(entry.duration), forced: Math.round(forced) });
      }
    }).observe({ type: 'long-animation-frame' });
  });
  for (let anchor = 1; anchor <= CONTACT; anchor += 1) {
    await page.keyboard.press('ArrowDown');
    await expectAnchor(page, anchor);
  }
  const frames = await page.evaluate(
    () => (window as unknown as { journeyFrames: { duration: number; forced: number }[] }).journeyFrames,
  );
  testInfo.annotations.push({
    type: 'longest frame',
    description: `${String(Math.max(0, ...frames.map((frame) => frame.duration)))} ms`,
  });
  expect(frames.filter((frame) => frame.forced > 0)).toEqual([]);
});

test('?mesure=1 plays the journey and gives its frame rates', async ({ page, isMobile }) => {
  test.skip(isMobile, 'one run is enough to check the tool');
  test.setTimeout(120_000);
  await page.goto('./?mesure=1');
  const result = page.getByRole('status').filter({ hasText: '"phases"' });
  await expect(result).toBeVisible({ timeout: 100_000 });
  const text = (await result.textContent()) ?? '';
  for (const phase of ['ouverture', 'projets', 'repos', 'fin']) expect(text).toContain(`"${phase}"`);
  await expectAnchor(page, CONTACT);
});

test('nothing of the office loads before the first project', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await openJourney(page);
  await expectAnchor(page, 0);
  await page.mouse.move(200, 200);
  await page.waitForTimeout(1500);
  expect(requests.filter((url) => url.includes('/images/office/'))).toEqual([]);
});

test('?office=layers arrives at the seat over the layers, and logs no error', async ({ page }) => {
  const errors = trackErrors(page);
  await openJourney(page, './?office=layers#contact');
  await expectAnchor(page, CONTACT);
  await expect(page.locator('html')).toHaveAttribute('data-office', 'live', { timeout: 20_000 });
  await expect(page.locator('.office-layers .office-layer-image')).toHaveCount(3);
  await expect(page.locator('.office-canvas')).toHaveCount(0);
  await expect(page.locator('.office-screen')).toBeVisible();
  await expect(page.getByRole('link', { name: 'contact@gregoiretinn.es' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('?gl=0 shows the office over its layers', async ({ page }) => {
  await openJourney(page, './?gl=0#contact');
  await expectAnchor(page, CONTACT);
  await expect(page.locator('.office-layers .office-layer-image')).toHaveCount(3, { timeout: 20_000 });
  await expect(page.locator('.office-canvas')).toHaveCount(0);
});

test('the address bar coming and going leaves the contact at the end of its arrival', async ({ page }) => {
  await openJourney(page, './?office=layers#contact');
  await expectAnchor(page, CONTACT);
  const size = page.viewportSize() ?? { width: 0, height: 0 };
  // A taller screen, as when the bar hides, then a shorter one: the page still scrolls to the arrival's end.
  for (const height of [size.height + 80, size.height - 60]) {
    await page.setViewportSize({ width: size.width, height });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
    });
    await expectAnchor(page, CONTACT);
  }
});

test('?office=live arrives at the seat in the live office, and logs no error', async ({ page }) => {
  test.slow();
  const errors = trackErrors(page);
  // Forced live: without a GPU, the office would go to its layers.
  await openJourney(page, './?office=live#contact');
  await expectAnchor(page, CONTACT);
  await expect(page.locator('html')).toHaveAttribute('data-office', 'live', { timeout: 90_000 });
  await expect(page.locator('.office-canvas')).toHaveCount(1);
  await expect(page.locator('.office-layers')).toHaveCount(0);
  await expect(page.locator('.office-screen')).toBeVisible();
  expect(errors).toEqual([]);
});

test('once the device is found too slow, the visit goes on in the light version', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('portfolio:slow', 'planet,lite');
  });
  await page.goto('./');
  await expect(page.locator('html')).not.toHaveAttribute('data-journey', 'on');
  await expect(page.getByRole('list', { name: 'Projets' }).getByRole('listitem')).toHaveCount(8);
});

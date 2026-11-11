import { expect, test, type Page } from '@playwright/test';
import { trackErrors } from './helpers';

// The journey's anchors: 0 is the opening, 1 the ring of projects around the planet, 2 the contact.
const RING = 1;
const CONTACT = 2;

/** The anchor the journey rests on, once it has settled there. */
async function expectAnchor(page: Page, anchor: number, timeout = 20_000): Promise<void> {
  await expect(page.locator('[data-journey-root]')).toHaveAttribute('data-anchor', String(anchor), { timeout });
}

/** Waits for the journey to start: it marks the page, then rests on an anchor. */
async function openJourney(page: Page, path = './'): Promise<void> {
  await page.goto(path);
  await expect(page.locator('html')).toHaveAttribute('data-journey', 'on');
  await expect(page.locator('[data-journey-root]')).not.toHaveAttribute('data-anchor', '');
}

/** The project in front on the ring, once it has turned there. */
async function expectFront(page: Page, project: number): Promise<void> {
  await expect(page.locator(`[data-project="${String(project)}"]`)).toHaveClass(/\blit\b/, { timeout: 10_000 });
}

/**
 * A swipe of a finger, `distance` px up (a negative distance swipes down), or to the left with `sideways`, drifting
 * `drift` px up on the way. Returns how far the page scrolled while the finger was down.
 */
async function swipe(page: Page, distance: number, sideways = false, drift = 0): Promise<number> {
  const cdp = await page.context().newCDPSession(page);
  const x = sideways ? (distance > 0 ? 340 : 50) : 195;
  const y = sideways ? 450 : distance > 0 ? 650 : 250;
  const steps = 10;
  const from = await page.evaluate(() => window.scrollY);
  let scrolled = 0;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= steps; i += 1) {
    const moved = (distance * i) / steps;
    const drifted = (drift * i) / steps;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [sideways ? { x: x - moved, y: y - drifted } : { x, y: y - moved }],
    });
    await page.waitForTimeout(16);
    scrolled = Math.max(scrolled, Math.abs((await page.evaluate(() => window.scrollY)) - from));
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  return scrolled;
}

test('the journey starts on the opening and logs no error', async ({ page }) => {
  const errors = trackErrors(page);
  await openJourney(page);
  await expectAnchor(page, 0);
  await expect(page.locator('html')).toHaveAttribute('data-stars', 'webgl');
  expect(errors).toEqual([]);
});

test('a visit starts in the dark, then the planet, the name, the job, the header and the call show', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await page.goto('./');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-arrival', /^(waiting|playing)$/);
  await expect(page.locator('.night')).toBeVisible();
  // Once played, the opening is back to its own text and styles.
  await expect(html).not.toHaveAttribute('data-arrival', /.*/, { timeout: 10_000 });
  await expect(page.locator('.night')).toBeHidden();
  const name = page.getByRole('heading', { level: 1, name: 'Grégoire Tinnes' });
  await expect(name).toBeVisible();
  expect(await name.evaluate((element) => element.innerHTML)).toBe('Grégoire Tinnes');
  await expect(page.locator('.opening .job')).toHaveText('Développeur créatif');
  const opacity = (selector: string): Promise<string> =>
    page
      .locator(selector)
      .first()
      .evaluate((element) => getComputedStyle(element).opacity);
  expect(await opacity('.header')).toBe('1');
  expect(await opacity('.opening .planet-image')).toBe('1');
  expect(await opacity('.opening .cta-text')).toBe('0.8');
  expect(errors).toEqual([]);
});

test('a gesture plays the rest of the arrival faster', async ({ page }) => {
  await page.goto('./');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-arrival', 'playing');
  await page.mouse.click(20, 450);
  // Six times faster: what is left of its 4.6 s plays in less than 0.8 s.
  await expect(html).not.toHaveAttribute('data-arrival', /.*/, { timeout: 1500 });
});

test('the arrival leaves out a visit that starts elsewhere than the opening, and ?still=1', async ({ page }) => {
  for (const path of ['./#contact', './?still=1', './#lyrix']) {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('data-journey', 'on');
    await expect(page.locator('html')).not.toHaveAttribute('data-arrival', /.*/);
    await expect(page.locator('.night')).toBeHidden();
  }
});

test('before its scripts run, the home shows the opening alone', async ({ page }) => {
  await page.route(/\/_astro\/.*\.js$/, (route) => route.abort());
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-journey', 'on');
  await expect(page.locator('.opening h1')).toBeVisible();
  await expect(page.locator('.contact')).toBeHidden();
  await expect(page.locator('.journey')).toBeHidden();
});

test('the live planet takes over its image after a gesture, stays in the ring, and is let go at the contact', async ({
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
  // The ring keeps it sharp in its middle; the contact leaves it behind, and its canvas goes.
  await page.keyboard.press('ArrowDown');
  await expectAnchor(page, RING);
  await expect(page.locator('html')).toHaveAttribute('data-planet', 'live');
  await page.keyboard.press('End');
  await expectAnchor(page, CONTACT);
  await expect(page.locator('html')).not.toHaveAttribute('data-planet', /.*/);
  await expect(page.locator('.planet-canvas')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('the language switch keeps the project the journey has scrolled to', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the arrow keys and the header are the desktop ones');
  await openJourney(page, './#perfmanager');
  await expectAnchor(page, RING);
  const perfmanager = Number(await page.locator('#perfmanager').getAttribute('data-project'));
  await expectFront(page, perfmanager);
  // The address still says #perfmanager: the ring turned on without it.
  await page.keyboard.press('ArrowRight');
  await expectFront(page, perfmanager + 1);
  const slug = await page.locator(`[data-project="${String(perfmanager + 1)}"]`).getAttribute('id');
  await page
    .getByRole('banner')
    .getByRole('link', { name: /English/ })
    .click();
  await expect(page).toHaveURL(new RegExp(`/en/#${String(slug)}$`));
  await expectAnchor(page, RING);
  await expectFront(page, perfmanager + 1);
});

test('?gl=0 keeps the planet as an image', async ({ page }) => {
  await openJourney(page, './?gl=0');
  await page.mouse.move(200, 200);
  await page.waitForTimeout(1500);
  await expect(page.locator('.planet-canvas')).toHaveCount(0);
  await expect(page.locator('.planet-image')).toHaveCSS('background-image', /planet-/);
});

test('the wheel goes anchor by anchor to the contact, and back; sideways, it turns the ring', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'phones have no wheel');
  await openJourney(page);
  await page.mouse.move(720, 450);
  await page.mouse.wheel(0, 120);
  await expectAnchor(page, RING);
  await expectFront(page, 0);
  await page.mouse.wheel(120, 0);
  await expectFront(page, 1);
  await page.mouse.wheel(0, 120);
  await expectAnchor(page, CONTACT);
  await page.mouse.wheel(0, -120);
  await expectAnchor(page, RING);
  await expectFront(page, 1);
});

test('a swipe goes anchor by anchor to the contact, and a short touch stays', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'the swipe is a phone gesture');
  await openJourney(page);
  for (let anchor = 1; anchor <= CONTACT; anchor += 1) {
    await swipe(page, 300);
    await expectAnchor(page, anchor);
  }
  await swipe(page, -300);
  await expectAnchor(page, RING);
  await swipe(page, 20);
  await page.waitForTimeout(800);
  await expectAnchor(page, RING);
});

test('a swipe across the ring turns it to the next or the previous project, the arrows too', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'the swipe is a phone gesture');
  await openJourney(page, './#projets');
  await expectAnchor(page, RING);
  await expectFront(page, 0);
  await swipe(page, 160, true);
  await expectFront(page, 1);
  await swipe(page, -160, true);
  await expectFront(page, 0);
  await swipe(page, -160, true);
  await expectFront(page, 6);
  // Across, the page stays on the ring.
  await page.waitForTimeout(800);
  await expectAnchor(page, RING);
  await page.getByRole('button', { name: 'Projet suivant' }).tap();
  await expectFront(page, 0);
});

test('a swipe across the ring that drifts up or down turns it, the page holding still', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'the swipe is a phone gesture');
  await openJourney(page, './#projets');
  await expectAnchor(page, RING);
  await expectFront(page, 0);
  // Nearly as much up as across: the browser would scroll the page along with the ring.
  expect(await swipe(page, 100, true, 80)).toBe(0);
  await expectFront(page, 1);
  expect(await swipe(page, -100, true, -80)).toBe(0);
  await expectFront(page, 0);
  await page.waitForTimeout(800);
  await expectAnchor(page, RING);
});

test('a flick lands one anchor further, its fling held while the page glides there', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'the swipe is a phone gesture');
  await openJourney(page, './#perfmanager');
  await expectAnchor(page, RING);
  await swipe(page, 400);
  // What is left of the finger's fling would carry the page past the next anchor once the glide is over.
  await expect(page.locator('html')).toHaveCSS('overflow-y', 'hidden');
  await expectAnchor(page, CONTACT);
  await expect(page.locator('html')).not.toHaveCSS('overflow-y', 'hidden');
  await page.waitForTimeout(1500);
  await expectAnchor(page, CONTACT);
});

test('the keys go anchor by anchor to the contact, and to either end; left and right turn the ring', async ({
  page,
}) => {
  await openJourney(page);
  await page.keyboard.press('ArrowDown');
  await expectAnchor(page, RING);
  await page.keyboard.press('ArrowRight');
  await expectFront(page, 1);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expectFront(page, 6);
  await page.keyboard.press('PageDown');
  await expectAnchor(page, CONTACT);
  await page.keyboard.press('ArrowUp');
  await expectAnchor(page, RING);
  await page.keyboard.press('Home');
  await expectAnchor(page, 0);
  await page.keyboard.press('End');
  await expectAnchor(page, CONTACT);
});

test('a project or contact link lands on its anchor', async ({ page }) => {
  await openJourney(page, './#lyrix');
  const lyrix = page.getByRole('listitem').filter({ hasText: 'Lyrix' });
  const index = Number(await lyrix.getAttribute('data-project'));
  await expectAnchor(page, RING);
  await expectFront(page, index);

  await openJourney(page, './#contact');
  await expectAnchor(page, CONTACT);
  await expect(page.getByRole('link', { name: 'gregoire.tinnes@gmail.com' })).toBeVisible();
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
  await expectAnchor(page, RING);
  await expectFront(page, 0);
  await expect(first.locator('.cartel')).toBeVisible();

  // The next card turns the ring to the front.
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-project="1"]').getByRole('link')).toBeFocused();
  await expectFront(page, 1);
  await expectAnchor(page, RING);

  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/projets\/[^/]+\/$/);
});

test('the arrows turn the ring, and count the project in front', async ({ page }) => {
  await openJourney(page, './#projets');
  await expectAnchor(page, RING);
  const next = page.getByRole('button', { name: 'Projet suivant' });
  const previous = page.getByRole('button', { name: 'Projet précédent' });
  const count = page.locator('.showcase-count .now');
  await expect(count).toHaveText('01');
  await next.click();
  await expectFront(page, 1);
  await expect(count).toHaveText('02');
  await previous.click();
  await previous.click();
  await expectFront(page, 6);
  await expect(count).toHaveText('07');
});

test('the card in front shows the cursor under the mouse, and a click opens its case study', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'phones have no mouse');
  await openJourney(page, './#lyrix');
  await expectAnchor(page, RING);
  const lyrix = page.locator('#lyrix');
  await expect(lyrix).toHaveClass(/\blit\b/);
  const box = await lyrix.locator('a.card').boundingBox();
  if (!box) throw new Error('the card has no box');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
  await expect(page.locator('[data-cursor]')).toHaveClass(/\bon\b/);
  await page.mouse.down();
  await page.mouse.up();
  await expect(page).toHaveURL(/\/projets\/lyrix\/$/);
});

test('back from a case study, the arrows keep their styles and still turn the ring', async ({ page, isMobile }) => {
  await openJourney(page, './#lyrix');
  await expectAnchor(page, RING);
  const lyrix = Number(await page.locator('#lyrix').getAttribute('data-project'));
  await expectFront(page, lyrix);
  const card = page.locator('#lyrix a.card');
  if (isMobile) await card.tap();
  else await card.click();
  await expect(page).toHaveURL(/\/projets\/lyrix\/$/);
  // On to the next case study, then back to the projects.
  await page.getByRole('navigation', { name: 'Projet suivant' }).getByRole('link').click();
  await expect(page).not.toHaveURL(/\/projets\/lyrix\/$/);
  await expect(page.locator('[data-case-slug]')).toBeVisible();
  await page.getByRole('link', { name: 'Retour aux projets' }).click();
  await expectAnchor(page, RING);
  const next = page.getByRole('button', { name: 'Projet suivant' });
  // Still laid out at the bottom of the screen, not in the page's flow at its top.
  const box = await next.boundingBox();
  const height = page.viewportSize()?.height ?? 0;
  expect(box?.y ?? 0).toBeGreaterThan(height / 2);
  // Back on the case study it came from, the one after Lyrix; the arrow brings the next one.
  await expectFront(page, (lyrix + 1) % 7);
  await next.click();
  await expectFront(page, (lyrix + 2) % 7);
});

test('a card behind turns to the front at its click, rather than open', async ({ page, isMobile }) => {
  test.skip(isMobile, 'phones turn the ring with a swipe');
  await openJourney(page, './#projets');
  await expectAnchor(page, RING);
  const second = page.locator('[data-project="1"] a.card');
  await second.click({ force: true });
  await expectFront(page, 1);
  await expect(page).not.toHaveURL(/\/projets\/[^/]+\/$/);
});

test('with reduced motion, the home stays a still list', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await expect(page.locator('html')).not.toHaveAttribute('data-journey', 'on');
  await expect(page.locator('.scene-canvas')).toHaveCount(0);
  const shot = async (): Promise<Buffer> => page.screenshot();
  await page.waitForTimeout(3000);
  const before = await shot();
  await page.waitForTimeout(1000);
  // Compared as bytes: a diff of two pictures would take minutes to print.
  expect((await shot()).equals(before)).toBe(true);
});

test('?lite=1 keeps the list, for slow machines', async ({ page }) => {
  await page.goto('./?lite=1');
  await expect(page.locator('html')).not.toHaveAttribute('data-journey', 'on');
  await expect(page.getByRole('list', { name: 'Projets' }).getByRole('listitem')).toHaveCount(7);
});

test('a journey kept under 20 frames per second over the projects gives way to the list, on the project shown', async ({
  page,
}) => {
  test.slow();
  // Frames 70 ms apart, as on a browser drawing without its graphics card; `?lite=auto` measures them, as automated
  // browsers are otherwise left out. The scenes are known slow already, so the planet's own measure keeps out of it.
  await page.addInitScript(() => {
    sessionStorage.setItem('portfolio:slow', 'planet,office');
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => raf(() => setTimeout(() => raf(callback), 54));
  });
  await openJourney(page, './?lite=auto#lyrix');
  for (let i = 0; i < 12 && (await page.locator('html').getAttribute('data-journey')) === 'on'; i += 1) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(1500);
  }
  await expect(page.locator('html')).not.toHaveAttribute('data-journey', 'on', { timeout: 20_000 });
  const shown = await page.evaluate(() => sessionStorage.getItem('portfolio:slow'));
  expect(shown).toContain('lite');
  // The list stands where the journey rested, on a project, not at the top of the page.
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(400);
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
  await page.keyboard.press('ArrowDown');
  await expectAnchor(page, RING);
  for (let project = 1; project < 4; project += 1) {
    await page.keyboard.press('ArrowRight');
    await expectFront(page, project);
  }
  await page.keyboard.press('ArrowDown');
  await expectAnchor(page, CONTACT);
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

test('?mesure=visite goes through a case study and back to the screen, and lists the waits', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('./?mesure=visite');
  const result = page.getByRole('status').filter({ hasText: '"pages"' });
  await expect(result).toBeVisible({ timeout: 220_000 });
  const text = (await result.textContent()) ?? '';
  for (const step of ['ouverture', 'anneau', 'plongée', 'suivant 1', 'suivant 2', 'retour', 'contact'])
    expect(text).toContain(`"${step}"`);
  // Each page of the screen is a step of its own.
  expect(text.match(/"écran [^"]+": \{/g)).toHaveLength(4);
  const report = JSON.parse(text.replace(/^Copier/, '')) as { pages: { to: string }[]; screenPages: unknown[] };
  expect(report.pages.map(({ to }) => to)).toHaveLength(4);
  expect(report.pages.at(-1)?.to).toMatch(/\/$/);
  expect(report.screenPages).toHaveLength(4);
  await expectAnchor(page, CONTACT);
});

test('back from a case study, the live planet and office come back at once, without being prepared again', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'one run is enough: the scenes are kept the same way on phones');
  test.setTimeout(180_000);
  const marks = (name: string): Promise<number> =>
    page.evaluate((mark) => performance.getEntriesByName(mark, 'mark').length, name);
  const linked = (): Promise<number> =>
    page.evaluate(
      () =>
        performance.getEntriesByType('measure').filter((e) => /^(planet|office):(link|shader|compile)/.test(e.name))
          .length,
    );
  await page.goto('./?planete=live&office=live&lite=0#lyrix');
  await expectAnchor(page, RING);
  await expect.poll(() => marks('journey:planet-ready'), { timeout: 120_000 }).toBe(1);
  await expect.poll(() => marks('journey:office-ready'), { timeout: 120_000 }).toBe(1);
  const before = await linked();

  // The page draws in software here: the dive takes its time.
  await page.locator('#lyrix a.card').click({ force: true });
  await expect(page).toHaveURL(/projets\/lyrix\/$/, { timeout: 30_000 });
  await page.getByRole('link', { name: 'Retour aux projets' }).click({ timeout: 30_000 });
  await expectAnchor(page, RING);
  await expect.poll(() => marks('journey:planet-ready'), { timeout: 10_000 }).toBe(2);
  await expect.poll(() => marks('journey:office-ready'), { timeout: 10_000 }).toBe(2);
  // Nothing compiled or linked again.
  expect(await linked()).toBe(before);
  await expect(page.locator('html')).toHaveAttribute('data-office', 'live');
});

test('nothing of the office loads while the opening plays its arrival', async ({ page }) => {
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
  await expect(page.getByRole('link', { name: 'gregoire.tinnes@gmail.com' })).toBeVisible();
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

test('the page keeps room under the contact, for a bar that hides before the journey hears of it', async ({ page }) => {
  await openJourney(page, './?office=layers#contact');
  await expectAnchor(page, CONTACT);
  // Firefox on Android hides its bar while the finger scrolls down, then shows it again at the bottom: the screen
  // grows before the journey resizes the track. The contact must stay within reach meanwhile, or the snapping would
  // send the page back to the last project.
  const room = await page.evaluate(() => {
    const anchors = [...document.querySelectorAll<HTMLElement>('.journey-anchor')];
    const contact = anchors.at(-1)?.offsetTop ?? 0;
    return document.documentElement.scrollHeight - window.innerHeight - contact;
  });
  expect(room).toBeGreaterThanOrEqual(150);
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

test('the arrival waits a few seconds at most for the live office, showing that it loads', async ({ page }) => {
  test.slow();
  const errors = trackErrors(page);
  // Forced live, the office takes far longer than that to get ready without a GPU: the wait runs to its end.
  await openJourney(page, './?office=live&pause=1');
  const home = page.locator('[data-journey-root]');
  await page.keyboard.press('End');
  await expect(home).toHaveAttribute('data-loading', 'arrival', { timeout: 20_000 });
  await expect(page.locator('.loading')).toHaveCSS('opacity', '1');
  const held = Date.now();
  await expect(home).not.toHaveAttribute('data-loading', { timeout: 10_000 });
  expect(Date.now() - held).toBeLessThan(4500);
  // The live office goes on getting ready without a GPU, every frame of the arrival drawn in software: on CI's shared
  // machines, the 3.5 s of the arrival may take far longer.
  await expectAnchor(page, CONTACT, 45_000);
  await expect(page.locator('html')).toHaveAttribute('data-office-arrival', /.+/);
  expect(errors).toEqual([]);
});

test('once the device is found too slow, the visit goes on in the light version', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('portfolio:slow', 'planet,lite');
  });
  await page.goto('./');
  await expect(page.locator('html')).not.toHaveAttribute('data-journey', 'on');
  await expect(page.getByRole('list', { name: 'Projets' }).getByRole('listitem')).toHaveCount(7);
});

test('on a short phone, the text of the card in front stays above the arrows and the loading pill', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'the ring fits a phone');
  await page.setViewportSize({ width: 375, height: 667 });
  await openJourney(page, './#projets');
  await expectAnchor(page, RING);
  const next = page.getByRole('button', { name: 'Projet suivant' });
  for (let project = 0; project < 7; project += 1) {
    await expectFront(page, project);
    // The card in front floats a few px: the room kept is larger.
    const gaps = await page.evaluate(() => {
      const cartel = document.querySelector('.project.lit .cartel')?.getBoundingClientRect();
      const arrows = document.querySelector('.showcase-arrows')?.getBoundingClientRect();
      const pill = document.querySelector('.loading')?.getBoundingClientRect();
      if (!cartel || !arrows || !pill) return null;
      return { arrows: arrows.top - cartel.bottom, pill: pill.top - cartel.bottom };
    });
    expect(gaps).not.toBeNull();
    expect(gaps?.arrows).toBeGreaterThan(0);
    expect(gaps?.pill).toBeGreaterThan(0);
    await next.click();
  }
});

test("on a phone, the front card's text keeps its width, so its lines, as the scroll leaves the ring", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'the cartel is as wide as the card on a phone');
  await openJourney(page, './#projets');
  await expectAnchor(page, RING);
  const widths = new Set<string>();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 700 }] });
  for (let step = 1; step <= 30; step += 1) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: 700 - step * 16 }] });
    await page.waitForTimeout(30);
    const width = await page.evaluate(() => {
      const cartel = document.querySelector<HTMLElement>('.project.lit .cartel');
      return cartel && Number(getComputedStyle(cartel).opacity) > 0.02
        ? cartel.style.getPropertyValue('--cartel-width')
        : '';
    });
    if (width) widths.add(width);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(widths.size).toBe(1);
});

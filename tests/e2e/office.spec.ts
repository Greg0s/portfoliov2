import { expect, test, type Page } from '@playwright/test';
import { trackErrors } from './helpers';

// The office's interactions (plan step 8), over its layers: the same HTML as the live office, without waiting for WebGL.
const OFFICE = './?office=layers#contact';

/** Opens the contact and waits for the camera to rest at the desk, with the office laid out. */
async function openOffice(page: Page, path = OFFICE): Promise<void> {
  await page.goto(path);
  await expect(page.locator('[data-journey-root]')).toHaveAttribute('data-anchor', '8', { timeout: 20_000 });
  await expect(page.locator('html')).toHaveAttribute('data-office', 'live', { timeout: 20_000 });
}

/** The screen's own pictures: the pages' captures (the wallpaper is always there). */
function captures(page: Page): string[] {
  const urls: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('/images/screen/') && !url.includes('wallpaper')) urls.push(url);
  });
  return urls;
}

test.describe('on desktop', () => {
  test.skip(({ isMobile }) => isMobile, 'the screen answers the mouse');

  test('each link opens its page on the screen, and leaving closes it after 0.6 s', async ({ page }) => {
    const errors = trackErrors(page);
    const requested = captures(page);
    await openOffice(page);
    const desktop = page.locator('.office-screen .desktop');
    expect(requested).toEqual([]);

    for (const [name, tab] of [
      ['LinkedIn', 'LinkedIn'],
      ['GitHub', 'GitHub'],
      ['Instagram', 'Instagram'],
    ] as const) {
      await page.locator(`a[data-screen-page="${name}"]`).hover();
      await expect(desktop).toHaveAttribute('data-open', 'firefox');
      await expect(desktop.locator('.tab[data-active]')).toHaveAttribute('data-tab', tab);
      await expect(desktop.locator(`.page[data-page="${tab}"] img`).first()).toHaveJSProperty('complete', true);
    }
    expect(requested.length).toBeGreaterThan(0);

    // The email opens the mail app instead.
    await page.locator('.email > a').hover();
    await expect(desktop).toHaveAttribute('data-open', 'mail');

    // Away from the links, the window stays 0.6 s, then shrinks back. Timed in the page, from the pointer leaving the
    // link to the window closing: a busy runner delays the test's own steps, never the page's clock.
    await desktop.evaluate((node) => {
      const closed = new Promise<number>((resolve) => {
        let left = 0;
        document.querySelector('.email > a')?.addEventListener(
          'pointerout',
          () => {
            left = performance.now();
          },
          { once: true },
        );
        new MutationObserver((_, observer) => {
          if (node.getAttribute('data-open') !== '') return;
          observer.disconnect();
          resolve(performance.now() - left);
        }).observe(node, { attributeFilter: ['data-open'] });
      });
      Object.assign(window, { windowClosed: closed });
    });
    await page.mouse.move(700, 860);
    const stayed = await page.evaluate(() => (window as unknown as { windowClosed: Promise<number> }).windowClosed);
    expect(stayed).toBeGreaterThanOrEqual(590);
    expect(stayed).toBeLessThan(2000);
    await expect(desktop).toHaveAttribute('data-open', '');
    expect(errors).toEqual([]);
  });

  test('emptying the Recycle Bin goes dark, draws again, then owns up that nothing happened', async ({ page }) => {
    await openOffice(page);
    // Clicks dispatched rather than made with the mouse: the head follows the mouse and drifts toward each click by a
    // fraction of a pixel per frame, which Playwright's wait for a still target takes for motion.
    const desktop = page.locator('.office-screen .desktop');
    await expect(desktop).toHaveAttribute('data-bin-live', '');
    await desktop.locator('[data-bin]').dispatchEvent('click');
    await expect(desktop).toHaveAttribute('data-dialog-open', 'ask');

    // "Non" closes it.
    await desktop.locator('[data-dialog="ask"] .button[data-answer="no"]').dispatchEvent('click');
    await expect(desktop).toHaveAttribute('data-dialog-open', '');

    await desktop.locator('[data-bin]').dispatchEvent('click');
    // The darkest the veil gets, sampled at every frame: with the pictures in the cache, the dark lasts a frame or two.
    await page.evaluate(() => {
      const record = window as unknown as { darkest: number };
      record.darkest = 0;
      const veilNode = document.querySelector('[data-veil]');
      const sample = (): void => {
        if (veilNode) record.darkest = Math.max(record.darkest, Number(getComputedStyle(veilNode).opacity));
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await desktop.locator('[data-dialog="ask"] [data-answer="yes"]').dispatchEvent('click');
    const veil = page.locator('[data-veil]');
    await expect(desktop).toHaveAttribute('data-dialog-open', 'done', { timeout: 10_000 });
    expect(await page.evaluate(() => (window as unknown as { darkest: number }).darkest)).toBeGreaterThan(0.5);
    await expect.poll(() => veil.evaluate((node) => Number(getComputedStyle(node).opacity))).toBe(0);
    // While the message is open, the Recycle Bin waits.
    await expect(desktop).not.toHaveAttribute('data-bin-live');
    await desktop.locator('[data-dialog="done"] .button[data-answer="ok"]').dispatchEvent('click');
    await expect(desktop).toHaveAttribute('data-bin-live', '');
  });

  test('hovering a picture shows its cartel, and the landscape photo behind the text has none', async ({ page }) => {
    // Each frame draws one of its pictures at random: the middle one of each pool, Project Hail Mary for the poster.
    await page.addInitScript(() => {
      Math.random = () => 0.5;
    });
    await openOffice(page);
    const cartels = page.locator('.office-cartel');
    // The six frames of the wall but the landscape photo, and the small frame of the desk.
    await expect(cartels).toHaveCount(6);
    const poster = cartels.filter({ hasText: 'Projet Dernière Chance' });
    await expect(poster).toHaveCSS('opacity', '0');
    const hit = poster.locator('xpath=preceding-sibling::div[contains(@class, "office-cartel-hit")][1]');
    const box = await hit.boundingBox();
    if (!box) throw new Error('no hit area for the poster');
    await page.mouse.move(box.x + 20, box.y + box.height - 20);
    await expect(poster).toHaveAttribute('data-open', '');
    // Neither the frame's type nor, on the French site, the original title.
    await expect(poster).not.toContainText('Affiche de film');
    await expect(poster).not.toContainText('Project Hail Mary');
    await page.mouse.move(700, 860);
    await expect(poster).not.toHaveAttribute('data-open');
  });

  test('the copy icon turns into a check for 1.8 s', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'the clipboard permission is a Chromium one');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openOffice(page);
    const button = page.getByRole('button', { name: 'Copier l’adresse' });
    await button.click();
    await expect(button).toHaveAttribute('data-copied', '');
    await page.waitForTimeout(1200);
    await expect(button).toHaveAttribute('data-copied', '');
    await expect(button).not.toHaveAttribute('data-copied', { timeout: 2000 });
  });
});

test.describe('on phones', () => {
  test.skip(({ isMobile }) => !isMobile, 'the bubble is the phones’ way');

  test('a tap on the address opens the bubble, and "Copier" says "Copié", then closes it', async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'the clipboard permission is a Chromium one');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const requested = captures(page);
    await openOffice(page);
    const email = page.locator('[data-email]').first();
    await email.locator(':scope > a').tap();
    await expect(email).toHaveAttribute('data-bubble-open', '');
    await expect(page.getByRole('link', { name: 'Envoyer un mail' })).toBeVisible();
    await page.getByRole('button', { name: 'Copier', exact: true }).tap();
    await expect(page.getByRole('button', { name: 'Copié', exact: true })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('contact@gregoiretinn.es');
    await expect(email).not.toHaveAttribute('data-bubble-open', { timeout: 2000 });

    // A tap elsewhere closes it too.
    await email.locator(':scope > a').tap();
    await expect(email).toHaveAttribute('data-bubble-open', '');
    const section = await page.locator('.contact').boundingBox();
    await page.locator('.contact').tap({ position: { x: 24, y: (section?.height ?? 600) - 80 } });
    await expect(email).not.toHaveAttribute('data-bubble-open');

    // The links open directly, and no capture of the screen loads.
    await expect(page.locator('a[data-screen-page="LinkedIn"]')).toHaveAttribute('href', /linkedin\.com/);
    await expect(page.locator('.office-screen .desktop')).not.toHaveAttribute('data-bin-live');
    expect(requested).toEqual([]);
  });
});

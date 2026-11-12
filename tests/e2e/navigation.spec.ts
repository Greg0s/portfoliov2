import { expect, test, type Page } from '@playwright/test';

/** Opens the language switch of the current layout and follows the other language. */
async function switchLanguage(page: Page, isMobile: boolean, name: RegExp): Promise<void> {
  if (isMobile) {
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('dialog').getByRole('link', { name }).click();
  } else {
    await page.getByRole('banner').getByRole('link', { name }).click();
  }
}

test('the language switch leads to the equivalent page and keeps the anchor', async ({ page, isMobile, baseURL }) => {
  await page.goto('./#contact');
  await switchLanguage(page, isMobile, /English/);
  await expect(page).toHaveURL(new URL('en/#contact', baseURL).href);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.goto('en/#projects');
  await switchLanguage(page, isMobile, /Français/);
  await expect(page).toHaveURL(new URL('./#projets', baseURL).href);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
});

test.describe('desktop header', () => {
  test.skip(({ isMobile }) => isMobile, 'the header links are in the menu on mobile');

  test('goes to its anchors through the night', async ({ page }) => {
    await page.goto('./');
    const header = page.getByRole('banner');
    await header.getByRole('link', { name: 'Contact' }).click();
    // Each anchor is a section taller than the screen: the cut lands on its top.
    const atTop = async (id: string): Promise<void> => {
      await expect
        .poll(async () => page.locator(id).evaluate((node) => Math.round(node.getBoundingClientRect().top)))
        .toBeLessThanOrEqual(1);
    };

    await expect(page).toHaveURL(/#contact$/);
    await atTop('#contact');
    await expect(page.locator('[data-veil]')).toHaveCSS('opacity', '0');

    await header.getByRole('link', { name: 'Projets' }).click();
    await expect(page).toHaveURL(/#projets$/);
    await atTop('#projets');

    await header.getByRole('link', { name: 'Grégoire Tinnes' }).click();
    await expect(page).toHaveURL(/#accueil$/);
    await atTop('#accueil');
  });

  test('lights the current section and dims the other links', async ({ page }) => {
    const header = page.getByRole('banner');
    const name = header.getByRole('link', { name: 'Grégoire Tinnes' });
    const projects = header.getByRole('link', { name: 'Projets' });
    const contact = header.getByRole('link', { name: 'Contact' });

    await page.goto('./');
    await expect(name).toHaveAttribute('aria-current', 'location');
    await expect(projects).not.toHaveAttribute('aria-current');

    await page.goto('./#lyrix');
    await expect(projects).toHaveAttribute('aria-current', 'location');
    await expect(name).not.toHaveAttribute('aria-current');
    await expect(projects).not.toHaveCSS('text-shadow', 'none');
    await expect(contact).toHaveCSS('color', 'rgba(243, 243, 241, 0.68)');

    await page.goto('./#contact');
    await expect(contact).toHaveAttribute('aria-current', 'location');
    await expect(projects).not.toHaveAttribute('aria-current');
  });

  test('hides the menu button', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByRole('button', { name: 'Menu' })).toBeHidden();
  });
});

test.describe('mobile menu', () => {
  test.skip(({ isMobile }) => !isMobile, 'the menu only exists on small screens');

  test('shows no current section in the header', async ({ page }) => {
    await page.goto('./#lyrix');
    const name = page.getByRole('banner').getByRole('link', { name: 'Grégoire Tinnes' });
    await expect(page.locator('[data-site-header]')).toHaveAttribute('data-section', 'projects');
    await expect(name).toHaveCSS('text-shadow', 'none');
    await expect(name).toHaveCSS('color', 'rgb(243, 243, 241)');
  });

  test('opens and closes with the keyboard and gives the focus back', async ({ page }) => {
    await page.goto('./');
    const button = page.getByRole('button', { name: 'Menu' });
    await button.focus();
    await page.keyboard.press('Enter');
    const menu = page.getByRole('dialog', { name: 'Menu' });
    await expect(menu).toBeVisible();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(menu).toHaveAttribute('data-state', 'in');

    // The focus stays inside the menu.
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press('Tab');
      expect(await menu.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(button).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(menu).toBeVisible();
    await menu.getByRole('button', { name: 'Fermer' }).click();
    await expect(menu).toBeHidden();
    await expect(button).toBeFocused();
  });

  test('a link closes the menu in the dark and lands on its anchor', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('dialog').getByRole('link', { name: 'Contact' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page).toHaveURL(/#contact$/);
    await expect(page.locator('#contact')).toBeInViewport({ ratio: 0.9 });
    await expect(page.locator('[data-veil]')).toHaveCSS('opacity', '0');
  });
});

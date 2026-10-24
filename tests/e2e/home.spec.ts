import { expect, test } from '@playwright/test';
import { trackErrors } from './helpers';

const homes = [
  { lang: 'fr', path: './', dir: 'projets', projects: 'Projets', first: 'La Fabrique des Mondes' },
  { lang: 'en', path: 'en/', dir: 'en/projects', projects: 'Projects', first: 'La Fabrique des Mondes' },
] as const;

for (const { lang, path, dir, projects, first } of homes) {
  test(`the ${lang} home shows the opening, the 8 projects and the contact`, async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: 'Grégoire Tinnes' })).toBeVisible();
    await expect(page.getByRole('img', { name: /planet|planète/i })).toBeVisible();

    const cards = page.getByRole('list', { name: projects });
    await expect(cards.getByRole('listitem')).toHaveCount(8);
    const card = page.getByRole('listitem').filter({ hasText: first }).first();
    await expect(card.getByRole('link')).toHaveAttribute('href', new RegExp(`/${dir}/la-fabrique-des-mondes/$`));
    await expect(card.getByRole('heading', { level: 3, name: first })).toBeVisible();

    await expect(page.getByRole('heading', { level: 2, name: projects })).toBeAttached();
    await expect(page.getByRole('link', { name: 'contact@gregoiretinn.es' })).toHaveAttribute(
      'href',
      'mailto:contact@gregoiretinn.es',
    );
    expect(errors).toEqual([]);
  });
}

test('the copy button copies the address and says so', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'the clipboard permission is a Chromium one');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  // The contact ends the journey: the anchor leads there.
  await page.goto('./#contact');
  const button = page.getByRole('button', { name: 'Copier l’adresse' });
  await button.click();
  await expect(page.getByText('Adresse copiée')).toBeAttached();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('contact@gregoiretinn.es');
});

test('a card leads to its case study, and the back link returns to it', async ({ page }) => {
  // Frozen time: the card in focus stops floating, so that the click can wait for it to be still.
  await page.goto('./?still=1#lyrix');
  const card = page.getByRole('listitem').filter({ hasText: 'Lyrix' }).getByRole('link');
  await card.click();
  await expect(page).toHaveURL(/\/projets\/lyrix\/$/);
  await page.getByRole('link', { name: 'Retour aux projets' }).click();
  await expect(page).toHaveURL(/\/portfoliov2\/#lyrix$/);
  await expect(page.locator('#lyrix')).toBeInViewport();
});

test('an old URL leads to its case study', async ({ page }) => {
  await page.goto('obaine.html');
  await expect(page).toHaveURL(/\/projets\/obaine\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Obaine' })).toBeVisible();
});

test('every internal link of the site answers', async ({ page, request, baseURL }) => {
  const seen = new Set<string>();
  const queue = ['./', 'en/'];
  const root = new URL(baseURL ?? '');
  while (queue.length > 0) {
    const path = queue.shift() ?? '';
    const response = await page.goto(path);
    expect(response?.status(), `${path} answers`).toBe(200);
    const hrefs = await page
      .locator('a[href]')
      .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href));
    for (const href of hrefs) {
      const url = new URL(href);
      if (url.origin !== root.origin || seen.has(url.pathname)) continue;
      seen.add(url.pathname);
      const head = await request.get(url.href);
      expect(head.status(), `${url.pathname} answers`).toBe(200);
      if (!queue.includes(url.href) && url.pathname.includes('/projets/')) queue.push(url.href);
    }
  }
  expect(seen.size).toBeGreaterThan(8);
});

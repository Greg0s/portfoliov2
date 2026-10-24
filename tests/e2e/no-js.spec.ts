import { expect, test } from '@playwright/test';

// The whole home must read without JavaScript (main spec §7.5).
test.use({ javaScriptEnabled: false });

test('the home is complete and usable without JavaScript', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1, name: 'Grégoire Tinnes' })).toBeVisible();
  await expect(page.getByRole('img', { name: /planète/i })).toBeVisible();

  await expect(page.getByRole('list', { name: 'Projets' }).getByRole('listitem')).toHaveCount(8);
  for (const title of ['La Fabrique des Mondes', 'Lyrix', 'Obaine']) {
    await expect(page.getByRole('heading', { level: 3, name: title })).toBeVisible();
  }

  await expect(page.getByRole('link', { name: 'contact@gregoiretinn.es' })).toBeVisible();
  // The copy button needs JavaScript: it stays hidden rather than doing nothing.
  await expect(page.getByRole('button', { name: 'Copier l’adresse' })).toBeHidden();

  // The office still shows: both moments are in the page, one of them displayed.
  await expect(page.locator('.office picture').first()).toBeAttached();

  // Nothing in the page is hidden by an animation's starting state (the closed menu is not part of it).
  const hidden = await page.locator('main h1, main h2, main h3, main p, main a').evaluateAll(
    (nodes) =>
      nodes.filter((node) => {
        const style = getComputedStyle(node);
        return style.opacity === '0' || style.visibility === 'hidden';
      }).length,
  );
  expect(hidden).toBe(0);
});

test('a case study reads without JavaScript', async ({ page }) => {
  await page.goto('projets/sncf-wrapped/');
  await expect(page.getByRole('heading', { level: 1, name: 'SNCF Wrapped' })).toBeVisible();
  await expect(page.locator('.challenge')).toHaveCount(2);
  await expect(page.getByRole('link', { name: 'Retour aux projets' })).toBeVisible();
});

import { expect, test } from '@playwright/test';
import { trackErrors } from './helpers';

const slugs = [
  'la-fabrique-des-mondes',
  'what-we-play',
  'litterature-combinatoire',
  'sncf-wrapped',
  'recoding',
  'lyrix',
  'le-petit-prince',
  'obaine',
];

const languages = [
  { lang: 'fr', dir: 'projets', back: 'Retour aux projets', next: 'Projet suivant', number: 'Projet', other: 'en' },
  { lang: 'en', dir: 'en/projects', back: 'Back to projects', next: 'Next project', number: 'Project', other: 'fr' },
] as const;

for (const { lang, dir, back, next, number } of languages) {
  test(`the 8 ${lang} case studies answer, numbered in order, each leading to the next`, async ({ page }) => {
    const errors = trackErrors(page);
    for (const [index, slug] of slugs.entries()) {
      const response = await page.goto(`${dir}/${slug}/`);
      expect(response?.status()).toBe(200);
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const n = String(index + 1).padStart(2, '0');
      await expect(page.getByText(`${n} / 08`)).toBeVisible();
      await expect(page.getByText(`${number} ${String(index + 1)}`)).toBeAttached();
      await expect(page.getByRole('link', { name: back })).toHaveAttribute('href', new RegExp(`#${slug}$`));
      await expect(page.locator('.challenge').first()).toBeVisible();
      const following = slugs[(index + 1) % slugs.length] ?? '';
      await expect(page.getByRole('navigation', { name: next }).getByRole('link')).toHaveAttribute(
        'href',
        new RegExp(`/${dir}/${following}/$`),
      );
    }
    expect(errors).toEqual([]);
  });
}

test('the last case study leads back to the first', async ({ page }) => {
  await page.goto('projets/obaine/');
  await page.getByRole('navigation', { name: 'Projet suivant' }).getByRole('link').click();
  await expect(page).toHaveURL(/\/projets\/la-fabrique-des-mondes\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'La Fabrique des Mondes' })).toBeVisible();
  await expect(page.getByText('01 / 08')).toBeVisible();
});

test('a case study declares its alternates and switches language on the same project', async ({ page }) => {
  await page.goto('projets/lyrix/');
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
    'href',
    /\/portfoliov2\/en\/projects\/lyrix\/$/,
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /paroles cachées/);
  await page.getByRole('link', { name: /^EN/ }).first().click();
  await expect(page).toHaveURL(/\/en\/projects\/lyrix\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('the Contact link of a case study leads to the contact through the night', async ({ page }) => {
  await page.goto('projets/lyrix/');
  await page.getByRole('contentinfo').getByRole('link', { name: 'Contact' }).click();
  await expect(page).toHaveURL(/\/portfoliov2\/#contact$/);
  await expect(page.locator('#contact')).toBeInViewport();
  await expect(page.locator('[data-veil]')).toHaveCSS('opacity', '0');
});

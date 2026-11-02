import { expect, test } from '@playwright/test';
import { trackErrors } from './helpers';

const slugs = ['lyrix', 'siemens', 'what-we-play', 'perfmanager', 'obaine', 'litterature-combinatoire', 'sncf-wrapped'];

const languages = [
  { lang: 'fr', dir: 'projets', back: 'Retour aux projets', next: 'Projet suivant', number: 'Projet', other: 'en' },
  { lang: 'en', dir: 'en/projects', back: 'Back to projects', next: 'Next project', number: 'Project', other: 'fr' },
] as const;

for (const { lang, dir, back, next, number } of languages) {
  test(`the 7 ${lang} case studies answer, numbered in order, each leading to the next`, async ({ page, isMobile }) => {
    const errors = trackErrors(page);
    for (const [index, slug] of slugs.entries()) {
      const response = await page.goto(`${dir}/${slug}/`);
      expect(response?.status()).toBe(200);
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const n = String(index + 1).padStart(2, '0');
      // A touch screen shows the projects' dots instead of the number: the case studies to swipe through.
      if (isMobile) await expect(page.locator('.dots > span').nth(index)).toHaveClass(/current/);
      else await expect(page.getByText(`${n} / 07`)).toBeVisible();
      await expect(page.getByText(`${number} ${String(index + 1)}`)).toBeAttached();
      await expect(page.getByRole('link', { name: back })).toHaveAttribute('href', new RegExp(`#${slug}$`));
      // Results, context, what was done and the challenges, each in a form of its own.
      await expect(page.locator('.case-main > section')).toHaveCount(4);
      await expect(page.locator('.stats, .outcomes').first()).toBeVisible();
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
  await page.goto('projets/sncf-wrapped/');
  await page.getByRole('navigation', { name: 'Projet suivant' }).getByRole('link').click();
  await expect(page).toHaveURL(/\/projets\/lyrix\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Lyrix' })).toBeVisible();
  await expect(page.getByText('Projet 1 sur 7')).toBeAttached();
});

test('a case study leads to its live site, from its facts and, for some, from a band at the end', async ({ page }) => {
  await page.goto('projets/lyrix/');
  const facts = page.getByRole('complementary');
  await expect(facts.getByRole('link', { name: /Jouer à Lyrix/ })).toHaveAttribute(
    'href',
    'https://lyrix.mintymoon.app/',
  );
  await expect(facts.getByText('Stack', { exact: true })).toBeVisible();
  await expect(page.getByText('Lyrix est en ligne.')).toBeVisible();

  // Perfmanager has a site, but no band.
  await page.goto('projets/perfmanager/');
  await expect(page.getByRole('complementary').getByRole('link', { name: /Voir le site/ })).toBeVisible();
  await expect(page.getByText('Perfmanager est en ligne.')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 2, name: 'Ce que je fais' })).toBeVisible();

  // Siemens has no link at all.
  await page.goto('en/projects/siemens/');
  await expect(page.getByRole('complementary').getByRole('link')).toHaveCount(0);
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

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
  await expect(facts.getByRole('link', { name: /Voir le projet/ })).toHaveAttribute(
    'href',
    'https://lyrix.mintymoon.app/',
  );
  await expect(facts.getByText('Stack', { exact: true })).toBeVisible();
  await expect(page.getByText('Lyrix est en ligne.')).toBeVisible();

  // Perfmanager has no main link, so no button: only its company's site, as a plain link, and no band.
  await page.goto('projets/perfmanager/');
  const perfmanager = page.getByRole('complementary').getByRole('link');
  await expect(perfmanager).toHaveCount(1);
  await expect(perfmanager).toHaveText(/Site de l’entreprise/);
  await expect(perfmanager).toHaveAttribute('href', 'https://www.perfmanager.com/');
  await expect(page.getByRole('complementary').locator('.button')).toHaveCount(0);
  await expect(page.getByText('Perfmanager est en ligne.')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 2, name: 'Ce que je fais' })).toBeVisible();

  // Siemens has no main link: its recommendation letter, in the page's language, and an article, as plain links.
  await page.goto('en/projects/siemens/');
  const siemens = page.getByRole('complementary').getByRole('link');
  await expect(siemens).toHaveCount(2);
  await expect(siemens.first()).toHaveText(/Recommendation/);
  await expect(siemens.first()).toHaveAttribute('href', /\/letters\/siemens-en\.pdf$/);
  await expect(siemens.last()).toHaveText(/Article/);
  await expect(page.getByRole('complementary').locator('.button')).toHaveCount(0);
  expect((await page.request.get('letters/siemens-en.pdf')).headers()['content-type']).toBe('application/pdf');
});

test("a case study takes its project's colours: its two on the main buttons, their middle as its accent", async ({
  page,
  isMobile,
}) => {
  await page.goto('projets/lyrix/');
  const gradient = 'linear-gradient(90deg, rgb(236, 106, 44), rgb(242, 132, 63))';
  for (const selector of ['.facts .button', '.band-button']) {
    await expect(page.locator(selector)).toHaveCSS('background-image', gradient);
  }
  // The project's accent rather than the site's turquoise, in the page and in its header.
  const accent = 'rgb(239, 119, 54)';
  await expect(page.locator('.intro .tag')).toHaveCSS('color', accent);
  await expect(page.locator('.facts dt').first()).toHaveCSS('color', accent);
  await expect(page.locator(isMobile ? '.case-header .dots .current' : '.case-header .number .now')).toHaveCSS(
    isMobile ? 'background-color' : 'color',
    accent,
  );
  // The lede, the sections' titles and the title keep the night's greys and white.
  await expect(page.locator('.lede')).toHaveCSS('color', 'rgb(143, 143, 139)');
  await expect(page.locator('#case-results')).toHaveCSS('color', 'rgb(143, 143, 139)');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('color', 'rgb(243, 243, 241)');
});

test('a case study declares its alternates and switches language on the same project', async ({ page }) => {
  await page.goto('projets/lyrix/');
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
    'href',
    /\/en\/projects\/lyrix\/$/,
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /paroles cachées/);
  await page.getByRole('link', { name: /^EN/ }).first().click();
  await expect(page).toHaveURL(/\/en\/projects\/lyrix\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('a case study ends on the next project, with no Contact link at the bottom', async ({ page }, testInfo) => {
  await page.goto('projets/lyrix/');
  await expect(page.locator('.case-footer').getByRole('link', { name: 'Contact' })).toHaveCount(0);
  // On a computer the footer is gone; on a phone it only holds the languages.
  if (testInfo.project.name === 'mobile') await expect(page.locator('.case-footer')).toBeVisible();
  else await expect(page.locator('.case-footer')).toBeHidden();
});

test('a figure with a note explains it in a tooltip, by tap, keyboard and Escape', async ({ page, isMobile }) => {
  const errors = trackErrors(page);
  await page.goto('projets/perfmanager/');
  await expect(page.locator('.stats dt').nth(2)).toHaveText('−25%');
  const button = page.getByRole('button', { name: 'Comment ce chiffre est mesuré' });
  const tip = page.locator('[role="tooltip"]');
  await expect(button).toHaveAttribute('aria-describedby', (await tip.getAttribute('id')) ?? '');
  await expect(tip).toContainText('Sur une période de 4 mois, de juillet à octobre');
  await expect(tip).toBeHidden();
  if (isMobile) await button.tap();
  else await button.click();
  await expect(tip).toBeVisible();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  // A tap elsewhere closes it.
  await page.locator('.results h2').click();
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  if (!isMobile) {
    await page.mouse.move(0, 0);
    await button.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(tip).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(tip).toBeHidden();
    await expect(button).toBeFocused();
  }
  expect(errors).toEqual([]);
});

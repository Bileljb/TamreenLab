import { expect, test } from '@playwright/test';

// Languages (ADR 009): browser-language detection, the switcher, translated lessons scored by the
// API in the learner's language, the French formula note, and the theme toggle.
test.skip(({ isMobile }) => isMobile, 'one viewport covers these flows');

const SUMIF = '/lessons/conditional/sumif-basics';

test('/ follows the browser language and falls back to Arabic', async ({ playwright }) => {
  for (const [header, expected] of [
    ['en-GB,en;q=0.9', '/en'],
    ['fr-FR,fr;q=0.9', '/fr'],
    ['de-DE,de;q=0.9', '/ar'],
    ['ar-SA,ar;q=0.9', '/ar'],
  ]) {
    const request = await playwright.request.newContext({
      baseURL: 'http://localhost:3000',
      extraHTTPHeaders: { 'accept-language': header! },
    });
    const res = await request.get('/', { maxRedirects: 0 });
    expect([307, 308], header).toContain(res.status());
    expect(new URL(res.headers().location!, 'http://x').pathname, header).toBe(expected);
    await request.dispose();
  }
});

test('the switcher keeps the page, sets the direction and is remembered', async ({ page }) => {
  await page.goto(`/ar${SUMIF}`);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.getByRole('banner').getByRole('link', { name: 'English' }).click();
  await expect(page).toHaveURL(new RegExp(`/en${SUMIF}$`));
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Adding up with a condition: SUMIF');
  // The choice is remembered: the bare origin now opens English.
  await page.goto('/');
  await expect(page).toHaveURL(/\/en$/);
});

test('an English SUMIF step is checked and scored in English', async ({ page }) => {
  const email = `e2e-en-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  await page.goto(`/en/register?next=${encodeURIComponent(`/en${SUMIF}`)}`);
  await page.getByLabel('Display name').fill('English learner');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('correct horse');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(new RegExp(`/en${SUMIF}$`));

  // The sheet is translated, so the criterion is "North".
  await expect(page.locator('[data-address="B2"]')).toHaveText('North');
  await page.locator('[data-address="F2"]').click();
  await page.keyboard.type('=SUMIF(B2:B7,"North",C2:C7)');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status').first()).toHaveText(/Correct! \+\d+ points/);
  await expect
    .poll(async () => Number(await page.getByTestId('stat-pointsTotal').textContent()))
    .toBeGreaterThan(0);
});

test('French pages explain the French Excel names', async ({ page }) => {
  await page.goto(`/fr${SUMIF}`);
  const note = page.locator('[data-french-note]');
  await expect(note).toContainText('SUMIF = SOMME.SI');
  await page.goto('/fr/functions/vlookup');
  await expect(page.locator('[data-french-note]')).toContainText('VLOOKUP = RECHERCHEV');
  await page.goto(`/en${SUMIF}`);
  await expect(page.locator('[data-french-note]')).toHaveCount(0);
});

test('the theme toggle switches to dark and remembers it without a flash', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/en');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'light');
  const toggle = page.getByRole('button', { name: /^Theme:/ });
  await toggle.click(); // system → light
  await toggle.click(); // light → dark
  await expect(html).toHaveAttribute('data-theme', 'dark');
  // The head script applies the stored theme before the page paints.
  await page.goto('/en/lessons');
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
});

test('the home page sheet evaluates a typed formula', async ({ page }) => {
  await page.goto('/en');
  const bar = page.getByRole('textbox', { name: 'Formula bar of the try-it sheet' });
  await bar.click();
  await bar.fill('=MAX(B2:B4)');
  await bar.press('Enter');
  await expect(page.locator('table').first()).toContainText('140');
  await page.getByRole('button', { name: '=AVERAGE(B2:B4)' }).click();
  await expect(page.locator('table').first().locator('tr').nth(5)).toContainText('98.33');
});

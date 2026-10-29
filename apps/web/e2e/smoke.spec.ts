import { expect, test } from '@playwright/test';

test('root redirects to the Arabic locale', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/ar$/);
});

test('home page renders right to left with left-to-right formulas', async ({ page }) => {
  await page.goto('/ar');

  const html = page.locator('html');
  await expect(html).toHaveAttribute('lang', 'ar');
  await expect(html).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('تعلّم إكسل بالتطبيق العملي');

  const formula = page.locator('[data-formula]', { hasText: '=SUMIF' });
  await expect(formula).toHaveText('=SUMIF(A2:A8,"قلم",B2:B8)');
  await expect(formula).toHaveAttribute('dir', 'ltr');
  expect(await formula.evaluate((el) => getComputedStyle(el).direction)).toBe('ltr');

  const body = page.locator('main');
  expect(await body.evaluate((el) => getComputedStyle(el).direction)).toBe('rtl');
});

test('no horizontal scroll', async ({ page }) => {
  await page.goto('/ar');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

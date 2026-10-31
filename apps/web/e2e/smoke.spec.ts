import { expect, test } from '@playwright/test';

test.describe('an Arabic browser', () => {
  test.use({ locale: 'ar-SA' });

  test('root redirects to the Arabic locale', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/ar$/);
  });
});

test('home page renders right to left with left-to-right formulas', async ({ page }) => {
  await page.goto('/ar');

  const html = page.locator('html');
  await expect(html).toHaveAttribute('lang', 'ar');
  await expect(html).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('تعلّم إكسل بالتطبيق العملي');

  // The try-it sheet is a spreadsheet: its formula bar and grid stay left to right.
  const bar = page.getByRole('textbox', { name: 'شريط المعادلة في الورقة التجريبية' });
  await expect(bar).toHaveValue(/^=SUM\(B2:B4/);
  expect(await bar.evaluate((el) => getComputedStyle(el).direction)).toBe('ltr');

  const body = page.locator('main');
  expect(await body.evaluate((el) => getComputedStyle(el).direction)).toBe('rtl');
});

test('no horizontal scroll', async ({ page }) => {
  for (const path of ['/ar', '/en', '/fr/lessons']) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

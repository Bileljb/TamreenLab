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

test('pages send security headers, and nothing breaks the content security policy', async ({
  page,
}) => {
  const violations: string[] = [];
  page.on('console', (msg) => {
    if (/Content.Security.Policy|Refused to/i.test(msg.text())) violations.push(msg.text());
  });
  const res = await page.goto('/ar/lessons/aggregation/sum-basics');
  const headers = res!.headers();
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['x-content-type-options']).toBe('nosniff');

  // Play a step, so the player's scripts, styles and API calls all run under the policy.
  await page.locator('[data-address="B7"]').click();
  await page.keyboard.type('=B2+B3+B4+B5+B6');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-feedback="correct"]')).toBeVisible();
  for (const path of ['/en', '/fr/functions/vlookup']) await page.goto(path);
  expect(violations).toEqual([]);
});

test('unknown top-level paths are a 404, not a server error', async ({ request }) => {
  expect((await request.get('/favicon.ico')).status()).toBe(404);
  expect((await request.get('/xx')).status()).toBe(404);
  expect((await request.get('/icon.svg')).status()).toBe(200);
});

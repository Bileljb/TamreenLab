import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// PLAN Phase 9 accessibility pass (ADR 013): WCAG 2.1 A and AA rules on the main page types, in
// all three languages, and on the lesson player in the states a learner sees most.
// Fade-ins are measured at their final colours, not half-way through (the site honours reduced motion).
test.use({ reducedMotion: 'reduce' });

const PAGES = [
  '/ar',
  '/ar/lessons',
  '/ar/lessons/aggregation/sum-basics',
  '/ar/functions/vlookup',
  '/ar/shortcuts',
  '/ar/login',
  '/ar/register',
  '/ar/forgot-password',
  '/ar/privacy',
  '/en/lessons/conditional/sumif-basics',
  '/fr/lessons/basics/cells-and-selection',
];

async function violations(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return result.violations.map(
    (v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
}

for (const path of PAGES) {
  test(`no WCAG A/AA violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    expect(await violations(page)).toEqual([]);
  });
}

test.describe('dark theme', () => {
  test.use({ colorScheme: 'dark' });
  for (const path of ['/ar', '/ar/lessons/aggregation/sum-basics', '/en/login']) {
    test(`no WCAG A/AA violations on ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await page.waitForLoadState('networkidle');
      expect(await violations(page)).toEqual([]);
    });
  }
});

test('no violations in the player after a wrong answer, a hint and a reveal', async ({ page }) => {
  await page.goto('/ar/lessons/aggregation/sum-basics');
  await page.locator('[data-address="B7"]').click();
  await page.keyboard.type('=1');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-feedback="incorrect"]')).toBeVisible();
  await page.getByRole('button', { name: 'تلميح' }).click();
  expect(await violations(page)).toEqual([]);
  await page.getByRole('button', { name: 'اعرض الإجابة' }).click();
  await expect(page.locator('[data-feedback="revealed"]')).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test('the first Tab offers a skip link that moves focus past the header', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'keyboard');
  await page.goto('/ar/lessons');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'انتقل إلى المحتوى' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('#content')).toBeFocused();
});

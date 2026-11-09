import { createHmac } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

// Phase 7 acceptance: the returning-learner flow, the unsubscribe link, and no email without
// opt-in. Needs the API and Postgres with the curriculum synced (see playwright.config.ts).
const LESSON = '/ar/lessons/basics/cells-and-selection';
const feedback = (page: Page) => page.getByRole('status').first();
const cell = (page: Page, address: string) => page.locator(`[data-address="${address}"]`);

// The API signs unsubscribe links with JWT_SECRET; locally and in CI that is the development one.
const SECRET = process.env.JWT_SECRET ?? 'dev-only-secret-not-for-production-use';
const unsubscribeToken = (userId: string) =>
  createHmac('sha256', SECRET).update(`unsubscribe:${userId}`).digest('base64url');

test.skip(({ isMobile }) => isMobile, 'one viewport covers the account flow');

async function signUp(page: Page, { optIn }: { optIn: boolean }) {
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  await page.goto('/ar/register');
  await page.getByLabel('الاسم الظاهر').fill('متعلمة عائدة');
  await page.getByRole('textbox', { name: 'البريد الإلكتروني' }).fill(email);
  await page.getByLabel('كلمة المرور').fill('correct horse');
  const box = page.getByRole('checkbox');
  await expect(box).not.toBeChecked();
  if (optIn) await box.check();
  await page.getByRole('button', { name: 'إنشاء الحساب' }).click();
  await expect(page).toHaveURL(/\/ar$/);
  return email;
}

test('a returning learner sees their level and goal, reviews a mistake, and continues', async ({
  page,
}) => {
  await signUp(page, { optIn: false });
  const me = await (await page.request.get('/api/me')).json();
  expect(me.settings).toEqual({ dailyGoal: 900, streakFreeze: false, emailOptIn: false });

  // A mistake, then the right answer: the step is paid and also queued for review.
  await page.goto(LESSON);
  const answer = async (address: string) => {
    await cell(page, address).click();
    await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/attempts')),
      page.keyboard.press('Enter'),
    ]);
  };
  await answer('A1');
  await expect(feedback(page)).toContainText('ليست هذه الخلية المطلوبة');
  await answer('C3');
  await expect(feedback(page)).toContainText('صحيح!');

  // Back on the home page: the welcome-back panel.
  await page.goto('/ar');
  const panel = page.getByTestId('welcome-back');
  await expect(panel.getByText('أهلًا بعودتك يا متعلمة عائدة')).toBeVisible();
  await expect(panel.getByText('المستوى 1')).toBeVisible();
  await expect(panel.getByTestId('daily-goal')).toContainText('/ 900');
  await expect(panel.getByRole('link', { name: /^تابع: الخلايا والتحديد$/ })).toHaveAttribute(
    'href',
    LESSON,
  );

  // Review the mistake.
  await panel.getByRole('link', { name: 'راجع خطوة واحدة أخطأت فيها' }).click();
  await expect(page).toHaveURL(/\/ar\/review$/);
  await expect(page.getByText('الخطوة 1 من 1')).toBeVisible();
  await cell(page, 'C3').click();
  await page.keyboard.press('Enter');
  await expect(feedback(page)).toHaveText(/صحيح! \+\d+ نقطة/);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'أحسنت! أنهيت المراجعة' })).toBeVisible();

  // Nothing left to review today.
  await page.reload();
  await expect(page.getByTestId('review-empty')).toBeVisible();
  const stats = await (await page.request.get('/api/me/stats')).json();
  expect(stats.reviewsDue).toBe(0);

  // Settings: a bigger goal and the streak freeze, kept after a reload.
  await page.goto('/ar/account');
  // The choice shows once the server has saved it.
  await page.getByRole('radio', { name: /مكثّف/ }).click();
  await expect(page.getByRole('radio', { name: /مكثّف/ })).toBeChecked();
  await expect(page.getByText('حُفظت الإعدادات.')).toBeVisible();
  await page.getByTestId('setting-streakFreeze').click();
  await expect(page.getByTestId('setting-streakFreeze')).toHaveAttribute('aria-checked', 'true');
  await page.reload();
  await expect(page.getByRole('radio', { name: /مكثّف/ })).toBeChecked();
  await expect(page.getByTestId('setting-streakFreeze')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('setting-emailOptIn')).toHaveAttribute('aria-checked', 'false');
});

test('the unsubscribe link from a reminder email turns reminders off without signing in', async ({
  page,
  browser,
}) => {
  await signUp(page, { optIn: true });
  const me = await (await page.request.get('/api/me')).json();
  expect(me.settings.emailOptIn).toBe(true);

  // Open the link in a fresh browser with no session, as from a mail app.
  const other = await browser.newContext();
  const tab = await other.newPage();
  await tab.goto(`/ar/unsubscribe?u=${me.id}&t=${unsubscribeToken(me.id)}`);
  await expect(tab.getByTestId('unsubscribe-result')).toHaveText(
    'ألغينا اشتراكك في التذكير الأسبوعي.',
  );
  // A forged link does nothing.
  await tab.goto(`/ar/unsubscribe?u=${me.id}&t=${unsubscribeToken('someone-else')}`);
  await expect(tab.getByTestId('unsubscribe-result')).toContainText('غير صالح');
  await other.close();

  await page.goto('/ar/account');
  await expect(page.getByTestId('setting-emailOptIn')).toHaveAttribute('aria-checked', 'false');
});

test('a completed lesson can be shared as a page with a card image', async ({ page }) => {
  await page.goto('/ar/share/basics/cells-and-selection/3');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('أنهيت درس «الخلايا والتحديد»');
  await expect(page.getByRole('img', { name: '3 نجوم من 3' })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  const image = await page.locator('meta[property="og:image"]').getAttribute('content');
  const res = await page.request.get(new URL(image!).pathname);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('image/png');
  await page.getByRole('link', { name: 'جرّب هذا الدرس' }).click();
  await expect(page).toHaveURL(/\/ar\/lessons\/basics\/cells-and-selection$/);
});

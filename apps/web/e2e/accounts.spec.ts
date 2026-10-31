import { expect, test, type Page } from '@playwright/test';

// Needs the API and Postgres with the curriculum synced (see playwright.config.ts).
const LESSON = '/ar/lessons/basics/cells-and-selection';
const correct = /صحيح! \+\d+ نقطة/;
const feedback = (page: Page) => page.getByRole('status');
const cell = (page: Page, address: string) => page.locator(`[data-address="${address}"]`);

test.skip(({ isMobile }) => isMobile, 'one viewport covers the account flow');

test('a guest plays, signs up, and keeps progress and points', async ({ page }) => {
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

  // 1. As a guest: answer the first step; it is kept in the browser.
  await page.goto(LESSON);
  await expect(page.getByRole('link', { name: 'إنشاء حساب' })).toBeVisible();
  await cell(page, 'C3').click();
  await page.keyboard.press('Enter');
  await expect(feedback(page)).toHaveText(correct);
  const guest = await page.evaluate(() => localStorage.getItem('tamreen.progress.v1'));
  expect(JSON.parse(guest!).lessons['cells-and-selection'].stepsDone).toEqual(['click-a-cell']);

  // 2. Sign up from the header; come back to the lesson.
  await page.getByRole('link', { name: 'إنشاء حساب' }).click();
  await expect(page).toHaveURL(/\/ar\/register\?next=/);
  await page.getByLabel('الاسم الظاهر').fill('متعلم تجريبي');
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.getByLabel('كلمة المرور').fill('correct horse');
  await page.getByRole('button', { name: 'إنشاء الحساب' }).click();
  await expect(page).toHaveURL(new RegExp(`${LESSON}$`));
  await expect(page.getByTestId('account-name')).toHaveText('مرحبًا، متعلم تجريبي');

  // 3. The guest step was merged: the server resumes at step 2 and has the points.
  await expect(page.getByText('تابعنا من حيث توقفت.')).toBeVisible();
  await expect(page.getByText('الخطوة 2 من 6').first()).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('tamreen.progress.v1'))).not.toContain(
    'click-a-cell',
  );
  await expect(page.getByTestId('stat-pointsTotal')).toHaveText('300');
  await expect(page.getByTestId('leaderboard')).toContainText('متعلم تجريبي');

  // 4. Signed in, the server checks the answer and awards the points.
  await page.getByRole('textbox', { name: 'مربع الاسم' }).fill('D5');
  await page.keyboard.press('Enter');
  // Under load the second Enter can arrive before the selection moves; wait for it.
  await expect(cell(page, 'D5')).toHaveAttribute('data-active', 'true');
  await expect(cell(page, 'D5')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(feedback(page)).toHaveText(correct);
  await expect
    .poll(async () => Number(await page.getByTestId('stat-pointsTotal').textContent()))
    .toBeGreaterThan(300);

  // 5. Sign out, sign back in: progress is on the account, not in this browser.
  await page.getByRole('button', { name: 'تسجيل الخروج' }).click();
  await expect(page.getByRole('link', { name: 'تسجيل الدخول' })).toBeVisible();
  await page.getByRole('link', { name: 'تسجيل الدخول' }).click();
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.getByLabel('كلمة المرور').fill('correct horse');
  await page.getByRole('button', { name: 'دخول' }).click();
  await expect(page).toHaveURL(new RegExp(`${LESSON}$`));
  await expect(page.getByText('الخطوة 3 من 6').first()).toBeVisible();
});

test('shows a clear error for a wrong password', async ({ page }) => {
  await page.goto('/ar/login');
  await page.getByLabel('البريد الإلكتروني').fill('nobody@example.com');
  await page.getByLabel('كلمة المرور').fill('wrong password');
  await page.getByRole('button', { name: 'دخول' }).click();
  // Scoped to the form: Next.js adds its own role="alert" route announcer.
  await expect(page.locator('form').getByRole('alert')).toHaveText(
    'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
  );
});

test('a learner deletes their account from the privacy page', async ({ page }) => {
  const email = `e2e-del-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

  // Guests see no delete control.
  await page.goto('/ar/privacy');
  await expect(page.getByRole('link', { name: 'تسجيل الدخول' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'حذف حسابي' })).toHaveCount(0);

  await page.goto(`/ar/register?next=${encodeURIComponent('/ar/privacy')}`);
  await page.getByLabel('الاسم الظاهر').fill('حساب للحذف');
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.getByLabel('كلمة المرور').fill('correct horse');
  await page.getByRole('button', { name: 'إنشاء الحساب' }).click();
  await expect(page).toHaveURL(/\/ar\/privacy$/);

  // Two steps: ask, then confirm. Cancelling keeps the account.
  const section = page.getByRole('region', { name: 'حذف الحساب' });
  await section.getByRole('button', { name: 'حذف حسابي' }).click();
  await section.getByRole('button', { name: 'إلغاء' }).click();
  await expect(page.getByTestId('account-name')).toBeVisible();

  await section.getByRole('button', { name: 'حذف حسابي' }).click();
  await section.getByRole('button', { name: 'نعم، احذف حسابي نهائيًا' }).click();
  await expect(section.getByRole('status')).toHaveText('حُذف حسابك وكل بياناته.');
  await expect(page.getByRole('link', { name: 'تسجيل الدخول' })).toBeVisible();

  // The account is gone: signing in fails.
  await page.goto('/ar/login');
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.getByLabel('كلمة المرور').fill('correct horse');
  await page.getByRole('button', { name: 'دخول' }).click();
  await expect(page.locator('form').getByRole('alert')).toHaveText(
    'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
  );
});

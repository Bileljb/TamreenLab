import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const LESSON_1 = '/ar/lessons/basics/cells-and-selection';
const LESSON_2 = '/ar/lessons/aggregation/sum-basics';
const SCREENSHOTS = path.resolve(import.meta.dirname, '../../../docs/screenshots/phase-2');

const feedback = (page: Page) => page.getByRole('status');
const cell = (page: Page, address: string) => page.locator(`[data-address="${address}"]`);
const step = (page: Page, n: number, total = 6) =>
  page.getByText(`الخطوة ${n} من ${total}`).first();
const correct = /صحيح! \+\d+ نقطة/;

/**
 * Guests must be able to play with the API down (Phase 2 acceptance): every /api request fails,
 * and the returned check asserts that the page never tried to submit an attempt.
 */
async function apiDown(page: Page) {
  const attempts: string[] = [];
  await page.route('**/api/**', (route) => {
    if (route.request().url().includes('/api/attempts')) attempts.push(route.request().url());
    return route.abort();
  });
  return () => expect(attempts).toEqual([]);
}

/** Moves the keyboard selection from A1, which has focus when a step opens. */
async function goFromA1(page: Page, down: number, right: number) {
  for (let i = 0; i < down; i++) await page.keyboard.press('ArrowDown');
  for (let i = 0; i < right; i++) await page.keyboard.press('ArrowRight');
}

async function expectCorrectThenContinue(page: Page) {
  await expect(feedback(page)).toHaveText(correct);
  await expect(page.getByRole('button', { name: 'متابعة' })).toBeFocused();
  await page.keyboard.press('Enter');
}

test.describe('desktop, keyboard only', () => {
  test.skip(({ isMobile }) => isMobile, 'keyboard flow');

  test('completes "cells and selection" by keyboard', async ({ page }) => {
    const noApi = await apiDown(page);
    await page.goto(LESSON_1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('الخلايا والتحديد');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('grid').locator('xpath=ancestor::*[@dir][1]')).toHaveAttribute(
      'dir',
      'ltr',
    );

    // 1. Select C3; a wrong cell first shows WRONG_CELL feedback.
    await cell(page, 'A1').focus();
    await page.keyboard.press('Enter');
    await expect(feedback(page)).toContainText('ليست هذه الخلية المطلوبة');
    await goFromA1(page, 2, 2);
    await page.keyboard.press('Enter');
    await expectCorrectThenContinue(page);

    // 2. Name box: Shift+Tab out of the grid to the formula bar, then to the name box.
    await expect(step(page, 2)).toBeVisible();
    await expect(cell(page, 'A1')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('textbox', { name: 'مربع الاسم' })).toBeFocused();
    await page.keyboard.type('D5');
    await page.keyboard.press('Enter');
    await expect(cell(page, 'D5')).toBeFocused();
    await page.keyboard.press('Enter');
    await expectCorrectThenContinue(page);

    // 3. Range A2:A5 with Shift+arrows.
    await expect(step(page, 3)).toBeVisible();
    await page.keyboard.press('ArrowDown');
    for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowDown');
    await expect(page.getByRole('textbox', { name: 'مربع الاسم' })).toHaveValue('A2:A5');
    await page.keyboard.press('Enter');
    await expectCorrectThenContinue(page);

    // 4. Arabic text into A6 (F2 opens the editor; Arabic input arrives as text, not keys).
    await expect(step(page, 4)).toBeVisible();
    await goFromA1(page, 5, 0);
    await page.keyboard.press('F2');
    await page.keyboard.insertText('هدى');
    await page.keyboard.press('Enter');
    await expectCorrectThenContinue(page);

    // 5. A number into D6.
    await expect(step(page, 5)).toBeVisible();
    await goFromA1(page, 5, 3);
    await page.keyboard.type('3');
    await page.keyboard.press('Enter');
    await expectCorrectThenContinue(page);

    // 6. Multiple choice with arrow keys.
    await expect(step(page, 6)).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('radio', { name: 'B4' })).toBeChecked();
    await page.keyboard.press('Enter');
    await expectCorrectThenContinue(page);

    await expect(page.getByRole('heading', { name: 'أحسنت! أكملت الدرس' })).toBeFocused();
    await expect(page.getByText('6 من 6 خطوات صحيحة')).toBeVisible();
    noApi();
  });

  test('completes "SUM basics" by keyboard, with a hard-coded answer rejected', async ({
    page,
  }) => {
    const noApi = await apiDown(page);
    await page.goto(LESSON_2);
    await cell(page, 'A1').focus();

    const enterFormula = async (down: number, right: number, formula: string) => {
      await goFromA1(page, down, right);
      await page.keyboard.type(formula);
      await page.keyboard.press('Enter');
    };

    await enterFormula(6, 1, '=B2+B3+B4+B5+B6');
    await expectCorrectThenContinue(page);

    await expect(step(page, 2)).toBeVisible();
    await enterFormula(6, 1, '=SUM(B2:B6)');
    await expectCorrectThenContinue(page);

    await expect(step(page, 3)).toBeVisible();
    await enterFormula(6, 1, '=sum(b2:b6)');
    await expectCorrectThenContinue(page);

    // 4. The hard-coded total is caught; the formula then passes in the same cell.
    await expect(step(page, 4)).toBeVisible();
    await enterFormula(6, 1, '=450');
    await expect(feedback(page)).toContainText('كتبت الناتج مباشرة');
    await page.keyboard.type('=SUM(B2:B6)');
    await page.keyboard.press('Enter');
    await expectCorrectThenContinue(page);

    await expect(step(page, 5)).toBeVisible();
    await enterFormula(1, 3, '=SUM(B2;B4)');
    await expect(feedback(page)).toContainText('النتيجة غير صحيحة');
    // Enter moved the selection down to D3; go back to D2.
    await page.keyboard.press('ArrowUp');
    await page.keyboard.type('=SUM(B2:B4)');
    await page.keyboard.press('Enter');
    await expectCorrectThenContinue(page);

    await expect(step(page, 6)).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expectCorrectThenContinue(page);

    await expect(page.getByRole('heading', { name: 'أحسنت! أكملت الدرس' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'الدرس التالي', exact: true })).toHaveAttribute(
      'href',
      '/ar/lessons/aggregation/average',
    );
    noApi();
  });

  test('keeps guest progress across a reload', async ({ page }) => {
    await page.goto(LESSON_1);
    await cell(page, 'A1').focus();
    await goFromA1(page, 2, 2);
    await page.keyboard.press('Enter');
    await expect(feedback(page)).toHaveText(correct);
    const points = await page.getByTestId('lesson-points').textContent();

    await page.reload();
    await expect(step(page, 2)).toBeVisible();
    await expect(page.getByText('تابعنا من حيث توقفت.')).toBeVisible();
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    const stored = await page.evaluate(() => localStorage.getItem('tamreen.progress.v1'));
    expect(JSON.parse(stored!).lessons['cells-and-selection'].stepsDone).toEqual(['click-a-cell']);
    expect(points).toMatch(/^\d+ نقطة$/);
  });

  test('saves review screenshots at 390, 768 and 1280 px', async ({ page }) => {
    for (const width of [390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(LESSON_2);
      await cell(page, 'B7').click();
      await page.keyboard.type('=SUM(B2:B6)');
      await page.keyboard.press('Enter');
      await expect(feedback(page)).toHaveText(correct);
      await page.screenshot({ path: `${SCREENSHOTS}/sum-basics-${width}.png`, fullPage: true });

      await page.goto(LESSON_1);
      await expect(cell(page, 'A1')).toBeVisible();
      await page.screenshot({
        path: `${SCREENSHOTS}/cells-and-selection-${width}.png`,
        fullPage: true,
      });
      await page.evaluate(() => localStorage.clear());
    }
  });
});

test.describe('mobile, touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch flow');

  test('completes "SUM basics" with taps and the helper bar', async ({ page }) => {
    const noApi = await apiDown(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(LESSON_2);
    const bar = page.getByRole('toolbar', { name: 'أزرار إدخال المعادلة' });
    const formulaBar = page.getByRole('textbox', { name: 'شريط المعادلة' });
    const key = (k: string) => bar.getByRole('button', { name: `أدرج ${k}`, exact: true });
    const fn = (name: string) =>
      bar.getByRole('button', { name: `أدرج الدالة ${name}`, exact: true });
    const tapContinue = async () => {
      await expect(feedback(page)).toHaveText(correct);
      await page.getByRole('button', { name: 'متابعة' }).tap();
    };
    /** Drags across cells with pointer events (Playwright has no touch-move API). */
    const drag = async (from: string, to: string) => {
      // Both ends must be on screen: centre the start cell first.
      await cell(page, from).evaluate((el) => el.scrollIntoView({ block: 'center' }));
      const a = (await cell(page, from).boundingBox())!;
      const b = (await cell(page, to).boundingBox())!;
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 5 });
      await page.mouse.up();
    };

    await expect(bar).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    // 1. Tap B7, then build the formula from the helper bar and by tapping cells.
    await cell(page, 'B7').tap();
    await key('=').tap();
    await expect(formulaBar).toBeFocused();
    for (const address of ['B2', 'B3', 'B4', 'B5', 'B6']) {
      if (address !== 'B2') await formulaBar.press('+');
      await cell(page, address).tap();
    }
    await expect(formulaBar).toHaveValue('=B2+B3+B4+B5+B6');
    await formulaBar.press('Enter');
    await tapContinue();

    // 2. SUM chip, then a dragged range.
    await cell(page, 'B7').tap();
    await key('=').tap();
    await fn('SUM').tap();
    await drag('B2', 'B6');
    await key(')').tap();
    await expect(formulaBar).toHaveValue('=SUM(B2:B6)');
    await formulaBar.press('Enter');
    await tapContinue();

    // 3 and 4: the same with taps.
    for (let n = 3; n <= 4; n++) {
      await expect(step(page, n)).toBeVisible();
      await cell(page, 'B7').tap();
      await key('=').tap();
      await fn('SUM').tap();
      await drag('B2', 'B6');
      await key(')').tap();
      await formulaBar.press('Enter');
      await tapContinue();
    }

    // 5. D2 = SUM(B2:B4).
    await cell(page, 'D2').tap();
    await key('=').tap();
    await fn('SUM').tap();
    await drag('B2', 'B4');
    await key(')').tap();
    await formulaBar.press('Enter');
    await tapContinue();

    // 6. Multiple choice.
    await page.getByRole('radio', { name: '205' }).tap();
    await page.getByRole('button', { name: 'تحقّق' }).tap();
    await tapContinue();

    await expect(page.getByRole('heading', { name: 'أحسنت! أكملت الدرس' })).toBeVisible();
    noApi();
  });
});

test.describe('every lesson', () => {
  test.skip(({ isMobile }) => isMobile, 'one viewport is enough for the smoke check');

  const lessonsDir = path.resolve(import.meta.dirname, '../../../content/lessons');
  const lessons = fs.readdirSync(lessonsDir).flatMap((track) =>
    fs
      .readdirSync(path.join(lessonsDir, track))
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(fs.readFileSync(path.join(lessonsDir, track, f), 'utf8'))),
  ) as { track: string; slug: string; titleAr: string; steps: unknown[] }[];

  for (const lesson of lessons) {
    test(`renders ${lesson.track}/${lesson.slug}`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`/ar/lessons/${lesson.track}/${lesson.slug}`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(lesson.titleAr);
      await expect(step(page, 1, lesson.steps.length)).toBeVisible();
      await expect(page.getByRole('button', { name: 'تحقّق' })).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
});

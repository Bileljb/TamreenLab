import { expect, test, type Page } from '@playwright/test';

// Six steps: bold, italic, underline, currency, percent, and Ctrl+1, which the browser keeps.
const LESSON = '/ar/lessons/shortcuts/shortcuts-formatting';
const correct = /صحيح! \+\d+ نقطة/;

const feedback = (page: Page) => page.getByRole('status');
const capture = (page: Page) => page.getByRole('textbox', { name: /اضغط الاختصار/ });
const step = (page: Page, n: number) => page.getByText(`الخطوة ${n} من 6`).first();

async function expectCorrectThenContinue(page: Page) {
  await expect(feedback(page)).toHaveText(correct);
  await expect(page.getByRole('button', { name: 'متابعة' })).toBeFocused();
  await page.keyboard.press('Enter');
}

test.describe('shortcut drills on a keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'keyboard flow');

  test('completes the formatting lesson by pressing the keys', async ({ page }) => {
    await page.goto(LESSON);
    await expect(step(page, 1)).toBeVisible();
    const url = page.url();

    // 1. Bold: a wrong combo first, which the page keeps from the browser.
    await capture(page).focus();
    await page.keyboard.press('Control+d');
    await expect(feedback(page)).toContainText('ليس هذا الاختصار المطلوب');
    await expect(capture(page)).toContainText('ضغطت:');
    await page.keyboard.press('Control+b');
    await expectCorrectThenContinue(page);

    // 2–5. Each new step focuses the key box, so the whole lesson runs from the keyboard.
    await expect(step(page, 2)).toBeVisible();
    await expect(capture(page)).toBeFocused();
    await page.keyboard.press('Control+i');
    await expectCorrectThenContinue(page);
    await expect(capture(page)).toBeFocused();
    await page.keyboard.press('Control+u');
    await expectCorrectThenContinue(page);
    await expect(capture(page)).toBeFocused();
    await page.keyboard.press('Control+Shift+Digit4');
    await expectCorrectThenContinue(page);
    await expect(capture(page)).toBeFocused();
    await page.keyboard.press('Control+Shift+Digit5');
    await expectCorrectThenContinue(page);

    // 6. Ctrl+1 belongs to the browser, so the step is a choice of keycaps.
    await expect(step(page, 6)).toBeVisible();
    await expect(capture(page)).toHaveCount(0);
    await expect(page.getByText(/يحتفظ المتصفح بهذا الاختصار/)).toBeVisible();
    await page.getByRole('radio', { name: 'Ctrl + 1' }).check();
    await page.keyboard.press('Enter');
    await expectCorrectThenContinue(page);

    await expect(page.getByRole('heading', { name: 'أحسنت! أكملت الدرس' })).toBeVisible();
    expect(page.url()).toBe(url);
  });

  test('switches to Mac keys and remembers the choice', async ({ page }) => {
    await page.goto(LESSON);
    await page.getByRole('radio', { name: 'Mac' }).click();
    await capture(page).focus();
    await page.keyboard.press('Control+b');
    await expect(feedback(page)).toContainText('ليس هذا الاختصار المطلوب');
    await page.keyboard.press('Meta+b');
    await expect(feedback(page)).toHaveText(correct);

    await page.reload();
    await expect(page.getByRole('radio', { name: 'Mac' })).toHaveAttribute('aria-checked', 'true');
  });
});

test.describe('shortcut drills on a phone', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch flow');

  test('turns every shortcut step into a choice of keycaps', async ({ page }) => {
    await page.goto(LESSON);
    await expect(page.getByText(/على الهاتف أو الجهاز اللوحي/)).toBeVisible();
    await expect(capture(page)).toHaveCount(0);
    await page.getByRole('radio', { name: 'Ctrl + I' }).tap();
    await page.getByRole('button', { name: 'تحقّق' }).tap();
    await expect(feedback(page)).toContainText('ليس هذا الاختصار المطلوب');
    await page.getByRole('radio', { name: 'Ctrl + B' }).tap();
    await page.getByRole('button', { name: 'تحقّق' }).tap();
    await expect(feedback(page)).toHaveText(correct);
    await page.getByRole('button', { name: 'متابعة' }).tap();
    await expect(step(page, 2)).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Ctrl + I' })).toBeVisible();
  });
});

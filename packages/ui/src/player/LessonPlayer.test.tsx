import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GUEST_PROGRESS_KEY, LessonFileSchema, type LessonFileInput } from '@tamreen/shared';
import { renderWithIntl } from '../test/intl';
import { LessonPlayer } from './LessonPlayer';

const sheet = {
  visible: 'A1:C4',
  cells: { A1: 'المنتج', B1: 'الكمية', A2: 'قلم', B2: 120, A3: 'دفتر', B3: 80 },
};

const lesson = LessonFileSchema.parse({
  slug: 'test-lesson',
  track: 'basics',
  order: 1,
  kind: 'CONCEPT',
  titleAr: 'درس تجريبي',
  summaryAr: 'ملخص',
  minutes: 3,
  steps: [
    {
      slug: 'pick',
      type: 'SELECT_CELL',
      promptAr: 'اختر {{خلية}} `B3`.',
      sheet,
      check: { target: 'B3' },
      hintAr: 'العمود B والصف 3.',
    },
    {
      slug: 'sum',
      type: 'ENTER_FORMULA',
      promptAr: 'اكتب في `B4` معادلة تجمع الكميات.',
      sheet,
      check: {
        target: 'B4',
        expected: { value: 200 },
        solution: '=SUM(B2:B3)',
        mustUseFunctions: ['SUM'],
        variants: [{ cells: { B2: 1 } }],
      },
    },
    {
      slug: 'choose',
      type: 'MULTIPLE_CHOICE',
      promptAr: 'أي دالة تجمع؟',
      check: { options: ['COUNT', 'SUM'], correct: 1 },
    },
  ],
} satisfies LessonFileInput);

const glossary = { خلية: 'cell' };
const cell = (address: string) =>
  document.querySelector<HTMLElement>(`[data-address="${address}"]`)!;
const feedback = () => screen.getByRole('status');

function renderPlayer() {
  return renderWithIntl(
    <LessonPlayer
      lesson={lesson}
      glossary={glossary}
      lessonsHref="/ar/lessons"
      nextLessonHref="/ar/next"
    />,
  );
}

describe('LessonPlayer', () => {
  it('plays the whole lesson by keyboard and saves guest progress', async () => {
    const user = userEvent.setup();
    renderPlayer();
    expect(screen.getByText('الخطوة 1 من 3')).toBeTruthy();
    expect(screen.getByText('cell')).toBeTruthy();

    // Step 1: wrong cell, then the right one; Enter checks, Enter continues.
    await user.click(cell('B2'));
    await user.keyboard('{Enter}');
    expect(feedback().textContent).toContain('ليست هذه الخلية المطلوبة');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(feedback().textContent).toMatch(/صحيح! \+\d+ نقطة/);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'متابعة' }));
    await user.keyboard('{Enter}');

    // Step 2: a hard-coded number is caught, then a real formula passes on Enter.
    expect(screen.getByText('الخطوة 2 من 3')).toBeTruthy();
    expect(document.activeElement).toBe(cell('A1'));
    await user.click(cell('B4'));
    await user.keyboard('=200{Enter}');
    expect(feedback().textContent).toContain('كتبت الناتج مباشرة');
    await user.click(cell('B4'));
    await user.keyboard('=SUM(B2:B3{Enter}');
    expect(feedback().textContent).toContain('خطأ في الكتابة');
    await user.click(cell('B4'));
    await user.keyboard('=sum(B2;B3){Enter}');
    expect(feedback().textContent).toMatch(/صحيح! \+\d+ نقطة/);
    await user.keyboard('{Enter}');

    // Step 3: multiple choice, no sheet.
    expect(screen.queryByRole('grid')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'تحقّق' }));
    expect(feedback().textContent).toBe('اختر إجابة أولًا.');
    await user.click(screen.getByRole('radio', { name: 'COUNT' }));
    await user.keyboard('{Enter}');
    expect(feedback().textContent).toContain('ليست هذه الإجابة الصحيحة');
    await user.click(screen.getByRole('radio', { name: 'SUM' }));
    await user.keyboard('{Enter}');
    await user.keyboard('{Enter}');

    // Completion.
    const heading = screen.getByRole('heading', { name: 'أحسنت! أكملت الدرس' });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByText('3 من 3 خطوات صحيحة، منها 0 من المحاولة الأولى.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'الدرس التالي' }).getAttribute('href')).toBe(
      '/ar/next',
    );

    const stored = JSON.parse(window.localStorage.getItem(GUEST_PROGRESS_KEY)!);
    expect(stored.lessons['test-lesson'].stepsDone).toEqual(['pick', 'sum', 'choose']);
    expect(stored.lessons['test-lesson'].points).toBeGreaterThan(0);
    expect(stored.lessons['test-lesson'].completedAt).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'أعد الدرس' }));
    expect(screen.getByText('الخطوة 1 من 3')).toBeTruthy();
  });

  it('shows a hint, reveals the answer with no points, and still allows Continue', async () => {
    const user = userEvent.setup();
    renderPlayer();
    await user.click(screen.getByRole('button', { name: 'تلميح' }));
    expect(screen.getByText('العمود B والصف 3.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'اعرض الإجابة' }));
    expect(feedback().textContent).toContain('الإجابة:');
    await waitFor(() => expect(cell('B3').getAttribute('aria-selected')).toBe('true'));
    await user.click(screen.getByRole('button', { name: 'متابعة' }));

    await user.click(screen.getByRole('button', { name: 'اعرض الإجابة' }));
    await waitFor(() => expect(cell('B4').textContent).toBe('200'));
    expect(within(feedback()).getByText('=SUM(B2:B3)')).toBeTruthy();
    // The revealed formula is not checked as a learner entry.
    expect(screen.getByTestId('lesson-points').textContent).toBe('0 نقطة');
    await user.click(screen.getByRole('button', { name: 'متابعة' }));

    await user.click(screen.getByRole('button', { name: 'اعرض الإجابة' }));
    expect(screen.getByRole('radio', { name: 'SUM' })).toHaveProperty('checked', true);
    expect(window.localStorage.getItem(GUEST_PROGRESS_KEY)).toBeNull();
  });

  it('asks for an entry before checking a formula step, and can skip and go back', async () => {
    const user = userEvent.setup();
    renderPlayer();
    await user.click(screen.getByRole('button', { name: 'تخطَّ' }));
    expect(screen.getByText('الخطوة 2 من 3')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'تحقّق' }));
    expect(feedback().textContent).toBe('اكتب إجابتك في خلية ثم اضغط Enter.');
    await user.click(screen.getByRole('button', { name: 'السابق' }));
    expect(screen.getByText('الخطوة 1 من 3')).toBeTruthy();
    expect(feedback().textContent).toBe('تخطيت هذه الخطوة.');
    expect(screen.getByRole('button', { name: 'السابق' })).toHaveProperty('disabled', true);
  });

  it('resumes at the first unfinished step from guest progress', async () => {
    window.localStorage.setItem(
      GUEST_PROGRESS_KEY,
      JSON.stringify({
        version: 1,
        lessons: { 'test-lesson': { stepsDone: ['pick'], points: 400 } },
      }),
    );
    renderPlayer();
    await waitFor(() => expect(screen.getByText('الخطوة 2 من 3')).toBeTruthy());
    expect(screen.getByText('تابعنا من حيث توقفت.')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('1');
  });
});

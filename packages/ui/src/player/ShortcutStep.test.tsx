import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LessonFileSchema, type LessonFileInput } from '@tamreen/shared';
import { renderWithIntl } from '../test/intl';
import { LessonPlayer } from './LessonPlayer';
import { PLATFORM_KEY, detectPlatform } from './platform';

const lesson = LessonFileSchema.parse({
  slug: 'shortcut-lesson',
  track: 'shortcuts',
  order: 1,
  kind: 'CONCEPT',
  titleAr: 'اختصارات',
  summaryAr: 'ملخص',
  minutes: 3,
  steps: [
    {
      slug: 'fill-down',
      type: 'SHORTCUT',
      promptAr: 'املأ الخلايا إلى الأسفل.',
      check: {
        combos: [{ win: 'Ctrl+D', mac: 'Cmd+D' }],
        distractors: [
          { win: 'Ctrl+R', mac: 'Cmd+R' },
          { win: 'Ctrl+F', mac: 'Cmd+F' },
        ],
      },
      hintAr: 'الحرف D من كلمة Down.',
    },
    {
      slug: 'format-cells',
      type: 'SHORTCUT',
      promptAr: 'افتح نافذة تنسيق الخلايا.',
      check: {
        combos: [{ win: 'Ctrl+1', mac: 'Cmd+1' }],
        distractors: [
          { win: 'Ctrl+2', mac: 'Cmd+2' },
          { win: 'Ctrl+Shift+F', mac: 'Cmd+Shift+F' },
        ],
      },
    },
  ],
} satisfies LessonFileInput);

const feedback = () => screen.getByRole('status');
const capture = () => screen.getByRole('textbox', { name: /اضغط الاختصار/ });

function renderPlayer() {
  return renderWithIntl(<LessonPlayer lesson={lesson} glossary={{}} lessonsHref="/ar/lessons" />);
}

afterEach(() => vi.unstubAllGlobals());

describe('shortcut steps', () => {
  it('captures key presses, rejects the wrong combo and accepts the right one', async () => {
    const user = userEvent.setup();
    renderPlayer();
    await user.click(capture());
    await user.keyboard('{Control>}r{/Control}');
    expect(feedback().textContent).toContain('ليس هذا الاختصار المطلوب');
    expect(capture().textContent).toContain('ضغطت:');
    expect(capture().textContent).toContain('R');
    await user.keyboard('{Control>}d{/Control}');
    expect(feedback().textContent).toMatch(/صحيح! \+\d+ نقطة/);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'متابعة' }));
  });

  it('asks for a press before checking, and lets Tab leave the box', async () => {
    const user = userEvent.setup();
    renderPlayer();
    await user.click(screen.getByRole('button', { name: 'تحقّق' }));
    expect(feedback().textContent).toBe('انقر المربع واضغط الاختصار أولًا.');
    await user.click(capture());
    await user.tab();
    expect(document.activeElement).not.toBe(capture());
    expect(feedback().textContent).toBe('انقر المربع واضغط الاختصار أولًا.');
  });

  it('switches to the Mac combos and remembers the choice', async () => {
    const user = userEvent.setup();
    renderPlayer();
    await user.click(screen.getByRole('radio', { name: 'Mac' }));
    expect(window.localStorage.getItem(PLATFORM_KEY)).toBe('mac');
    await user.click(capture());
    await user.keyboard('{Control>}d{/Control}');
    expect(feedback().textContent).toContain('ليس هذا الاختصار المطلوب');
    await user.keyboard('{Meta>}d{/Meta}');
    expect(feedback().textContent).toMatch(/صحيح!/);
  });

  it('turns a combo the browser keeps into a choice of options', async () => {
    const user = userEvent.setup();
    renderPlayer();
    await user.click(screen.getByRole('button', { name: 'تخطَّ' }));
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText(/يحتفظ المتصفح بهذا الاختصار/)).toBeTruthy();
    await user.click(screen.getByRole('radio', { name: 'Ctrl + 2' }));
    await user.keyboard('{Enter}');
    expect(feedback().textContent).toContain('ليس هذا الاختصار المطلوب');
    await user.click(screen.getByRole('radio', { name: 'Ctrl + 1' }));
    await user.click(screen.getByRole('button', { name: 'تحقّق' }));
    expect(feedback().textContent).toMatch(/صحيح!/);
  });

  it('offers choices on a touch screen', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q === '(pointer: coarse)' }));
    const user = userEvent.setup();
    renderPlayer();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText(/على الهاتف أو الجهاز اللوحي/)).toBeTruthy();
    await user.click(screen.getByRole('radio', { name: 'Ctrl + D' }));
    await user.click(screen.getByRole('button', { name: 'تحقّق' }));
    expect(feedback().textContent).toMatch(/صحيح!/);
  });

  it('reveals the keys with Show Answer', async () => {
    const user = userEvent.setup();
    renderPlayer();
    await user.click(screen.getByRole('button', { name: 'اعرض الإجابة' }));
    expect(feedback().textContent).toContain('الإجابة:');
    expect(feedback().textContent).toContain('Ctrl');
    expect(feedback().textContent).toContain('D');
  });
});

describe('detectPlatform', () => {
  it('reads the client hint, then the legacy platform, and defaults to Windows', () => {
    expect(detectPlatform({ userAgentData: { platform: 'macOS' } })).toBe('mac');
    expect(detectPlatform({ platform: 'MacIntel' })).toBe('mac');
    expect(detectPlatform({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0)' })).toBe('mac');
    expect(detectPlatform({ platform: 'Win32' })).toBe('win');
    expect(detectPlatform({})).toBe('win');
    expect(detectPlatform(undefined)).toBe('win');
  });
});

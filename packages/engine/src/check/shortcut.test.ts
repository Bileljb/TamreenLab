import { describe, expect, it } from 'vitest';
import { StepSpecSchema, type StepOf, type StepSpecInput } from '@tamreen/shared';
import { checkAnswer } from './index';
import { referenceAnswer } from './reference';
import {
  RESERVED_COMBOS,
  formatCombo,
  isReserved,
  sameCombo,
  shortcutMode,
  shortcutOptions,
} from './shortcut';

const shortcut = (check: Extract<StepSpecInput, { type: 'SHORTCUT' }>['check'], slug = 'step') =>
  StepSpecSchema.parse({ slug, type: 'SHORTCUT', promptAr: 'اضغط', check }) as StepOf<'SHORTCUT'>;

const fillDown = shortcut(
  {
    combos: [{ win: 'Ctrl+D', mac: 'Cmd+D' }],
    distractors: [
      { win: 'Ctrl+R', mac: 'Cmd+R' },
      { win: 'Ctrl+F', mac: 'Cmd+F' },
      { win: 'Ctrl+Shift+D', mac: 'Cmd+Shift+D' },
    ],
  },
  'fill-down',
);

describe('sameCombo', () => {
  it('ignores modifier order, case and aliases', () => {
    expect(sameCombo('Shift+Ctrl+l', 'Ctrl+Shift+L')).toBe(true);
    expect(sameCombo('Option+Down', 'Alt+ArrowDown')).toBe(true);
    expect(sameCombo('Cmd+Return', 'Meta+Enter')).toBe(true);
    expect(sameCombo('Ctrl+D', 'Ctrl+Shift+D')).toBe(false);
  });
});

describe('isReserved', () => {
  it.each(RESERVED_COMBOS.win.map((c) => [c]))('win: %s is reserved', (combo) => {
    expect(isReserved(combo, 'win')).toBe(true);
  });
  it.each(RESERVED_COMBOS.mac.map((c) => [c]))('mac: %s is reserved', (combo) => {
    expect(isReserved(combo, 'mac')).toBe(true);
  });
  it('treats any Windows-key combo as reserved', () => {
    expect(isReserved('Win+E', 'win')).toBe(true);
  });
  it.each([
    ['Ctrl+D', 'win'],
    ['Ctrl+R', 'win'],
    ['Alt+=', 'win'],
    ['Ctrl+Shift+$', 'win'],
    ['Ctrl+Space', 'win'],
    ['Cmd+D', 'mac'],
    ['Cmd+Shift+Down', 'mac'],
  ] as const)('%s on %s can be captured', (combo, platform) => {
    expect(isReserved(combo, platform)).toBe(false);
  });
});

describe('shortcutMode', () => {
  it('captures keys on a keyboard device when the combo is free', () => {
    expect(shortcutMode(fillDown, 'win')).toBe('keys');
    expect(shortcutMode(fillDown, 'mac')).toBe('keys');
  });
  it('falls back to choice on touch devices', () => {
    expect(shortcutMode(fillDown, 'win', { touch: true })).toBe('choice');
  });
  it('falls back to choice when every combo for the platform is reserved', () => {
    const autoSum = shortcut({ combos: [{ win: 'Alt+=', mac: 'Cmd+Shift+T' }] });
    expect(shortcutMode(autoSum, 'win')).toBe('keys');
    expect(shortcutMode(autoSum, 'mac')).toBe('choice');
  });
  it('keeps capture when one of several combos is free', () => {
    const s = shortcut({
      combos: [
        { win: 'Ctrl+1', mac: 'Cmd+1' },
        { win: 'Ctrl+Shift+F', mac: 'Cmd+Shift+F' },
      ],
    });
    expect(shortcutMode(s, 'win')).toBe('keys');
  });
  it('honours the author override', () => {
    const s = shortcut({ combos: [{ win: 'Ctrl+D', mac: 'Cmd+D' }], blockedInBrowser: true });
    expect(shortcutMode(s, 'win')).toBe('choice');
  });
});

describe('shortcutOptions', () => {
  it('lists the taught combo and every distractor, once each', () => {
    const options = shortcutOptions(fillDown, 'win');
    expect([...options].sort()).toEqual(['Ctrl+D', 'Ctrl+F', 'Ctrl+R', 'Ctrl+Shift+D']);
  });
  it('gives the same order every time, seeded by the slug', () => {
    expect(shortcutOptions(fillDown, 'mac')).toEqual(shortcutOptions(fillDown, 'mac'));
    const orders = new Set(
      ['a', 'b', 'c', 'd', 'e', 'f'].map((slug) =>
        shortcutOptions({ ...fillDown, slug }, 'win').join(','),
      ),
    );
    expect(orders.size).toBeGreaterThan(1);
  });
});

describe('checking a shortcut', () => {
  it('accepts a captured press on an Arabic layout by its physical key', () => {
    const answer = { keys: { key: 'ي', code: 'KeyD', ctrlKey: true }, platform: 'win' };
    expect(checkAnswer(fillDown, answer).correct).toBe(true);
  });
  it('matches shifted symbols by their physical key', () => {
    const currency = shortcut({ combos: [{ win: 'Ctrl+Shift+$', mac: 'Ctrl+Shift+$' }] });
    const press = (keys: Record<string, unknown>) =>
      checkAnswer(currency, { keys, platform: 'win' }).correct;
    expect(press({ key: '$', code: 'Digit4', ctrlKey: true, shiftKey: true })).toBe(true);
    expect(press({ key: '٤', code: 'Digit4', ctrlKey: true, shiftKey: true })).toBe(true);
    expect(press({ key: '4', code: 'Digit4', ctrlKey: true })).toBe(false);
  });
  it('matches punctuation keys by their code', () => {
    const autoSum = shortcut({ combos: [{ win: 'Alt+=', mac: 'Cmd+Shift+T' }] });
    expect(
      checkAnswer(autoSum, { keys: { key: '≠', code: 'Equal', altKey: true }, platform: 'win' })
        .correct,
    ).toBe(true);
    const today = shortcut({ combos: [{ win: 'Ctrl+;', mac: 'Ctrl+;' }] });
    expect(
      checkAnswer(today, { keys: { key: 'ك', code: 'Semicolon', ctrlKey: true }, platform: 'win' })
        .correct,
    ).toBe(true);
  });
  it('accepts the right picked option and rejects a distractor', () => {
    expect(checkAnswer(fillDown, { combo: 'Cmd+D', platform: 'mac' })).toEqual({
      correct: true,
      code: 'OK',
    });
    expect(checkAnswer(fillDown, { combo: 'Cmd+R', platform: 'mac' })).toEqual({
      correct: false,
      code: 'WRONG_VALUE',
    });
    expect(checkAnswer(fillDown, { combo: 'Ctrl+D', platform: 'mac' }).correct).toBe(false);
  });
});

describe('referenceAnswer for shortcuts', () => {
  it('presses keys when the combo can be captured', () => {
    expect(referenceAnswer(fillDown, 'win')).toMatchObject({ keys: { key: 'D', ctrlKey: true } });
  });
  it('picks the option when the step falls back to choice', () => {
    const autoSum = shortcut({ combos: [{ win: 'Alt+=', mac: 'Cmd+Shift+T' }] });
    const answer = referenceAnswer(autoSum, 'mac');
    expect(answer).toEqual({ combo: 'Cmd+Shift+T', platform: 'mac' });
    expect(checkAnswer(autoSum, answer).correct).toBe(true);
  });
});

describe('formatCombo', () => {
  it('names keys the way Windows keyboards print them', () => {
    expect(formatCombo('Shift+ctrl+l', 'win')).toEqual(['Ctrl', 'Shift', 'L']);
    expect(formatCombo('Alt+=', 'win')).toEqual(['Alt', '=']);
    expect(formatCombo('Ctrl+Down', 'win')).toEqual(['Ctrl', '↓']);
    expect(formatCombo('Esc', 'win')).toEqual(['Esc']);
    expect(formatCombo('Ctrl+Space', 'win')).toEqual(['Ctrl', 'Space']);
  });
  it('uses the Mac symbols in the Mac order', () => {
    expect(formatCombo('Cmd+Shift+T', 'mac')).toEqual(['⇧', '⌘', 'T']);
    expect(formatCombo('Ctrl+Option+Return', 'mac')).toEqual(['⌃', '⌥', 'Return']);
  });
});

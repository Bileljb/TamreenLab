import { describe, expect, it } from 'vitest';
import { StepSpecSchema, type StepSpecInput } from '@tamreen/shared';
import { checkAnswer, InvalidAnswerError } from './index';

const step = (input: StepSpecInput) => StepSpecSchema.parse(input);
const base = { slug: 'step', promptAr: 'نص التعليمات' };

describe('SELECT_CELL', () => {
  const s = step({ ...base, type: 'SELECT_CELL', check: { target: 'C4' } });
  it.each([
    ['C4', 'OK'],
    ['c4', 'OK'],
    ['$C$4', 'OK'],
    ['C5', 'WRONG_CELL'],
    ['D4', 'WRONG_CELL'],
  ])('%s -> %s', (cell, code) => {
    expect(checkAnswer(s, { cell })).toEqual({ correct: code === 'OK', code });
  });
});

describe('SELECT_RANGE', () => {
  const s = step({ ...base, type: 'SELECT_RANGE', check: { target: 'A2:B6' } });
  it.each([
    ['A2:B6', 'OK'],
    ['B6:A2', 'OK'],
    ['A6:B2', 'OK'],
    ['$a$2:b6', 'OK'],
    ['A2:B7', 'WRONG_CELL'],
    ['A1:B6', 'WRONG_CELL'],
    ['A2:A6', 'WRONG_CELL'],
  ])('%s -> %s', (range, code) => {
    expect(checkAnswer(s, { range }).code).toBe(code);
  });
});

describe('ENTER_VALUE', () => {
  const numeric = step({
    ...base,
    type: 'ENTER_VALUE',
    check: { target: 'D2', expected: 1250.5 },
  });
  it.each([
    ['1250.5', 'OK'],
    [' 1250.50 ', 'OK'],
    ['١٢٥٠٫٥', 'OK'],
    ['1,250.5', 'OK'],
    ['1250', 'WRONG_VALUE'],
    ['12,50.5', 'WRONG_VALUE'],
    ['ألف', 'WRONG_VALUE'],
    ['', 'WRONG_VALUE'],
    ['=1250.5', 'WRONG_VALUE'],
  ])('number: %s -> %s', (value, code) => {
    expect(checkAnswer(numeric, { cell: 'D2', value }).code).toBe(code);
  });

  it('reports the wrong cell before the value', () => {
    expect(checkAnswer(numeric, { cell: 'D3', value: '1250.5' }).code).toBe('WRONG_CELL');
  });

  it('applies the tolerance', () => {
    const s = step({
      ...base,
      type: 'ENTER_VALUE',
      check: { target: 'A1', expected: 3.14, tolerance: 0.01 },
    });
    expect(checkAnswer(s, { cell: 'A1', value: '3.141' }).code).toBe('OK');
    expect(checkAnswer(s, { cell: 'A1', value: '3.16' }).code).toBe('WRONG_VALUE');
  });

  it('accepts a percentage for a fraction', () => {
    const s = step({ ...base, type: 'ENTER_VALUE', check: { target: 'A1', expected: 0.05 } });
    expect(checkAnswer(s, { cell: 'A1', value: '5%' }).code).toBe('OK');
    expect(checkAnswer(s, { cell: 'A1', value: '٥٪' }).code).toBe('OK');
    expect(checkAnswer(s, { cell: 'A1', value: '0.05' }).code).toBe('OK');
  });

  const text = step({ ...base, type: 'ENTER_VALUE', check: { target: 'B2', expected: 'الرياض' } });
  it.each([
    ['الرياض', 'OK'],
    ['  الرياض ', 'OK'],
    ['الرّياض', 'OK'],
    ['الريـــاض', 'OK'],
    ['الدمام', 'WRONG_VALUE'],
  ])('text: %s -> %s', (value, code) => {
    expect(checkAnswer(text, { cell: 'B2', value }).code).toBe(code);
  });

  it('compares Latin text case-insensitively and collapses inner spaces', () => {
    const s = step({
      ...base,
      type: 'ENTER_VALUE',
      check: { target: 'B2', expected: 'Total Sales' },
    });
    expect(checkAnswer(s, { cell: 'B2', value: 'total   sales' }).code).toBe('OK');
  });

  const bool = step({ ...base, type: 'ENTER_VALUE', check: { target: 'B2', expected: true } });
  it.each([
    ['TRUE', 'OK'],
    ['true', 'OK'],
    ['صحيح', 'OK'],
    ['FALSE', 'WRONG_VALUE'],
    ['خطأ', 'WRONG_VALUE'],
    ['1', 'WRONG_VALUE'],
  ])('boolean: %s -> %s', (value, code) => {
    expect(checkAnswer(bool, { cell: 'B2', value }).code).toBe(code);
  });
});

describe('MULTIPLE_CHOICE', () => {
  const s = step({
    ...base,
    type: 'MULTIPLE_CHOICE',
    check: { options: ['SUM', 'COUNT', 'AVERAGE'], correct: 2 },
  });
  it.each([
    [2, 'OK'],
    [0, 'WRONG_VALUE'],
    [5, 'WRONG_VALUE'],
  ])('%s -> %s', (choice, code) => {
    expect(checkAnswer(s, { choice }).code).toBe(code);
  });
});

describe('SHORTCUT', () => {
  const s = step({
    ...base,
    type: 'SHORTCUT',
    check: {
      combos: [
        { win: 'Ctrl+Shift+L', mac: 'Cmd+Shift+F' },
        { win: 'Alt+Down', mac: 'Option+Down' },
      ],
    },
  });
  const press = (keys: Record<string, unknown>, platform: 'win' | 'mac' = 'win') =>
    checkAnswer(s, { keys, platform }).code;

  it.each<[string, Record<string, unknown>, 'win' | 'mac', string]>([
    ['exact win combo', { key: 'L', ctrlKey: true, shiftKey: true }, 'win', 'OK'],
    ['lower-case key', { key: 'l', ctrlKey: true, shiftKey: true }, 'win', 'OK'],
    [
      'Arabic layout, physical key',
      { key: 'م', code: 'KeyL', ctrlKey: true, shiftKey: true },
      'win',
      'OK',
    ],
    ['second combo, key alias', { key: 'ArrowDown', altKey: true }, 'win', 'OK'],
    ['mac combo', { key: 'f', metaKey: true, shiftKey: true }, 'mac', 'OK'],
    ['mac option alias', { key: 'ArrowDown', altKey: true }, 'mac', 'OK'],
    ['win combo on mac', { key: 'L', ctrlKey: true, shiftKey: true }, 'mac', 'WRONG_VALUE'],
    ['missing modifier', { key: 'L', ctrlKey: true }, 'win', 'WRONG_VALUE'],
    [
      'extra modifier',
      { key: 'L', ctrlKey: true, shiftKey: true, altKey: true },
      'win',
      'WRONG_VALUE',
    ],
    ['wrong key', { key: 'K', ctrlKey: true, shiftKey: true }, 'win', 'WRONG_VALUE'],
  ])('%s -> %s', (_name, keys, platform, code) => {
    expect(press(keys, platform)).toBe(code);
  });

  it('understands named and symbol keys', () => {
    const named = step({
      ...base,
      type: 'SHORTCUT',
      check: {
        combos: [
          { win: 'Ctrl+Enter', mac: 'Cmd+Return' },
          { win: 'Ctrl++', mac: 'Cmd+Plus' },
          { win: 'Esc', mac: 'Escape' },
          { win: 'Ctrl+Space', mac: 'Control+Space' },
          { win: 'F2', mac: 'Ctrl+U' },
          { win: 'Ctrl+1', mac: 'Cmd+1' },
        ],
      },
    });
    const ok = (keys: Record<string, unknown>, platform: 'win' | 'mac' = 'win') =>
      checkAnswer(named, { keys, platform }).correct;
    expect(ok({ key: 'Enter', ctrlKey: true })).toBe(true);
    expect(ok({ key: 'Enter', metaKey: true }, 'mac')).toBe(true);
    expect(ok({ key: '+', ctrlKey: true })).toBe(true);
    expect(ok({ key: '+', metaKey: true }, 'mac')).toBe(true);
    expect(ok({ key: 'Escape' })).toBe(true);
    expect(ok({ key: 'Escape' }, 'mac')).toBe(true);
    expect(ok({ key: ' ', ctrlKey: true })).toBe(true);
    expect(ok({ key: ' ', ctrlKey: true }, 'mac')).toBe(true);
    expect(ok({ key: 'F2' })).toBe(true);
    expect(ok({ key: 'u', ctrlKey: true }, 'mac')).toBe(true);
    expect(ok({ key: '١', code: 'Digit1', ctrlKey: true })).toBe(true);
    expect(ok({ key: 'Control', ctrlKey: true })).toBe(false);
  });
});

describe('answer validation', () => {
  const s = step({ ...base, type: 'SELECT_CELL', check: { target: 'C4' } });

  it('throws InvalidAnswerError for an answer of the wrong shape', () => {
    expect(() => checkAnswer(s, { range: 'A1:B2' })).toThrow(InvalidAnswerError);
    expect(() => checkAnswer(s, { cell: 'not a cell' })).toThrow(InvalidAnswerError);
    expect(() => checkAnswer(s, null)).toThrow(InvalidAnswerError);
  });
});

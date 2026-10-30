import { describe, expect, it } from 'vitest';
import { StepSpecSchema, type StepSpecInput } from '@tamreen/shared';
import { checkAnswer } from './index';
import { referenceAnswer } from './reference';

const base = { slug: 'step', promptAr: 'نص التعليمات' };

const steps: StepSpecInput[] = [
  { ...base, type: 'SELECT_CELL', check: { target: '$C$4' } },
  { ...base, type: 'SELECT_RANGE', check: { target: 'B6:A2' } },
  { ...base, type: 'ENTER_VALUE', check: { target: 'D2', expected: 1250.5 } },
  { ...base, type: 'ENTER_VALUE', check: { target: 'D2', expected: 'الرياض' } },
  { ...base, type: 'ENTER_VALUE', check: { target: 'D2', expected: false } },
  {
    ...base,
    type: 'ENTER_FORMULA',
    sheet: { visible: 'A1:B3', cells: { A1: 4, A2: 6 } },
    check: {
      target: 'A3',
      expected: { value: 10 },
      solution: '=SUM(A1:A2)',
      variants: [{ cells: { A1: 1 } }],
    },
  },
  { ...base, type: 'MULTIPLE_CHOICE', check: { options: ['أ', 'ب', 'ج'], correct: 1 } },
  {
    ...base,
    type: 'SHORTCUT',
    check: { combos: [{ win: 'Ctrl+Shift+L', mac: 'Cmd+Shift+F' }] },
  },
  { ...base, type: 'SHORTCUT', check: { combos: [{ win: 'Alt+Down', mac: 'Option+Down' }] } },
  { ...base, type: 'SHORTCUT', check: { combos: [{ win: 'Ctrl++', mac: 'Cmd++' }] } },
];

describe('referenceAnswer', () => {
  it.each(steps.map((s) => [s.type, s] as const))('%s: passes its own check', (_type, input) => {
    const step = StepSpecSchema.parse(input);
    expect(checkAnswer(step, referenceAnswer(step))).toEqual({ correct: true, code: 'OK' });
  });

  it('gives the Mac combo when asked', () => {
    const step = StepSpecSchema.parse(steps[7]);
    const answer = referenceAnswer(step, 'mac');
    expect(answer).toEqual({
      keys: { key: 'F', ctrlKey: false, shiftKey: true, altKey: false, metaKey: true },
      platform: 'mac',
    });
    expect(checkAnswer(step, answer).correct).toBe(true);
  });

  it('writes the formula and the cell in their canonical form', () => {
    expect(referenceAnswer(StepSpecSchema.parse(steps[0]))).toEqual({ cell: 'C4' });
    expect(referenceAnswer(StepSpecSchema.parse(steps[1]))).toEqual({ range: 'A2:B6' });
    expect(referenceAnswer(StepSpecSchema.parse(steps[4]))).toEqual({ cell: 'D2', value: 'FALSE' });
  });
});

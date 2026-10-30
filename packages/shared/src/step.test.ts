import { describe, expect, it } from 'vitest';
import { StepSpecSchema, type StepSpecInput } from './step';
import { AnswerSchemas, AttemptRequestSchema } from './attempt';
import { FEEDBACK_CODES } from './feedback';

const sumifStep: StepSpecInput = {
  slug: 'sumif-basics-03',
  type: 'ENTER_FORMULA',
  promptAr: 'اكتب في الخلية D2 معادلة تجمع مبيعات المنتج «قلم» فقط.',
  sheet: {
    visible: 'A1:D8',
    cells: { A1: 'المنتج', B1: 'المبيعات', A2: 'قلم', B2: 120 },
    formats: { 'B2:B8': 'number' },
  },
  check: {
    target: 'D2',
    expected: { value: 120 },
    solution: '=SUMIF(A2:A8,"قلم",B2:B8)',
    mustUseFunctions: ['SUMIF'],
    variants: [{ cells: { B2: 10 } }],
  },
};

describe('StepSpecSchema', () => {
  it('parses an ENTER_FORMULA step and fills defaults', () => {
    const step = StepSpecSchema.parse(sumifStep);
    expect(step.basePoints).toBe(300);
    expect(step.type === 'ENTER_FORMULA' && step.check.acceptEquivalentRefs).toBe(true);
  });

  it.each<[string, StepSpecInput]>([
    ['SELECT_CELL', { slug: 'a', type: 'SELECT_CELL', promptAr: 'اختر', check: { target: 'B2' } }],
    [
      'SELECT_RANGE',
      { slug: 'b', type: 'SELECT_RANGE', promptAr: 'حدد', check: { target: '$A$1:B3' } },
    ],
    [
      'ENTER_VALUE',
      {
        slug: 'c',
        type: 'ENTER_VALUE',
        promptAr: 'اكتب',
        check: { target: 'C3', expected: 12.5, tolerance: 0.01 },
      },
    ],
    [
      'MULTIPLE_CHOICE',
      {
        slug: 'd',
        type: 'MULTIPLE_CHOICE',
        promptAr: 'اختر',
        check: { options: ['أ', 'ب'], correct: 1 },
      },
    ],
    [
      'SHORTCUT',
      {
        slug: 'e',
        type: 'SHORTCUT',
        promptAr: 'اضغط',
        check: {
          combos: [
            { win: 'Ctrl+Shift+L', mac: 'Cmd+Shift+F' },
            { win: 'Ctrl++', mac: 'Cmd++' },
          ],
        },
      },
    ],
  ])('accepts a valid %s step', (_type, input) => {
    expect(StepSpecSchema.safeParse(input).success).toBe(true);
  });

  it.each<[string, unknown]>([
    ['unknown type', { ...sumifStep, type: 'PIVOT' }],
    ['empty prompt', { ...sumifStep, promptAr: '   ' }],
    ['non-kebab slug', { ...sumifStep, slug: 'Sumif Basics' }],
    ['bad target', { ...sumifStep, check: { ...sumifStep.check, target: 'D0' } }],
    ['solution without "="', { ...sumifStep, check: { ...sumifStep.check, solution: 'SUM(A1)' } }],
    [
      'lower-case function name',
      { ...sumifStep, check: { ...sumifStep.check, mustUseFunctions: ['sumif'] } },
    ],
    ['formula step without a sheet', { ...sumifStep, sheet: undefined }],
    ['bad visible range', { ...sumifStep, sheet: { ...sumifStep.sheet, visible: 'A1' } }],
    ['bad cell key', { ...sumifStep, sheet: { visible: 'A1:B2', cells: { 'A-1': 1 } } }],
    ['infinite number', { ...sumifStep, sheet: { visible: 'A1:B2', cells: { A1: Infinity } } }],
    [
      'unknown format',
      { ...sumifStep, sheet: { visible: 'A1:B2', cells: {}, formats: { A1: 'colour' } } },
    ],
    [
      'choice out of range',
      {
        slug: 'd',
        type: 'MULTIPLE_CHOICE',
        promptAr: 'اختر',
        check: { options: ['أ', 'ب'], correct: 2 },
      },
    ],
    [
      'single option',
      {
        slug: 'd',
        type: 'MULTIPLE_CHOICE',
        promptAr: 'اختر',
        check: { options: ['أ'], correct: 0 },
      },
    ],
    [
      'malformed combo',
      {
        slug: 'e',
        type: 'SHORTCUT',
        promptAr: 'اضغط',
        check: { combos: [{ win: 'Ctrl Shift', mac: 'x' }] },
      },
    ],
    [
      'negative tolerance',
      {
        slug: 'c',
        type: 'ENTER_VALUE',
        promptAr: 'اكتب',
        check: { target: 'C3', expected: 1, tolerance: -1 },
      },
    ],
  ])('rejects %s', (_name, input) => {
    expect(StepSpecSchema.safeParse(input).success).toBe(false);
  });
});

describe('answers and attempts', () => {
  it('validates each answer shape', () => {
    expect(AnswerSchemas.SELECT_CELL.safeParse({ cell: 'b2' }).success).toBe(true);
    expect(AnswerSchemas.SELECT_RANGE.safeParse({ range: 'A1:B3' }).success).toBe(true);
    expect(AnswerSchemas.SELECT_RANGE.safeParse({ range: 'A1' }).success).toBe(false);
    expect(
      AnswerSchemas.ENTER_FORMULA.safeParse({ cell: 'D2', formula: 'x'.repeat(2001) }).success,
    ).toBe(false);
    expect(AnswerSchemas.MULTIPLE_CHOICE.safeParse({ choice: -1 }).success).toBe(false);
    const shortcut = AnswerSchemas.SHORTCUT.parse({
      keys: { key: 'l', ctrlKey: true },
      platform: 'win',
    });
    expect(shortcut.keys.shiftKey).toBe(false);
  });

  it('rejects a client-supplied "correct" flag', () => {
    const clean = { stepId: 's1', answer: { cell: 'A1' }, timeMs: 1200 };
    expect(AttemptRequestSchema.safeParse({ ...clean, correct: true }).success).toBe(false);
    expect(AttemptRequestSchema.safeParse(clean).success).toBe(true);
  });

  it('lists the twelve feedback codes from PLAN §3.5', () => {
    expect(FEEDBACK_CODES).toHaveLength(12);
  });
});

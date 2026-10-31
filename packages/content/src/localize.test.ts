import { describe, expect, it } from 'vitest';
import {
  FunctionFileSchema,
  LessonFileSchema,
  type FunctionFileInput,
  type LessonFileInput,
  type LessonTranslation,
} from '@tamreen/shared';
import { checkAnswer, referenceAnswer, verifyReferenceSolution } from '@tamreen/engine';
import { localizeFunction, localizeLesson, localizeTracks, translateString } from './localize';

const lesson = LessonFileSchema.parse({
  slug: 'sumif-basics',
  track: 'conditional',
  order: 1,
  kind: 'CONCEPT',
  titleAr: 'الجمع بشرط',
  summaryAr: 'ملخص',
  minutes: 4,
  introAr: 'شرح',
  faq: [{ qAr: 'سؤال؟', aAr: 'جواب.' }],
  steps: [
    {
      slug: 'north',
      type: 'ENTER_FORMULA',
      promptAr: 'اجمع مبيعات الشمال.',
      hintAr: 'استخدم SUMIF.',
      sheet: {
        visible: 'A1:C4',
        cells: { A1: 'المنطقة', B1: 'المبيعات', A2: 'الشمال', B2: 10, A3: 'الجنوب', B3: 5, A4: 'الشمال', B4: 7 },
      },
      check: {
        target: 'C2',
        expected: { value: 17 },
        solution: '=SUMIF(A2:A4,"الشمال",B2:B4)',
        variants: [{ cells: { A3: 'الشمال' } }],
      },
    },
    {
      slug: 'pick',
      type: 'MULTIPLE_CHOICE',
      promptAr: 'اختر.',
      check: { options: ['الأول', 'الثاني'], correct: 1 },
    },
    {
      slug: 'type-name',
      type: 'ENTER_VALUE',
      promptAr: 'اكتب اسم المنطقة.',
      sheet: { visible: 'A1:A2', cells: { A1: 'المنطقة' } },
      check: { target: 'A2', expected: 'الجنوب' },
    },
  ],
} satisfies LessonFileInput);

const en: LessonTranslation = {
  slug: 'sumif-basics',
  title: 'Conditional sums',
  summary: 'Summary',
  intro: 'Explanation',
  faq: [{ q: 'Question?', a: 'Answer.' }],
  strings: { المنطقة: 'Region', المبيعات: 'Sales', الشمال: 'North', الجنوب: 'South' },
  steps: {
    north: { prompt: 'Add up the North sales.', hint: 'Use SUMIF.' },
    pick: { prompt: 'Pick one.', options: ['First', 'Second'] },
    'type-name': { prompt: 'Type the region name.' },
  },
};

describe('translateString', () => {
  const strings = { الشمال: 'North', 'قلم "أزرق"': 'Blue "pen"' };
  it('replaces a whole cell value and quoted literals inside formulas only', () => {
    expect(translateString('الشمال', strings)).toBe('North');
    expect(translateString('الشمال الغربي', strings)).toBe('الشمال الغربي');
    expect(translateString('=SUMIF(A:A,"الشمال",B:B)&"الشمال"', strings)).toBe(
      '=SUMIF(A:A,"North",B:B)&"North"',
    );
    expect(translateString('=COUNTIF(A:A,"الشمالي")', strings)).toBe('=COUNTIF(A:A,"الشمالي")');
  });
});

describe('localizeLesson', () => {
  const out = localizeLesson(lesson, en);

  it('replaces the page and step text', () => {
    expect(out.titleAr).toBe('Conditional sums');
    expect(out.introAr).toBe('Explanation');
    expect(out.faq).toEqual([{ qAr: 'Question?', aAr: 'Answer.' }]);
    expect(out.steps[0]).toMatchObject({ promptAr: 'Add up the North sales.', hintAr: 'Use SUMIF.' });
    expect(out.steps[1]!.check).toMatchObject({ options: ['First', 'Second'], correct: 1 });
  });

  it('translates sheet text, solutions, variants and expected text, and stays solvable', () => {
    const step = out.steps[0]!;
    if (step.type !== 'ENTER_FORMULA') throw new Error('expected a formula step');
    expect(step.sheet.cells).toMatchObject({ A1: 'Region', A2: 'North', B2: 10, A3: 'South' });
    expect(step.check.solution).toBe('=SUMIF(A2:A4,"North",B2:B4)');
    expect(step.check.variants).toEqual([{ cells: { A3: 'North' } }]);
    expect(verifyReferenceSolution(step).correct).toBe(true);

    const value = out.steps[2]!;
    expect(value.check).toMatchObject({ expected: 'South' });
    expect(checkAnswer(value, referenceAnswer(value)).correct).toBe(true);
  });

  it('leaves the source untouched', () => {
    expect(lesson.titleAr).toBe('الجمع بشرط');
    expect(lesson.steps[0]!.sheet!.cells.A2).toBe('الشمال');
  });

  it('refuses a translation that misses a step or does not match the options', () => {
    const rest = Object.fromEntries(Object.entries(en.steps).filter(([slug]) => slug !== 'pick'));
    expect(() => localizeLesson(lesson, { ...en, steps: rest })).toThrow(/step "pick"/);
    expect(() =>
      localizeLesson(lesson, { ...en, steps: { ...en.steps, pick: { prompt: 'x', options: ['a'] } } }),
    ).toThrow(/options/);
    expect(() => localizeLesson(lesson, { ...en, faq: [] })).toThrow(/faq/);
  });
});

describe('localizeFunction', () => {
  const fn = FunctionFileSchema.parse({
    name: 'SUMIF',
    slug: 'sumif',
    category: 'conditional',
    order: 1,
    titleAr: 'الدالة SUMIF',
    summaryAr: 'ملخص',
    introAr: 'شرح',
    syntax: 'SUMIF(range, criteria, [sum_range])',
    args: [{ name: 'range', descAr: 'النطاق' }],
    examples: [
      {
        sheet: { visible: 'A1:B2', cells: { A1: 'الشمال', B1: 4, A2: 'الجنوب', B2: 6 } },
        formula: '=SUMIF(A1:A2,"الشمال",B1:B2)',
        result: 4,
        explainAr: 'يجمع الشمال.',
      },
    ],
    errors: [{ code: '#VALUE!', causeAr: 'سبب' }],
    lessons: ['sumif-basics'],
    faq: [{ qAr: 'سؤال؟', aAr: 'جواب.' }],
  } satisfies FunctionFileInput);

  it('replaces text by position and translates example sheets and formulas', () => {
    const out = localizeFunction(fn, {
      slug: 'sumif',
      title: 'The SUMIF function',
      summary: 'Summary',
      intro: 'Intro',
      localName: 'SOMME.SI',
      args: ['The range'],
      examples: ['Adds North.'],
      errors: ['Cause'],
      faq: [{ q: 'Q?', a: 'A.' }],
      strings: { الشمال: 'North', الجنوب: 'South' },
    });
    expect(out.titleAr).toBe('The SUMIF function');
    expect(out.args[0]).toMatchObject({ name: 'range', descAr: 'The range' });
    expect(out.examples[0]).toMatchObject({
      formula: '=SUMIF(A1:A2,"North",B1:B2)',
      explainAr: 'Adds North.',
      sheet: { cells: { A1: 'North', A2: 'South' } },
    });
    expect(out.errors[0]).toEqual({ code: '#VALUE!', causeAr: 'Cause' });
  });
});

describe('localizeTracks', () => {
  it('replaces titles and keeps order', () => {
    const tracks = [{ slug: 'basics', titleAr: 'الأساسيات', order: 1 }];
    expect(localizeTracks(tracks, { basics: 'Basics' })).toEqual([
      { slug: 'basics', titleAr: 'Basics', order: 1 },
    ]);
    expect(() => localizeTracks(tracks, {})).toThrow(/basics/);
  });
});

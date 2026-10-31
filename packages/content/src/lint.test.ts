import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { LessonFileInput, StepSpecInput } from '@tamreen/shared';
import { formatIssue, lintContent, reviewedSlugs, type LintIssue } from './lint';
import { loadCurriculum, readContent, type RawContent } from './load';

const sheet = {
  visible: 'A1:C6',
  cells: { A1: 'الصنف', B1: 'الكمية', A2: 'قلم', B2: 10, A3: 'دفتر', B3: 20, A4: 'قلم', B4: 5 },
};

const formulaStep = (slug: string, check: Record<string, unknown> = {}): StepSpecInput => ({
  slug,
  type: 'ENTER_FORMULA',
  promptAr: `اكتب معادلة الجمع في الخلية C2 (${slug}).`,
  sheet,
  check: {
    target: 'C2',
    expected: { value: 35 },
    solution: '=SUM(B2:B4)',
    variants: [{ cells: { B2: 1 } }],
    ...check,
  },
});

const choiceStep = (slug: string): Extract<StepSpecInput, { type: 'MULTIPLE_CHOICE' }> => ({
  slug,
  type: 'MULTIPLE_CHOICE',
  promptAr: `اختر الإجابة الصحيحة (${slug}).`,
  check: { options: ['أ', 'ب'], correct: 0 },
});

const goodLesson = (overrides: Partial<LessonFileInput> = {}): LessonFileInput => ({
  slug: 'sum-basics',
  track: 'aggregation',
  order: 1,
  kind: 'CONCEPT',
  titleAr: 'الجمع',
  summaryAr: 'ملخص الدرس',
  minutes: 4,
  introAr: 'شرح قصير للدرس.',
  faq: [
    { qAr: 'سؤال أول؟', aAr: 'جواب أول.' },
    { qAr: 'سؤال ثان؟', aAr: 'جواب ثان.' },
  ],
  steps: [
    formulaStep('s1'),
    formulaStep('s2'),
    choiceStep('s3'),
    choiceStep('s4'),
    choiceStep('s5'),
  ],
  ...overrides,
});

function content(lessons: LessonFileInput[], extra: Partial<RawContent> = {}): RawContent {
  return {
    lessons: lessons.map((l) => ({ path: `lessons/${l.track}/${l.slug}.json`, json: l })),
    tracks: { path: 'tracks.json', json: [{ slug: 'aggregation', titleAr: 'الجمع', order: 1 }] },
    glossary: { path: 'glossary.json', json: { خلية: 'cell', معادلة: 'formula' } },
    style: { path: 'style.json', json: { avoid: { صيغة: 'معادلة', 'ورقة البيانات': 'ورقة عمل' } } },
    ...extra,
  };
}

const messages = (issues: LintIssue[]) => issues.map((i) => i.message);
const lint = (lessons: LessonFileInput[], extra?: Partial<RawContent>, guide?: string) =>
  lintContent(content(lessons, extra), { contentGuide: guide });

describe('lintContent', () => {
  it('passes a good lesson', () => {
    expect(lint([goodLesson()])).toEqual([]);
  });

  it('reports schema errors with their path', () => {
    const issues = lint([goodLesson({ minutes: 0 })]);
    expect(issues[0]).toMatchObject({ file: 'lessons/aggregation/sum-basics.json' });
    expect(issues[0]!.message).toMatch(/^minutes:/);
  });

  it('reports unreadable files and bad support files', () => {
    const issues = lintContent({
      ...content([]),
      lessons: [{ path: 'lessons/x/y.json', error: 'Unexpected token' }],
      tracks: { path: 'tracks.json', json: [] },
    });
    expect(messages(issues).sort()).toEqual([
      '(root): Too small: expected array to have >=1 items',
      'cannot read: Unexpected token',
    ]);
  });

  it.each<[string, LessonFileInput, RegExp]>([
    [
      'file in the wrong place',
      { ...goodLesson(), track: 'logic' },
      /must live at lessons\/logic|unknown track/,
    ],
    ['too few steps', goodLesson({ steps: [formulaStep('s1')] }), /has 1 steps; lessons have 5–8/],
    [
      'unsolvable step',
      goodLesson({
        steps: [formulaStep('s1', { expected: { value: 99 } }), ...goodLesson().steps.slice(1)],
      }),
      /reference answer fails its own check \(WRONG_VALUE\)/,
    ],
    [
      'unsupported function',
      goodLesson({
        steps: [
          formulaStep('s1', { solution: '=SUM(B2:B4)+MEDIAN(B2:B4)', expected: { value: 45 } }),
          ...goodLesson().steps.slice(1),
        ],
      }),
      /unsupported functions: MEDIAN/,
    ],
    [
      'required function the solution does not use',
      goodLesson({
        steps: [formulaStep('s1', { mustUseFunctions: ['SUMIF'] }), ...goodLesson().steps.slice(1)],
      }),
      /mustUseFunctions not in the solution: SUMIF/,
    ],
    [
      'no variants',
      goodLesson({
        steps: [formulaStep('s1', { variants: undefined }), ...goodLesson().steps.slice(1)],
      }),
      /has no variant/,
    ],
    [
      'variants that change nothing',
      goodLesson({
        steps: [
          formulaStep('s1', { variants: [{ cells: { A2: 'x' } }] }),
          ...goodLesson().steps.slice(1),
        ],
      }),
      /no variant changes the solution result/,
    ],
    [
      'target outside the visible range',
      goodLesson({
        steps: [
          { slug: 's1', type: 'SELECT_CELL', promptAr: 'اختر', sheet, check: { target: 'H9' } },
          ...goodLesson().steps.slice(1),
        ],
      }),
      /target H9 is outside the visible range A1:C6/,
    ],
    [
      'unknown glossary term',
      goodLesson({
        steps: [
          { ...choiceStep('s1'), promptAr: 'ما {{الجدول}}؟' },
          ...goodLesson().steps.slice(1),
        ],
      }),
      /glossary term \{\{الجدول\}\} is not in glossary.json/,
    ],
    [
      'discouraged word, even with a prefix',
      goodLesson({
        steps: [{ ...choiceStep('s1'), hintAr: 'اكتب بالصيغة' }, ...goodLesson().steps.slice(1)],
      }),
      /avoid "صيغة"; use "معادلة"/,
    ],
    [
      'discouraged phrase in an option',
      goodLesson({
        steps: [
          { ...choiceStep('s1'), check: { options: ['ورقة البيانات', 'ب'], correct: 1 } },
          ...goodLesson().steps.slice(1),
        ],
      }),
      /avoid "ورقة البيانات"/,
    ],
    [
      'published without review',
      goodLesson({ status: 'PUBLISHED' }),
      /PUBLISHED, but not in the review log/,
    ],
  ])('rejects %s', (_name, lesson, pattern) => {
    expect(
      messages(lint([lesson])).some((m) => pattern.test(m)),
      messages(lint([lesson])).join('\n'),
    ).toBe(true);
  });

  it('allows words that only contain a discouraged word', () => {
    const lesson = goodLesson({
      steps: [
        { ...choiceStep('s1'), promptAr: 'صيغتها مختلفة وصيغ كثيرة' },
        ...goodLesson().steps.slice(1),
      ],
    });
    expect(lint([lesson])).toEqual([]);
  });

  it('rejects duplicated slugs, orders and prompts across lessons', () => {
    const other = goodLesson({ slug: 'sum-more', titleAr: 'المزيد' });
    const issues = messages(lint([goodLesson(), other]));
    expect(issues).toContain('order 1 also used by lessons/aggregation/sum-basics.json');
    expect(issues.filter((m) => m.startsWith('prompt duplicates'))).toHaveLength(5);
    const twin = lint([goodLesson(), goodLesson()]);
    expect(messages(twin)).toContain(
      'lesson slug "sum-basics" also used by lessons/aggregation/sum-basics.json',
    );
  });

  it('accepts a published lesson listed in the review log', () => {
    const guide =
      '# Content\n\n## Review log\n\n| Lesson | Reviewer | Date |\n|---|---|---|\n| `sum-basics` | س. | 2026-11-02 |\n';
    expect(lint([goodLesson({ status: 'PUBLISHED' })], undefined, guide)).toEqual([]);
    expect(reviewedSlugs('## Other\n`sum-basics`')).toEqual(new Set());
  });

  it('formats issues as file:step — message', () => {
    expect(formatIssue({ file: 'a.json', step: 's1', message: 'bad' })).toBe('a.json:s1 — bad');
    expect(formatIssue({ file: 'a.json', message: 'bad' })).toBe('a.json — bad');
  });
});

describe('lesson page text', () => {
  it('requires an intro and at least two FAQ entries', () => {
    const issues = messages(
      lint([goodLesson({ introAr: undefined, faq: [{ qAr: 'س؟', aAr: 'ج.' }] })]),
    );
    expect(issues).toContain('missing introAr (the explanation shown above the player)');
    expect(issues).toContain('needs at least 2 faq entries');
  });

  it('applies the style rules to the intro and FAQ', () => {
    const issues = messages(lint([goodLesson({ introAr: 'اكتب الصيغة هنا.' })]));
    expect(issues).toContain('avoid "صيغة"; use "معادلة"');
  });
});

describe('function pages', () => {
  const goodFunction = (overrides: Record<string, unknown> = {}) => ({
    name: 'SUM',
    slug: 'sum',
    category: 'aggregation',
    order: 1,
    titleAr: 'الدالة SUM',
    summaryAr: 'تجمع الأرقام.',
    introAr: 'شرح الدالة.',
    syntax: 'SUM(number1, [number2], ...)',
    args: [{ name: 'number1', descAr: 'أول رقم أو نطاق.' }],
    examples: [
      {
        sheet: { visible: 'A1:A3', cells: { A1: 2, A2: 3 } },
        formula: '=SUM(A1:A3)',
        result: 5,
        explainAr: 'تجمع الخليتين.',
      },
    ],
    errors: [{ code: '#VALUE!', causeAr: 'نص لا يمكن تحويله.' }],
    lessons: ['sum-basics'],
    faq: [{ qAr: 'هل تجمع النصوص؟', aAr: 'لا.' }],
    ...overrides,
  });
  const withFunctions = (...fns: Record<string, unknown>[]) =>
    lintContent(
      content([goodLesson()], {
        functions: fns.map((f) => ({ path: `functions/${f.slug}.json`, json: f })),
      }),
    );

  it('passes a good function page', () => {
    expect(withFunctions(goodFunction())).toEqual([]);
  });

  it.each<[string, Record<string, unknown>, RegExp]>([
    [
      'a wrong example result',
      { examples: [{ ...goodFunction().examples[0], result: 6 }] },
      /gives 5, not 6/,
    ],
    [
      'an example that does not use the function',
      { examples: [{ ...goodFunction().examples[0], formula: '=A1+A2' }] },
      /does not use SUM/,
    ],
    ['an unknown lesson link', { lessons: ['nope'] }, /links to unknown lesson "nope"/],
    ['a file in the wrong place', { slug: 'other' }, /must live at functions\/other.json/],
    ['a lower-case name', { name: 'sum' }, /^name:/],
  ])('rejects %s', (_name, overrides, pattern) => {
    const fn = goodFunction(overrides);
    const issues = lintContent(
      content([goodLesson()], { functions: [{ path: 'functions/sum.json', json: fn }] }),
    );
    expect(
      messages(issues).some((m) => pattern.test(m)),
      messages(issues).join('\n'),
    ).toBe(true);
  });

  it('skips the check for examples marked unverified', () => {
    const example = {
      formula: '=SUM(TODAY())',
      result: 45000,
      explainAr: 'مثال.',
      verified: false,
    };
    expect(withFunctions(goodFunction({ examples: [example] }))).toEqual([]);
  });

  it('rejects two pages for the same function', () => {
    const issues = withFunctions(goodFunction(), goodFunction({ slug: 'sum-copy', order: 2 }));
    expect(messages(issues)).toContain('name:SUM also used by functions/sum.json');
  });
});

describe('translations', () => {
  const strings = { الصنف: 'Item', الكمية: 'Quantity', قلم: 'Pen', دفتر: 'Notebook' };
  const choice = { prompt: 'Pick the right answer.', options: ['A', 'B'] };
  const enLesson = (overrides: Record<string, unknown> = {}) => ({
    slug: 'sum-basics',
    title: 'Sums',
    summary: 'Lesson summary',
    intro: 'A short explanation.',
    faq: [
      { q: 'First question?', a: 'First answer.' },
      { q: 'Second question?', a: 'Second answer.' },
    ],
    strings,
    steps: {
      s1: { prompt: 'Write the sum in C2 (s1).' },
      s2: { prompt: 'Write the sum in C2 (s2).' },
      s3: choice,
      s4: choice,
      s5: choice,
    },
    ...overrides,
  });
  const lintEn = (
    lessons: Record<string, unknown>[],
    base: LessonFileInput[] = [goodLesson()],
    tracks: unknown = { aggregation: 'Sums' },
  ) =>
    messages(
      lintContent(
        content(base, {
          translations: [
            {
              locale: 'en',
              lessons: lessons.map((l) => ({ path: `i18n/en/lessons/${l.slug}.json`, json: l })),
              functions: [],
              tracks: { path: 'i18n/en/tracks.json', json: tracks },
            },
          ],
        }),
      ),
    );

  it('passes a complete translation', () => {
    expect(lintEn([enLesson()])).toEqual([]);
  });

  it('requires every lesson and track in each translated language', () => {
    expect(lintEn([])).toContain('no en translation (i18n/en/lessons/sum-basics.json)');
    expect(lintEn([enLesson()], undefined, {})).toEqual(
      expect.arrayContaining([expect.stringMatching(/track "aggregation"/)]),
    );
  });

  it.each<[string, Record<string, unknown>, RegExp]>([
    ['Arabic left untranslated', { strings: { ...strings, دفتر: undefined } }, /Arabic text left/],
    ['glossary markup', { title: 'The {{cell}}' }, /\{\{…\}\} markup/],
    ['a missing step', { steps: { s1: { prompt: 'x' } } }, /no translation for step "s2"/],
    ['an unknown lesson', { slug: 'nope' }, /no lesson "nope"/],
  ])('rejects %s', (_name, overrides, pattern) => {
    const lesson = JSON.parse(JSON.stringify(enLesson(overrides)));
    const issues = lintEn([lesson]);
    expect(issues.some((m) => pattern.test(m)), issues.join('\n')).toBe(true);
  });

  it('proves the translated steps are still solvable', () => {
    // Two products translated to the same word change the SUMIF result.
    const sumif = goodLesson({
      steps: [
        formulaStep('s1', { expected: { value: 15 }, solution: '=SUMIF(A2:A4,"قلم",B2:B4)' }),
        formulaStep('s2'),
        choiceStep('s3'),
        choiceStep('s4'),
        choiceStep('s5'),
      ],
    });
    const issues = lintEn([enLesson({ strings: { ...strings, دفتر: 'Pen' } })], [sumif]);
    expect(issues.some((m) => /does not verify/.test(m)), issues.join('\n')).toBe(true);
  });
});

describe('the real curriculum', () => {
  const dir = path.resolve(import.meta.dirname, '../../../content');

  it('passes content:lint', async () => {
    const guide = await readFile(path.resolve(dir, '../docs/CONTENT.md'), 'utf8');
    const issues = lintContent(await readContent(dir), { contentGuide: guide });
    expect(issues.map(formatIssue)).toEqual([]);
  });

  it('loads in curriculum order', async () => {
    const { lessons, tracks } = await loadCurriculum(dir);
    expect(lessons.map((l) => l.order)).toEqual(
      [...lessons.map((l) => l.order)].sort((a, b) => a - b),
    );
    expect(tracks[0]!.slug).toBe('basics');
  });
});

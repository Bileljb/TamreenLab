import { describe, expect, it } from 'vitest';
import { GlossarySchema, LessonFileSchema, glossaryTermKey, type LessonFileInput } from './lesson';
import { GuestProgressSchema, emptyGuestProgress } from './progress';

describe('glossaryTermKey', () => {
  it.each([
    ['خلية', 'خلية'],
    ['الخلية', 'خلية'],
    [' مرجعًا ', 'مرجع'],
    ['نطاقاً', 'نطاق'],
    ['المرجعَ', 'مرجع'],
    ['مربع الاسم', 'مربع الاسم'],
    ['ورقة عمل', 'ورقة عمل'],
  ])('%s -> %s', (term, key) => {
    expect(glossaryTermKey(term)).toBe(key);
  });
});

const lesson: LessonFileInput = {
  slug: 'cells-and-selection',
  track: 'basics',
  order: 1,
  kind: 'CONCEPT',
  titleAr: 'الخلايا والتحديد',
  summaryAr: 'تعرّف على الخلية والنطاق.',
  minutes: 4,
  steps: [
    { slug: 'pick-b2', type: 'SELECT_CELL', promptAr: 'اختر الخلية B2.', check: { target: 'B2' } },
    {
      slug: 'pick-range',
      type: 'SELECT_RANGE',
      promptAr: 'حدد النطاق A1:B3.',
      check: { target: 'A1:B3' },
    },
  ],
};

describe('LessonFileSchema', () => {
  it('accepts a lesson and fills step defaults', () => {
    const parsed = LessonFileSchema.parse(lesson);
    expect(parsed.steps[0]!.basePoints).toBe(300);
  });

  it.each<[string, unknown]>([
    ['no steps', { ...lesson, steps: [] }],
    ['unknown kind', { ...lesson, kind: 'QUIZ' }],
    ['bad track slug', { ...lesson, track: 'Basics' }],
    ['zero minutes', { ...lesson, minutes: 0 }],
    ['duplicate step slugs', { ...lesson, steps: [lesson.steps[0], lesson.steps[0]] }],
  ])('rejects %s', (_name, input) => {
    expect(LessonFileSchema.safeParse(input).success).toBe(false);
  });
});

describe('GlossarySchema', () => {
  it('maps Arabic terms to English ones', () => {
    expect(GlossarySchema.safeParse({ خلية: 'cell' }).success).toBe(true);
    expect(GlossarySchema.safeParse({ خلية: '' }).success).toBe(false);
  });
});

describe('GuestProgressSchema', () => {
  it('parses stored progress and fills defaults', () => {
    const parsed = GuestProgressSchema.parse({
      version: 1,
      lessons: { 'sum-basics': { stepsDone: ['a'], points: 420 } },
    });
    expect(parsed.lessons['sum-basics']!.firstTry).toEqual([]);
    expect(GuestProgressSchema.parse({ version: 1 })).toEqual(emptyGuestProgress());
  });

  it.each<[string, unknown]>([
    ['another version', { version: 2, lessons: {} }],
    ['negative points', { version: 1, lessons: { a: { points: -5 } } }],
    ['bad date', { version: 1, lessons: { a: { completedAt: 'yesterday' } } }],
    ['garbage', 'not json'],
  ])('rejects %s', (_name, input) => {
    expect(GuestProgressSchema.safeParse(input).success).toBe(false);
  });
});

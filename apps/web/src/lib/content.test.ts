import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { checkAnswer, referenceAnswer, verifyReferenceSolution } from '@tamreen/engine';
import { getGlossary, getLesson, listLessons } from './content';

const dir = path.resolve(import.meta.dirname, '../../../../content');

describe('content', () => {
  it('loads the lessons in curriculum order', async () => {
    const lessons = await listLessons(dir);
    expect(lessons.map((l) => `${l.track}/${l.slug}`)).toEqual([
      'basics/cells-and-selection',
      'aggregation/sum-basics',
    ]);
  });

  it('finds a lesson and the one after it', async () => {
    const found = await getLesson('basics', 'cells-and-selection', dir);
    expect(found?.next?.slug).toBe('sum-basics');
    expect((await getLesson('aggregation', 'sum-basics', dir))?.next).toBeNull();
    expect(await getLesson('basics', 'nope', dir)).toBeNull();
  });

  it('every step is solvable: its reference answer passes its own check', async () => {
    for (const lesson of await listLessons(dir)) {
      for (const step of lesson.steps) {
        const label = `${lesson.slug}/${step.slug}`;
        expect(checkAnswer(step, referenceAnswer(step)), label).toEqual({
          correct: true,
          code: 'OK',
        });
        if (step.type === 'ENTER_FORMULA')
          expect(verifyReferenceSolution(step).code, label).toBe('OK');
      }
    }
  });

  it('a hard-coded total fails the SUM steps', async () => {
    const found = await getLesson('aggregation', 'sum-basics', dir);
    const step = found!.lesson.steps.find((s) => s.slug === 'no-hard-coding')!;
    expect(checkAnswer(step, { cell: 'B7', formula: '=450' }).code).toBe('HARDCODED_VALUE');
  });

  it('every glossary term used in a prompt exists in the glossary', async () => {
    const glossary = await getGlossary(dir);
    for (const lesson of await listLessons(dir)) {
      for (const step of lesson.steps) {
        for (const [, term] of step.promptAr.matchAll(/\{\{(.+?)\}\}/g)) {
          const known = term! in glossary || term!.replace(/^ال/, '') in glossary;
          expect(known, `${lesson.slug}/${step.slug}: ${term}`).toBe(true);
        }
      }
    }
  });
});

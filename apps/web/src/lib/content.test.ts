import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { getGlossary, getLesson, listLessons } from './content';

// Content rules are tested in packages/content (content:lint); this covers the site's lookups.
const dir = path.resolve(import.meta.dirname, '../../../../content');

describe('site content lookups', () => {
  it('lists lessons in curriculum order', async () => {
    const lessons = await listLessons(dir);
    expect(lessons[0]!.slug).toBe('cells-and-selection');
    expect(lessons.map((l) => l.order)).toEqual(
      [...lessons.map((l) => l.order)].sort((a, b) => a - b),
    );
  });

  it('finds a lesson and the one after it', async () => {
    const lessons = await listLessons(dir);
    const found = await getLesson(lessons[0]!.track, lessons[0]!.slug, dir);
    expect(found?.next?.slug).toBe(lessons[1]?.slug);
    const last = lessons.at(-1)!;
    expect((await getLesson(last.track, last.slug, dir))?.next).toBeNull();
    expect(await getLesson('basics', 'nope', dir)).toBeNull();
  });

  it('loads the glossary', async () => {
    expect((await getGlossary(dir))['خلية']).toBe('cell');
  });
});

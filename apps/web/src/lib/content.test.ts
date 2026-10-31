import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { getFunction, getGlossary, getLesson, listLessons, listTracks } from './content';
import { inLocale, languageAlternates } from './seo';

// Content rules are tested in packages/content (content:lint); this covers the site's lookups.
const dir = path.resolve(import.meta.dirname, '../../../../content');

describe('site content lookups', () => {
  it('lists lessons in curriculum order', async () => {
    const lessons = await listLessons('ar', dir);
    expect(lessons[0]!.slug).toBe('cells-and-selection');
    expect(lessons.map((l) => l.order)).toEqual(
      [...lessons.map((l) => l.order)].sort((a, b) => a - b),
    );
  });

  it('finds a lesson and the one after it', async () => {
    const lessons = await listLessons('ar', dir);
    const found = await getLesson('ar', lessons[0]!.track, lessons[0]!.slug, dir);
    expect(found?.next?.slug).toBe(lessons[1]?.slug);
    const last = lessons.at(-1)!;
    expect((await getLesson('ar', last.track, last.slug, dir))?.next).toBeNull();
    expect(await getLesson('ar', 'basics', 'nope', dir)).toBeNull();
  });

  it('serves lessons, tracks and function pages in English and French', async () => {
    const en = await getLesson('en', 'conditional', 'sumif-basics', dir);
    expect(en?.lesson.titleAr).toBe('Adding up with a condition: SUMIF');
    const step = en!.lesson.steps[0]!;
    expect(step.type === 'ENTER_FORMULA' && step.check.solution).toBe(
      '=SUMIF(B2:B7,"North",C2:C7)',
    );
    expect((await listTracks('fr', dir))[0]!.titleAr).toBe('Les bases');
    expect((await getFunction('fr', 'vlookup', dir))?.titleAr).toMatch(/^La fonction VLOOKUP/);
  });

  it('loads the glossary', async () => {
    expect((await getGlossary(dir))['خلية']).toBe('cell');
  });
});

describe('language URLs', () => {
  it('maps a path to every language, with Arabic as x-default', () => {
    expect(inLocale('/ar/lessons/basics/cells-and-selection', 'fr')).toBe(
      '/fr/lessons/basics/cells-and-selection',
    );
    expect(inLocale('/en', 'ar')).toBe('/ar');
    const alt = languageAlternates('/en/functions/sum');
    expect(Object.keys(alt)).toEqual(['ar', 'en', 'fr', 'x-default']);
    expect(alt['x-default']).toMatch(/\/ar\/functions\/sum$/);
  });
});

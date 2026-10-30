import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { cache } from 'react';
import { GlossarySchema, LessonFileSchema, type Glossary, type LessonFile } from '@tamreen/shared';

/** `/content` at the repo root. Next runs from apps/web in dev, build and start. */
export const CONTENT_DIR = path.resolve(process.cwd(), '../../content');

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, 'utf8'));
}

/** Every lesson file, validated, in curriculum order. Throws on an invalid file: the build fails. */
export const listLessons = cache(async (dir: string = CONTENT_DIR): Promise<LessonFile[]> => {
  const lessonsDir = path.join(dir, 'lessons');
  const tracks = await readdir(lessonsDir, { withFileTypes: true });
  const lessons: LessonFile[] = [];
  for (const track of tracks.filter((t) => t.isDirectory())) {
    const files = await readdir(path.join(lessonsDir, track.name));
    for (const file of files.filter((f) => f.endsWith('.json'))) {
      const where = path.join(lessonsDir, track.name, file);
      const parsed = LessonFileSchema.safeParse(await readJson(where));
      if (!parsed.success) throw new Error(`Invalid lesson ${where}: ${parsed.error.message}`);
      const lesson = parsed.data;
      if (lesson.track !== track.name || `${lesson.slug}.json` !== file) {
        throw new Error(`Lesson ${where} must live at lessons/${lesson.track}/${lesson.slug}.json`);
      }
      lessons.push(lesson);
    }
  }
  return lessons.sort((a, b) => a.order - b.order);
});

export async function getLesson(
  track: string,
  slug: string,
  dir?: string,
): Promise<{ lesson: LessonFile; next: LessonFile | null } | null> {
  const lessons = await listLessons(dir);
  const i = lessons.findIndex((l) => l.track === track && l.slug === slug);
  if (i < 0) return null;
  return { lesson: lessons[i]!, next: lessons[i + 1] ?? null };
}

export const getGlossary = cache(async (dir: string = CONTENT_DIR): Promise<Glossary> =>
  GlossarySchema.parse(await readJson(path.join(dir, 'glossary.json'))),
);

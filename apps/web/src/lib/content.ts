import path from 'node:path';
import { cache } from 'react';
import { loadCurriculum } from '@tamreen/content';
import type { Glossary, LessonFile } from '@tamreen/shared';

/** `/content` at the repo root. Next runs from apps/web in dev, build and start. */
export const CONTENT_DIR = path.resolve(process.cwd(), '../../content');

/** The validated curriculum. An invalid file throws, so the build fails. */
const curriculum = cache((dir: string = CONTENT_DIR) => loadCurriculum(dir));

/** Every lesson, in curriculum order. */
export async function listLessons(dir?: string): Promise<LessonFile[]> {
  return (await curriculum(dir)).lessons;
}

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

export async function getGlossary(dir?: string): Promise<Glossary> {
  return (await curriculum(dir)).glossary;
}

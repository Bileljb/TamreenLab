import path from 'node:path';
import { cache } from 'react';
import { curriculumIn, loadCurriculum } from '@tamreen/content';
import type { FunctionFile, Glossary, LessonFile, Locale, TracksFile } from '@tamreen/shared';

/** `/content` at the repo root. Next runs from apps/web in dev, build and start. */
export const CONTENT_DIR = path.resolve(process.cwd(), '../../content');

/** The validated curriculum, in Arabic (the source). An invalid file throws, so the build fails. */
const source = cache((dir: string = CONTENT_DIR) => loadCurriculum(dir));

/** The curriculum in one language (ADR 009); the `*Ar` fields then hold that language's text. */
const curriculum = cache(async (locale: Locale, dir?: string) =>
  curriculumIn(await source(dir), locale),
);

/** Every lesson, in curriculum order. */
export async function listLessons(locale: Locale, dir?: string): Promise<LessonFile[]> {
  return (await curriculum(locale, dir)).lessons;
}

export async function listTracks(locale: Locale, dir?: string): Promise<TracksFile> {
  return (await curriculum(locale, dir)).tracks;
}

export async function getLesson(
  locale: Locale,
  track: string,
  slug: string,
  dir?: string,
): Promise<{ lesson: LessonFile; next: LessonFile | null } | null> {
  const lessons = await listLessons(locale, dir);
  const i = lessons.findIndex((l) => l.track === track && l.slug === slug);
  if (i < 0) return null;
  return { lesson: lessons[i]!, next: lessons[i + 1] ?? null };
}

/** Arabic glossary terms with their English names; only Arabic text uses `{{…}}` markup. */
export async function getGlossary(dir?: string): Promise<Glossary> {
  return (await source(dir)).glossary;
}

export async function listFunctions(locale: Locale, dir?: string): Promise<FunctionFile[]> {
  return (await curriculum(locale, dir)).functions;
}

export async function getFunction(
  locale: Locale,
  slug: string,
  dir?: string,
): Promise<FunctionFile | null> {
  return (await listFunctions(locale, dir)).find((f) => f.slug === slug) ?? null;
}

/** Function pages that link to a lesson, for "related functions" on lesson pages. */
export async function functionsForLesson(locale: Locale, lessonSlug: string, dir?: string) {
  return (await listFunctions(locale, dir)).filter((f) => f.lessons.includes(lessonSlug));
}

export const lessonHref = (locale: string, l: { track: string; slug: string }) =>
  `/${locale}/lessons/${l.track}/${l.slug}`;
export const functionHref = (locale: string, f: { slug: string }) =>
  `/${locale}/functions/${f.slug}`;

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import {
  FunctionFileSchema,
  FunctionTranslationSchema,
  GlossarySchema,
  LessonTranslationSchema,
  TRANSLATED_LOCALES,
  TracksTranslationSchema,
  LessonFileSchema,
  StyleFileSchema,
  TracksFileSchema,
  type FunctionFile,
  type FunctionTranslation,
  type Glossary,
  type LessonTranslation,
  type LessonFile,
  type StyleFile,
  type TracksFile,
  type TracksTranslation,
  type TranslatedLocale,
} from '@tamreen/shared';

/** A file read from disk: its JSON, or why it could not be read. Paths are relative to the content dir. */
export type RawFile = { path: string; json: unknown } | { path: string; error: string };

/** The translation files of one language under `i18n/<locale>/` (ADR 009). */
export type RawTranslation = {
  locale: TranslatedLocale;
  lessons: RawFile[];
  functions: RawFile[];
  tracks: RawFile;
};

export type RawContent = {
  lessons: RawFile[];
  /** `functions/<slug>.json`; empty when the folder does not exist. */
  functions?: RawFile[];
  tracks: RawFile;
  glossary: RawFile;
  style: RawFile;
  /** Only the languages whose `i18n/<locale>` folder exists. */
  translations?: RawTranslation[];
};

async function readJson(dir: string, relative: string): Promise<RawFile> {
  try {
    return { path: relative, json: JSON.parse(await readFile(path.join(dir, relative), 'utf8')) };
  } catch (e) {
    return { path: relative, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Reads every content file without judging it; the linter reports the problems. */
export async function readContent(dir: string): Promise<RawContent> {
  const lessonsDir = path.join(dir, 'lessons');
  const lessons: RawFile[] = [];
  for (const track of await readdir(lessonsDir, { withFileTypes: true })) {
    if (!track.isDirectory()) continue;
    for (const file of (await readdir(path.join(lessonsDir, track.name))).sort()) {
      if (file.endsWith('.json'))
        lessons.push(await readJson(dir, `lessons/${track.name}/${file}`));
    }
  }
  const functions: RawFile[] = [];
  const functionFiles = await readdir(path.join(dir, 'functions')).catch(() => [] as string[]);
  for (const file of functionFiles.sort()) {
    if (file.endsWith('.json')) functions.push(await readJson(dir, `functions/${file}`));
  }
  const [tracks, glossary, style] = await Promise.all([
    readJson(dir, 'tracks.json'),
    readJson(dir, 'glossary.json'),
    readJson(dir, 'style.json'),
  ]);
  const translations: RawTranslation[] = [];
  for (const locale of TRANSLATED_LOCALES) {
    const base = `i18n/${locale}`;
    const exists = await readdir(path.join(dir, base)).then(() => true, () => false);
    if (!exists) continue;
    translations.push({
      locale,
      lessons: await readFolder(dir, `${base}/lessons`),
      functions: await readFolder(dir, `${base}/functions`),
      tracks: await readJson(dir, `${base}/tracks.json`),
    });
  }
  return { lessons, functions, tracks, glossary, style, translations };
}

async function readFolder(dir: string, relative: string): Promise<RawFile[]> {
  const files = await readdir(path.join(dir, relative)).catch(() => [] as string[]);
  const out: RawFile[] = [];
  for (const file of files.sort()) {
    if (file.endsWith(".json")) out.push(await readJson(dir, `${relative}/${file}`));
  }
  return out;
}

/** The translations of one language, by slug. */
export type Translation = {
  lessons: Map<string, LessonTranslation>;
  functions: Map<string, FunctionTranslation>;
  tracks: TracksTranslation;
};

export type Curriculum = {
  tracks: TracksFile;
  /** In curriculum order. */
  lessons: LessonFile[];
  /** Function reference pages, in their `order`. */
  functions: FunctionFile[];
  glossary: Glossary;
  style: StyleFile;
  translations: Partial<Record<TranslatedLocale, Translation>>;
};

/** The expected location of a lesson file. */
export const lessonPath = (lesson: { track: string; slug: string }) =>
  `lessons/${lesson.track}/${lesson.slug}.json`;

/** The expected location of a translation file. */
export const translationPath = (locale: string, kind: "lessons" | "functions", slug: string) =>
  `i18n/${locale}/${kind}/${slug}.json`;

/** The expected location of a function file. */
export const functionPath = (fn: { slug: string }) => `functions/${fn.slug}.json`;

function json(file: RawFile): unknown {
  if ('error' in file) throw new Error(`${file.path}: ${file.error}`);
  return file.json;
}

/**
 * The validated curriculum, for the site and for sync. Throws on the first invalid file;
 * `content:lint` gives the full report.
 */
export async function loadCurriculum(dir: string): Promise<Curriculum> {
  const raw = await readContent(dir);
  const lessons = raw.lessons.map((file) => {
    const parsed = LessonFileSchema.safeParse(json(file));
    if (!parsed.success) throw new Error(`${file.path}: ${parsed.error.message}`);
    if (lessonPath(parsed.data) !== file.path) {
      throw new Error(`${file.path}: must live at ${lessonPath(parsed.data)}`);
    }
    return parsed.data;
  });
  const functions = (raw.functions ?? []).map((file) => {
    const parsed = FunctionFileSchema.safeParse(json(file));
    if (!parsed.success) throw new Error(`${file.path}: ${parsed.error.message}`);
    if (functionPath(parsed.data) !== file.path) {
      throw new Error(`${file.path}: must live at ${functionPath(parsed.data)}`);
    }
    return parsed.data;
  });
  return {
    tracks: TracksFileSchema.parse(json(raw.tracks)).sort((a, b) => a.order - b.order),
    lessons: lessons.sort((a, b) => a.order - b.order),
    functions: functions.sort((a, b) => a.order - b.order),
    glossary: GlossarySchema.parse(json(raw.glossary)),
    style: StyleFileSchema.parse(json(raw.style)),
    translations: Object.fromEntries(
      (raw.translations ?? []).map((t) => [
        t.locale,
        {
          lessons: new Map(
            t.lessons.map((f) => {
              const tr = LessonTranslationSchema.parse(json(f));
              return [tr.slug, tr];
            }),
          ),
          functions: new Map(
            t.functions.map((f) => {
              const tr = FunctionTranslationSchema.parse(json(f));
              return [tr.slug, tr];
            }),
          ),
          tracks: TracksTranslationSchema.parse(json(t.tracks)),
        },
      ]),
    ),
  };
}

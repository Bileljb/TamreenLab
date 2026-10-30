import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import {
  GlossarySchema,
  LessonFileSchema,
  StyleFileSchema,
  TracksFileSchema,
  type Glossary,
  type LessonFile,
  type StyleFile,
  type TracksFile,
} from '@tamreen/shared';

/** A file read from disk: its JSON, or why it could not be read. Paths are relative to the content dir. */
export type RawFile = { path: string; json: unknown } | { path: string; error: string };

export type RawContent = {
  lessons: RawFile[];
  tracks: RawFile;
  glossary: RawFile;
  style: RawFile;
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
  const [tracks, glossary, style] = await Promise.all([
    readJson(dir, 'tracks.json'),
    readJson(dir, 'glossary.json'),
    readJson(dir, 'style.json'),
  ]);
  return { lessons, tracks, glossary, style };
}

export type Curriculum = {
  tracks: TracksFile;
  /** In curriculum order. */
  lessons: LessonFile[];
  glossary: Glossary;
  style: StyleFile;
};

/** The expected location of a lesson file. */
export const lessonPath = (lesson: { track: string; slug: string }) =>
  `lessons/${lesson.track}/${lesson.slug}.json`;

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
  return {
    tracks: TracksFileSchema.parse(json(raw.tracks)).sort((a, b) => a.order - b.order),
    lessons: lessons.sort((a, b) => a.order - b.order),
    glossary: GlossarySchema.parse(json(raw.glossary)),
    style: StyleFileSchema.parse(json(raw.style)),
  };
}

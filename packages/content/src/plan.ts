import type { LessonFile, StepSpec, TracksFile, TranslatedLocale } from '@tamreen/shared';

/** Rows as they are (or should be) in Postgres, keyed by slugs instead of ids. */
export type TrackRow = { slug: string; titleAr: string; order: number };
export type LessonRow = {
  slug: string;
  trackSlug: string;
  order: number;
  kind: LessonFile['kind'];
  titleAr: string;
  summaryAr: string;
  minutes: number;
  status: LessonFile['status'];
  seoJson: unknown;
};
export type StepRow = {
  lessonSlug: string;
  slug: string;
  order: number;
  type: StepSpec['type'];
  promptAr: string;
  sheetJson: unknown;
  checkJson: unknown;
  hintAr: string | null;
  explainAr: string | null;
  basePoints: number;
  /** The sheet and check in each translated language, so the API scores in the learner's language. */
  localesJson: unknown;
};

export type DbState = {
  tracks: TrackRow[];
  lessons: LessonRow[];
  /** `attempts` counts learner attempts; a step with attempts is never deleted automatically. */
  steps: (StepRow & { attempts: number })[];
  /** Lessons with learner progress or attempts. */
  lessonsInUse?: string[];
};

export type SyncOp =
  | { kind: 'createTrack'; row: TrackRow }
  | { kind: 'updateTrack'; row: TrackRow }
  | { kind: 'deleteTrack'; slug: string }
  | { kind: 'createLesson'; row: LessonRow }
  | { kind: 'updateLesson'; row: LessonRow }
  | { kind: 'deleteLesson'; slug: string }
  | { kind: 'createStep'; row: StepRow }
  | { kind: 'updateStep'; row: StepRow }
  | { kind: 'deleteStep'; lessonSlug: string; slug: string };

export type SyncPlan = { ops: SyncOp[]; errors: string[] };

/** JSON with sorted keys, so that key order never counts as a change. */
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
}

const sameRow = (a: object, b: object) => canonical(a) === canonical(b);

function withoutAttempts(step: StepRow & { attempts: number }): StepRow {
  const row: Partial<StepRow & { attempts: number }> = { ...step };
  delete row.attempts;
  return row as StepRow;
}

/** The rows the content files describe. */
export function desiredState(
  tracks: TracksFile,
  lessons: LessonFile[],
  /** The same lessons in each translated language (see curriculumIn). */
  localized: Partial<Record<TranslatedLocale, LessonFile[]>> = {},
): Omit<DbState, 'steps'> & {
  steps: StepRow[];
} {
  const translatedStep = new Map<string, Record<string, unknown>>();
  for (const [locale, list] of Object.entries(localized)) {
    for (const l of list) {
      for (const s of l.steps) {
        const key = `${l.slug}/${s.slug}`;
        const entry = translatedStep.get(key) ?? {};
        entry[locale] = { ...(s.sheet ? { sheet: s.sheet } : {}), check: s.check };
        translatedStep.set(key, entry);
      }
    }
  }
  return {
    tracks: tracks.map(({ slug, titleAr, order }) => ({ slug, titleAr, order })),
    lessons: lessons.map((l) => ({
      slug: l.slug,
      trackSlug: l.track,
      order: l.order,
      kind: l.kind,
      titleAr: l.titleAr,
      summaryAr: l.summaryAr,
      minutes: l.minutes,
      status: l.status,
      seoJson: null,
    })),
    steps: lessons.flatMap((l) =>
      l.steps.map((s, i) => ({
        lessonSlug: l.slug,
        slug: s.slug,
        order: i + 1,
        type: s.type,
        promptAr: s.promptAr,
        sheetJson: s.sheet ?? {},
        checkJson: s.check,
        hintAr: s.hintAr ?? null,
        explainAr: s.explainAr ?? null,
        basePoints: s.basePoints,
        localesJson: translatedStep.get(`${l.slug}/${s.slug}`) ?? {},
      })),
    ),
  };
}

/**
 * The operations that make the database match the content files. Pure, so it is unit-tested;
 * running it against a database that already matches returns no operations.
 */
export function planSync(desired: ReturnType<typeof desiredState>, current: DbState): SyncPlan {
  const ops: SyncOp[] = [];
  const errors: string[] = [];
  const inUse = new Set(current.lessonsInUse ?? []);

  const tracks = new Map(current.tracks.map((t) => [t.slug, t]));
  for (const row of desired.tracks) {
    const existing = tracks.get(row.slug);
    if (!existing) ops.push({ kind: 'createTrack', row });
    else if (!sameRow(existing, row)) ops.push({ kind: 'updateTrack', row });
  }

  const lessons = new Map(current.lessons.map((l) => [l.slug, l]));
  for (const row of desired.lessons) {
    const existing = lessons.get(row.slug);
    if (!existing) ops.push({ kind: 'createLesson', row });
    else if (!sameRow(existing, row)) ops.push({ kind: 'updateLesson', row });
  }

  const stepKey = (s: { lessonSlug: string; slug: string }) => `${s.lessonSlug}/${s.slug}`;
  const steps = new Map(current.steps.map((s) => [stepKey(s), s]));
  const wanted = new Set(desired.steps.map(stepKey));
  for (const row of desired.steps) {
    const existing = steps.get(stepKey(row));
    if (!existing) ops.push({ kind: 'createStep', row });
    else if (!sameRow(withoutAttempts(existing), row)) ops.push({ kind: 'updateStep', row });
  }

  const keptLessons = new Set(desired.lessons.map((l) => l.slug));
  for (const step of current.steps) {
    if (wanted.has(stepKey(step))) continue;
    if (step.attempts > 0) {
      errors.push(
        `step ${stepKey(step)} was removed from content but has ${step.attempts} attempts; remove it by hand`,
      );
    } else {
      ops.push({ kind: 'deleteStep', lessonSlug: step.lessonSlug, slug: step.slug });
    }
  }
  for (const lesson of current.lessons) {
    if (keptLessons.has(lesson.slug)) continue;
    if (inUse.has(lesson.slug)) {
      errors.push(
        `lesson ${lesson.slug} was removed from content but has learner progress; remove it by hand`,
      );
    } else {
      ops.push({ kind: 'deleteLesson', slug: lesson.slug });
    }
  }
  const keptTracks = new Set(desired.tracks.map((t) => t.slug));
  for (const track of current.tracks) {
    if (!keptTracks.has(track.slug)) ops.push({ kind: 'deleteTrack', slug: track.slug });
  }

  return { ops, errors };
}

export function summarize(plan: SyncPlan): Record<SyncOp['kind'], number> {
  const counts = {
    createTrack: 0,
    updateTrack: 0,
    deleteTrack: 0,
    createLesson: 0,
    updateLesson: 0,
    deleteLesson: 0,
    createStep: 0,
    updateStep: 0,
    deleteStep: 0,
  };
  for (const op of plan.ops) counts[op.kind]++;
  return counts;
}

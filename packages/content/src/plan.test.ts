import { describe, expect, it } from 'vitest';
import { LessonFileSchema, type LessonFileInput } from '@tamreen/shared';
import { canonical, desiredState, planSync, summarize, type DbState } from './plan';

const tracks = [{ slug: 'basics', titleAr: 'الأساسيات', order: 1 }];
const lessonInput: LessonFileInput = {
  slug: 'cells',
  track: 'basics',
  order: 1,
  kind: 'CONCEPT',
  titleAr: 'الخلايا',
  summaryAr: 'ملخص',
  minutes: 3,
  steps: [
    { slug: 'a', type: 'SELECT_CELL', promptAr: 'اختر B2', check: { target: 'B2' } },
    { slug: 'b', type: 'SELECT_CELL', promptAr: 'اختر C3', check: { target: 'C3' }, hintAr: 'C' },
  ],
};
const lesson = LessonFileSchema.parse(lessonInput);
const desired = desiredState(tracks, [lesson]);

/** The database after a successful sync of `desired`. */
const synced = (): DbState => ({
  tracks: desired.tracks.map((t) => ({ ...t })),
  lessons: desired.lessons.map((l) => ({ ...l })),
  steps: desired.steps.map((s) => ({ ...s, attempts: 0 })),
});

describe('canonical', () => {
  it('ignores key order but not values', () => {
    expect(canonical({ b: 1, a: { d: 2, c: [3, { y: 1, x: 2 }] } })).toBe(
      canonical({ a: { c: [3, { x: 2, y: 1 }], d: 2 }, b: 1 }),
    );
    expect(canonical({ a: 1 })).not.toBe(canonical({ a: 2 }));
  });
});

describe('planSync', () => {
  it('creates everything on an empty database', () => {
    const plan = planSync(desired, { tracks: [], lessons: [], steps: [] });
    expect(plan.errors).toEqual([]);
    expect(summarize(plan)).toMatchObject({ createTrack: 1, createLesson: 1, createStep: 2 });
  });

  it('plans nothing when the database already matches (idempotent)', () => {
    expect(planSync(desired, synced())).toEqual({ ops: [], errors: [] });
  });

  it('ignores JSON key order in stored sheet and check data', () => {
    const db = synced();
    db.steps[0]!.checkJson = JSON.parse(canonical(db.steps[0]!.checkJson));
    expect(planSync(desired, db).ops).toEqual([]);
  });

  it('updates only what changed', () => {
    const db = synced();
    db.tracks[0]!.titleAr = 'قديم';
    db.lessons[0]!.minutes = 9;
    db.steps[1]!.hintAr = null;
    expect(planSync(desired, db).ops.map((o) => o.kind)).toEqual([
      'updateTrack',
      'updateLesson',
      'updateStep',
    ]);
  });

  it('matches steps by slug, so a reorder is an update, not a delete and create', () => {
    const reordered = desiredState(tracks, [
      LessonFileSchema.parse({ ...lessonInput, steps: [...lessonInput.steps].reverse() }),
    ]);
    const ops = planSync(reordered, synced()).ops;
    expect(ops.map((o) => o.kind)).toEqual(['updateStep', 'updateStep']);
  });

  it('deletes removed steps, lessons and tracks that nobody used', () => {
    const db = synced();
    db.steps.push({ ...db.steps[0]!, slug: 'old' });
    db.lessons.push({ ...db.lessons[0]!, slug: 'gone', order: 7 });
    db.tracks.push({ slug: 'retired', titleAr: 'قديم', order: 9 });
    expect(planSync(desired, db).ops).toEqual([
      { kind: 'deleteStep', lessonSlug: 'cells', slug: 'old' },
      { kind: 'deleteLesson', slug: 'gone' },
      { kind: 'deleteTrack', slug: 'retired' },
    ]);
  });

  it('refuses to delete steps with attempts or lessons with progress', () => {
    const db = synced();
    db.steps.push({ ...db.steps[0]!, slug: 'old', attempts: 4 });
    db.lessons.push({ ...db.lessons[0]!, slug: 'gone' });
    db.lessonsInUse = ['gone'];
    const plan = planSync(desired, db);
    expect(plan.ops).toEqual([]);
    expect(plan.errors).toHaveLength(2);
    expect(plan.errors[0]).toContain('cells/old');
    expect(plan.errors[1]).toContain('gone');
  });

  it('stores a step without a sheet as an empty object and missing texts as null', () => {
    expect(desired.steps[0]).toMatchObject({
      order: 1,
      sheetJson: {},
      hintAr: null,
      explainAr: null,
    });
    expect(desired.lessons[0]).toMatchObject({
      status: 'DRAFT',
      trackSlug: 'basics',
      seoJson: null,
    });
  });
});

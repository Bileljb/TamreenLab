import { describe, expect, it } from 'vitest';
import {
  createLessonState,
  lessonReducer,
  lessonTotals,
  type LessonAction,
  type LessonState,
} from './lessonState';

const ok = { correct: true, code: 'OK' } as const;
const wrong = { correct: false, code: 'WRONG_VALUE' } as const;
const run = (state: LessonState, ...actions: LessonAction[]) =>
  actions.reduce(lessonReducer, state);
const check = (result: typeof ok | typeof wrong, now: number): LessonAction => ({
  type: 'checked',
  result,
  basePoints: 300,
  now,
});

describe('lessonReducer', () => {
  it('starts on the first step with its clock running', () => {
    const s = createLessonState(3, 1000);
    expect(s.index).toBe(0);
    expect(s.steps[0]!.startedAt).toBe(1000);
    expect(s.steps[1]!.startedAt).toBeNull();
  });

  it('scores a fast first-try answer and blocks Continue until settled', () => {
    let s = createLessonState(2, 0);
    s = run(s, { type: 'next', now: 1 });
    expect(s.index).toBe(0);
    s = run(s, check(ok, 5_000));
    expect(s.steps[0]).toMatchObject({
      status: 'correct',
      attempts: 1,
      firstTry: true,
      points: 525,
    });
    // Checking again after a correct answer changes nothing.
    expect(run(s, check(wrong, 6_000))).toBe(s);
    s = run(s, { type: 'next', now: 7_000 });
    expect(s.index).toBe(1);
    expect(s.steps[1]!.startedAt).toBe(7_000);
  });

  it('records wrong attempts, then scores without the first-try bonus', () => {
    const s = run(createLessonState(1, 0), check(wrong, 1_000), check(ok, 60_000));
    expect(s.steps[0]).toMatchObject({
      status: 'correct',
      attempts: 2,
      firstTry: false,
      points: 300,
    });
    expect(run(createLessonState(1, 0), check(wrong, 1)).steps[0]!.code).toBe('WRONG_VALUE');
  });

  it('halves the points after a hint and gives none after Show Answer', () => {
    const hinted = run(createLessonState(1, 0), { type: 'hint' }, check(ok, 60_000));
    expect(hinted.steps[0]!.points).toBe(188);
    const revealed = run(createLessonState(1, 0), { type: 'reveal' }, check(ok, 1_000));
    expect(revealed.steps[0]).toMatchObject({ status: 'revealed', points: 0 });
    // Reveal after a correct answer keeps the points.
    const correct = run(createLessonState(1, 0), check(ok, 60_000));
    expect(run(correct, { type: 'reveal' })).toBe(correct);
  });

  it('skips, goes back, and finishes after the last step', () => {
    let s = run(createLessonState(2, 0), { type: 'skip', now: 1 });
    expect(s.steps[0]!.status).toBe('skipped');
    expect(s.index).toBe(1);
    s = run(s, { type: 'previous', now: 2 }, { type: 'previous', now: 3 });
    expect(s.index).toBe(0);
    s = run(s, { type: 'next', now: 4 }, check(ok, 5), { type: 'next', now: 6 });
    expect(s.finished).toBe(true);
    // Skipping a settled step keeps its status.
    const settled = run(createLessonState(2, 0), check(ok, 1), { type: 'skip', now: 2 });
    expect(settled.steps[0]!.status).toBe('correct');
  });

  it('resumes at the first step not done earlier', () => {
    let s = run(createLessonState(3, 0), { type: 'resume', done: [true, false, true], now: 50 });
    expect(s.index).toBe(1);
    expect(s.steps[0]!.status).toBe('done');
    expect(s.steps[1]!.startedAt).toBe(50);
    s = run(createLessonState(2, 0), { type: 'resume', done: [true, true], now: 9 });
    expect(s.index).toBe(0);
  });

  it('restarts from scratch', () => {
    const s = run(createLessonState(2, 0), check(ok, 1), { type: 'restart', now: 100 });
    expect(s).toEqual(createLessonState(2, 100));
  });

  it('sums the lesson totals', () => {
    const s = run(
      createLessonState(3, 0),
      check(ok, 1_000),
      { type: 'next', now: 1_000 },
      check(wrong, 2_000),
      check(ok, 70_000),
      { type: 'next', now: 70_000 },
      { type: 'skip', now: 70_000 },
    );
    expect(lessonTotals(s)).toEqual({ points: 825, correct: 2, firstTry: 1, settled: 3 });
  });
});

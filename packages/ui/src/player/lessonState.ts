import { scoreAttempt, type CheckResult } from '@tamreen/engine';
import type { FeedbackCode } from '@tamreen/shared';

export type StepStatus =
  /** Not answered yet in this session. */
  | 'idle'
  /** Last check was wrong; the learner can try again. */
  | 'incorrect'
  | 'correct'
  /** Show Answer was used. */
  | 'revealed'
  | 'skipped'
  /** Finished in an earlier visit (guest progress). */
  | 'done';

export type StepRun = {
  status: StepStatus;
  attempts: number;
  hintShown: boolean;
  code: FeedbackCode | null;
  points: number;
  firstTry: boolean;
  startedAt: number | null;
};

export type LessonState = {
  index: number;
  steps: StepRun[];
  finished: boolean;
};

export type LessonAction =
  | { type: 'checked'; result: CheckResult; basePoints: number; now: number }
  | { type: 'hint' }
  | { type: 'reveal' }
  | { type: 'skip'; now: number }
  | { type: 'next'; now: number }
  | { type: 'previous'; now: number }
  | { type: 'resume'; done: boolean[]; now: number }
  | { type: 'restart'; now: number }
  /** The server's award for a step (signed-in learners): it replaces the local estimate. */
  | { type: 'scored'; index: number; points: number };

const freshRun = (startedAt: number | null = null): StepRun => ({
  status: 'idle',
  attempts: 0,
  hintShown: false,
  code: null,
  points: 0,
  firstTry: false,
  startedAt,
});

export function createLessonState(stepCount: number, now: number): LessonState {
  return {
    index: 0,
    steps: Array.from({ length: stepCount }, (_, i) => freshRun(i === 0 ? now : null)),
    finished: false,
  };
}

/** Correct, revealed, skipped or done earlier: Continue is available. */
export const isSettled = (run: StepRun) => run.status !== 'idle' && run.status !== 'incorrect';

function updateStep(state: LessonState, index: number, patch: Partial<StepRun>): LessonState {
  const steps = state.steps.map((run, i) => (i === index ? { ...run, ...patch } : run));
  return { ...state, steps };
}

/** Moves to a step, starting its clock the first time it is shown. */
function goTo(state: LessonState, index: number, now: number): LessonState {
  if (index >= state.steps.length) return { ...state, finished: true };
  const run = state.steps[index]!;
  const next = { ...state, index, finished: false };
  return run.startedAt === null ? updateStep(next, index, { startedAt: now }) : next;
}

export function lessonReducer(state: LessonState, action: LessonAction): LessonState {
  const run = state.steps[state.index]!;
  switch (action.type) {
    case 'checked': {
      if (run.status === 'correct' || run.status === 'revealed') return state;
      const attempts = run.attempts + 1;
      if (!action.result.correct) {
        return updateStep(state, state.index, {
          status: 'incorrect',
          attempts,
          code: action.result.code,
        });
      }
      const firstTry = attempts === 1;
      const points = scoreAttempt({
        basePoints: action.basePoints,
        timeMs: action.now - (run.startedAt ?? action.now),
        firstTry,
        hintUsed: run.hintShown,
        answerShown: false,
      });
      return updateStep(state, state.index, {
        status: 'correct',
        attempts,
        code: 'OK',
        points,
        firstTry,
      });
    }
    case 'hint':
      return updateStep(state, state.index, { hintShown: true });
    case 'reveal':
      if (run.status === 'correct') return state;
      return updateStep(state, state.index, { status: 'revealed', points: 0, code: null });
    case 'skip':
      return goTo(
        isSettled(run) ? state : updateStep(state, state.index, { status: 'skipped' }),
        state.index + 1,
        action.now,
      );
    case 'next':
      if (!isSettled(run)) return state;
      return goTo(state, state.index + 1, action.now);
    case 'previous':
      return state.index === 0 ? state : goTo(state, state.index - 1, action.now);
    case 'resume': {
      // Steps finished in an earlier visit; continue at the first one that is not.
      const steps = state.steps.map((r, i) =>
        action.done[i] ? { ...r, status: 'done' as const } : r,
      );
      const first = steps.findIndex((r) => r.status !== 'done');
      return goTo({ ...state, steps }, first < 0 ? 0 : first, action.now);
    }
    case 'scored':
      return updateStep(state, action.index, { points: Math.max(0, Math.round(action.points)) });
    case 'restart':
      return createLessonState(state.steps.length, action.now);
  }
}

export function lessonTotals(state: LessonState) {
  const answered = state.steps.filter((r) => r.status === 'correct');
  return {
    points: state.steps.reduce((sum, r) => sum + r.points, 0),
    correct: answered.length,
    firstTry: answered.filter((r) => r.firstTry).length,
    settled: state.steps.filter(isSettled).length,
  };
}

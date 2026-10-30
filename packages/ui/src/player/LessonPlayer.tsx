'use client';

import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import {
  InvalidAnswerError,
  checkAnswer,
  parseAddress,
  referenceAnswer,
  type CheckResult,
} from '@tamreen/engine';
import type { FeedbackCode, Glossary, LessonFile, StepSpec } from '@tamreen/shared';
import { api, announcePoints } from '../api/client';
import { useSession } from '../api/session';
import { Formula } from '../Formula';
import { SpreadsheetGrid, useGrid } from '../grid/SpreadsheetGrid';
import { addressOf, selectionLabel, type GridState } from '../grid/state';
import { Prompt, firstUses } from '../prompt/Prompt';
import { useLessonProgress } from './guestProgress';
import {
  createLessonState,
  isSettled,
  lessonReducer,
  lessonTotals,
  type LessonAction,
  type StepRun,
} from './lessonState';

type Props = {
  lesson: LessonFile;
  glossary: Glossary;
  lessonsHref: string;
  nextLessonHref?: string;
};

export function LessonPlayer({ lesson, glossary, lessonsHref, nextLessonHref }: Props) {
  const t = useTranslations('player');
  const [state, dispatch] = useReducer(lessonReducer, lesson.steps.length, (n) =>
    createLessonState(n, Date.now()),
  );
  const [round, setRound] = useState(0);
  const [resumed, setResumed] = useState(false);
  const navigated = useRef(false);
  const guest = useLessonProgress(lesson.slug);
  const session = useSession();
  const signedIn = session.status === 'user';
  const introduced = useMemo(() => firstUses(lesson.steps.map((s) => s.promptAr)), [lesson.steps]);

  // Resume once we know who is playing: from the server when signed in, else from localStorage.
  const resumeDone = useRef(false);
  useEffect(() => {
    if (resumeDone.current || session.status === 'loading') return;
    const resume = (stepsDone: string[]) => {
      resumeDone.current = true;
      const done = lesson.steps.map((s) => stepsDone.includes(s.slug));
      if (done.some(Boolean)) {
        dispatch({ type: 'resume', done, now: Date.now() });
        setResumed(done.some((d) => !d));
      }
    };
    if (session.status === 'user') {
      api
        .progress()
        .then((all) => resume(all.find((p) => p.lessonSlug === lesson.slug)?.stepsDone ?? []))
        .catch(() => resume([]));
    } else if (guest.progress) {
      resume(guest.progress.stepsDone);
    }
  }, [session.status, guest.progress, lesson.slug, lesson.steps]);

  function act(action: LessonAction, answer?: unknown) {
    navigated.current =
      action.type !== 'checked' && action.type !== 'hint' && action.type !== 'reveal';
    const index = state.index;
    const before = state.steps[index]!;
    const next = lessonReducer(state, action);
    dispatch(action);
    const after = next.steps[index]!;
    const step = lesson.steps[index]!;
    const newlyCorrect = before.status !== 'correct' && after.status === 'correct';

    if (action.type === 'checked' && signedIn && after !== before) {
      // The server re-checks and decides the points (PLAN T3); local feedback stays instant.
      api
        .attempt({
          lessonSlug: lesson.slug,
          stepSlug: step.slug,
          answer,
          timeMs: Math.max(0, action.now - (before.startedAt ?? action.now)),
          hintUsed: before.hintShown,
          answerShown: false,
        })
        .then((res) => {
          if (res.correct) dispatch({ type: 'scored', index, points: res.pointsAwarded });
          if (res.pointsAwarded > 0) announcePoints();
        })
        .catch(() => {
          // API unreachable: keep the step locally so nothing is lost; it merges on next sign-in.
          if (newlyCorrect) guest.recordStep(step.slug, after.points, after.firstTry);
        });
    } else if (newlyCorrect && !signedIn) {
      guest.recordStep(step.slug, after.points, after.firstTry);
    }
    if (!state.finished && next.finished && !signedIn) guest.complete();
  }

  const totals = lessonTotals(state);
  const total = lesson.steps.length;

  return (
    <section className="flex flex-col gap-4" aria-label={lesson.titleAr}>
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
          <span>{t('progress', { current: Math.min(state.index + 1, total), total })}</span>
          <span className="font-semibold text-emerald-800" data-testid="lesson-points">
            {t('points', { points: totals.points })}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={t('progress', { current: Math.min(state.index + 1, total), total })}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={totals.settled}
          className="h-2 overflow-hidden rounded-full bg-slate-200"
        >
          <div
            className="h-full rounded-full bg-emerald-600 transition-[width] duration-300"
            style={{ width: `${(totals.settled / total) * 100}%` }}
          />
        </div>
        {resumed ? <p className="text-sm text-slate-500">{t('resumed')}</p> : null}
      </header>

      {state.finished ? (
        <Completion
          correct={totals.correct}
          firstTry={totals.firstTry}
          total={total}
          points={totals.points}
          lessonsHref={lessonsHref}
          nextLessonHref={nextLessonHref}
          onRestart={() => {
            setRound((r) => r + 1);
            act({ type: 'restart', now: Date.now() });
          }}
        />
      ) : (
        <StepView
          key={`${round}-${lesson.steps[state.index]!.slug}`}
          step={lesson.steps[state.index]!}
          run={state.steps[state.index]!}
          canGoBack={state.index > 0}
          autoFocus={navigated.current}
          glossary={glossary}
          introduce={introduced[state.index]!}
          onChecked={(result, answer) =>
            act(
              {
                type: 'checked',
                result,
                basePoints: lesson.steps[state.index]!.basePoints,
                now: Date.now(),
              },
              answer,
            )
          }
          onNext={() => act({ type: 'next', now: Date.now() })}
          onSkip={() => act({ type: 'skip', now: Date.now() })}
          onPrevious={() => act({ type: 'previous', now: Date.now() })}
          onHint={() => act({ type: 'hint' })}
          onReveal={() => act({ type: 'reveal' })}
        />
      )}
    </section>
  );
}

type StepViewProps = {
  step: StepSpec;
  run: StepRun;
  canGoBack: boolean;
  autoFocus: boolean;
  glossary: Glossary;
  introduce: Set<string>;
  onChecked: (result: CheckResult, answer: unknown) => void;
  onNext: () => void;
  onSkip: () => void;
  onPrevious: () => void;
  onHint: () => void;
  onReveal: () => void;
};

const EMPTY_SHEET = { visible: 'A1:A1', cells: {} };

/** The learner's answer from the grid or the choice list; null when there is nothing to check. */
function buildAnswer(step: StepSpec, grid: GridState, choice: number | null): unknown {
  switch (step.type) {
    case 'SELECT_CELL':
      return { cell: addressOf(grid.active) };
    case 'SELECT_RANGE': {
      const label = selectionLabel(grid);
      return { range: label.includes(':') ? label : `${label}:${label}` };
    }
    case 'ENTER_VALUE':
      return grid.lastCommit
        ? { cell: grid.lastCommit.address, value: grid.lastCommit.text }
        : null;
    case 'ENTER_FORMULA':
      return grid.lastCommit
        ? { cell: grid.lastCommit.address, formula: grid.lastCommit.text }
        : null;
    case 'MULTIPLE_CHOICE':
      return choice === null ? null : { choice };
    case 'SHORTCUT':
      return null;
  }
}

function StepView(props: StepViewProps) {
  const { step, run, glossary, introduce } = props;
  const t = useTranslations('player');
  const tf = useTranslations('feedback');
  const sheet = step.sheet ?? EMPTY_SHEET;
  const [grid, gridDispatch] = useGrid(sheet);
  const [choice, setChoice] = useState<number | null>(null);
  const [notice, setNotice] = useState<'enterFirst' | 'chooseFirst' | null>(null);
  const continueButton = useRef<HTMLButtonElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const settled = isSettled(run);
  const usesGrid =
    step.type !== 'MULTIPLE_CHOICE' && step.type !== 'SHORTCUT' ? true : !!step.sheet;

  function check() {
    if (settled) return;
    const answer = buildAnswer(step, grid, choice);
    if (answer === null) {
      setNotice(step.type === 'MULTIPLE_CHOICE' ? 'chooseFirst' : 'enterFirst');
      return;
    }
    setNotice(null);
    try {
      props.onChecked(checkAnswer(step, answer), answer);
    } catch (e) {
      if (!(e instanceof InvalidAnswerError)) throw e;
      props.onChecked(
        { correct: false, code: step.type === 'SELECT_RANGE' ? 'WRONG_CELL' : 'WRONG_VALUE' },
        answer,
      );
    }
  }

  const primary = () => (settled ? props.onNext() : check());

  // Entering a value or formula is checked as soon as it is committed (Enter in the cell).
  const lastSeq = useRef(grid.lastCommit?.seq ?? 0);
  useEffect(() => {
    const seq = grid.lastCommit?.seq ?? 0;
    if (seq === lastSeq.current) return;
    lastSeq.current = seq;
    if (!settled && (step.type === 'ENTER_VALUE' || step.type === 'ENTER_FORMULA')) check();
  }, [grid.lastCommit?.seq]);

  // Show Answer applies the reference answer to the grid or the choices.
  useEffect(() => {
    if (run.status !== 'revealed') return;
    const answer = referenceAnswer(step);
    if ('cell' in answer && 'formula' in answer) {
      lastSeq.current += 1; // not a learner entry: do not check it
      gridDispatch({ type: 'setCell', address: answer.cell, text: answer.formula });
    } else if ('cell' in answer && 'value' in answer) {
      lastSeq.current += 1;
      gridDispatch({ type: 'setCell', address: answer.cell, text: answer.value });
    } else if ('range' in answer) {
      const [a, b] = answer.range.split(':') as [string, string];
      gridDispatch({ type: 'selectRange', anchor: parseAddress(a), active: parseAddress(b) });
    } else if ('cell' in answer) {
      gridDispatch({ type: 'select', pos: parseAddress(answer.cell) });
    } else if ('choice' in answer) {
      setChoice(answer.choice);
    }
  }, [run.status, step, gridDispatch]);

  // Keyboard-first: after a result, Continue takes focus so Enter moves on.
  useEffect(() => {
    if (settled) continueButton.current?.focus();
  }, [settled]);

  // On arriving at a step by navigation, focus where the learner works.
  useEffect(() => {
    if (!props.autoFocus) return;
    // A choice step answers with the options, even when it shows a sheet for reference.
    const target = body.current?.querySelector<HTMLElement>(
      step.type === 'MULTIPLE_CHOICE' ? 'input[type="radio"]' : '[data-active="true"]',
    );
    target?.focus({ preventScroll: false });
  }, []);

  const button =
    'rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700';

  return (
    <div className="flex flex-col gap-4">
      <Prompt text={step.promptAr} glossary={glossary} introduce={introduce} />

      <div ref={body} className="flex flex-col gap-3">
        {usesGrid ? (
          <SpreadsheetGrid
            sheet={sheet}
            state={grid}
            dispatch={gridDispatch}
            functions={step.type === 'ENTER_FORMULA' ? (step.check.mustUseFunctions ?? []) : []}
            onIdleEnter={primary}
          />
        ) : null}

        {step.type === 'MULTIPLE_CHOICE' ? (
          <fieldset
            className="flex flex-col gap-2"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                primary();
              }
            }}
          >
            <legend className="sr-only">{t('choices')}</legend>
            {step.check.options.map((option, i) => (
              <label
                key={i}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 ${
                  choice === i ? 'border-emerald-600 bg-emerald-50' : 'border-slate-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name={`choice-${step.slug}`}
                  className="size-4 accent-emerald-700"
                  checked={choice === i}
                  disabled={settled}
                  onChange={() => setChoice(i)}
                />
                <Prompt text={option} glossary={glossary} introduce={new Set()} />
              </label>
            ))}
          </fieldset>
        ) : null}

        {step.type === 'SHORTCUT' ? (
          <p className="rounded-lg bg-amber-50 px-4 py-3 text-amber-900">{t('shortcutSoon')}</p>
        ) : null}
      </div>

      <Feedback step={step} run={run} notice={notice} t={t} tf={tf} />

      {run.hintShown && step.hintAr ? (
        <aside className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sky-900">
          <Prompt text={step.hintAr} glossary={glossary} introduce={new Set()} />
        </aside>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {settled ? (
          <button
            ref={continueButton}
            type="button"
            className={`${button} border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800`}
            onClick={props.onNext}
          >
            {t('continue')}
          </button>
        ) : (
          <button
            type="button"
            className={`${button} border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800`}
            onClick={check}
            disabled={step.type === 'SHORTCUT'}
          >
            {t('check')}
          </button>
        )}
        <span className="text-xs text-slate-500">{t('enterKeyHint')}</span>
        <span className="ms-auto flex flex-wrap gap-2">
          {step.hintAr && !run.hintShown && !settled ? (
            <button
              type="button"
              className={`${button} border-slate-300 bg-white`}
              onClick={props.onHint}
            >
              {t('hint')}
            </button>
          ) : null}
          {!settled && step.type !== 'SHORTCUT' ? (
            <button
              type="button"
              className={`${button} border-slate-300 bg-white`}
              onClick={props.onReveal}
            >
              {t('showAnswer')}
            </button>
          ) : null}
          <button
            type="button"
            className={`${button} border-slate-300 bg-white`}
            onClick={props.onPrevious}
            disabled={!props.canGoBack}
          >
            {t('previous')}
          </button>
          {!settled ? (
            <button
              type="button"
              className={`${button} border-slate-300 bg-white`}
              onClick={props.onSkip}
            >
              {t('skip')}
            </button>
          ) : null}
        </span>
      </div>
    </div>
  );
}

type Translate = ReturnType<typeof useTranslations<'player'>>;
type TranslateFeedback = ReturnType<typeof useTranslations<'feedback'>>;

function answerText(step: StepSpec): ReactNode {
  switch (step.type) {
    case 'SELECT_CELL':
    case 'SELECT_RANGE':
      return <Formula>{step.check.target}</Formula>;
    case 'ENTER_VALUE':
      return (
        <>
          <Formula>{step.check.target}</Formula> ← <bdi>{String(step.check.expected)}</bdi>
        </>
      );
    case 'ENTER_FORMULA':
      return (
        <>
          <Formula>{step.check.target}</Formula> ← <Formula>{step.check.solution}</Formula>
        </>
      );
    case 'MULTIPLE_CHOICE':
      // Options use the same markup as prompts (a formula in backticks stays LTR).
      return (
        <span className="inline-block [&>p]:inline [&>p]:text-base">
          <Prompt
            text={step.check.options[step.check.correct]!}
            glossary={{}}
            introduce={new Set()}
          />
        </span>
      );
    case 'SHORTCUT':
      return <Formula>{step.check.combos[0]!.win}</Formula>;
  }
}

function Feedback({
  step,
  run,
  notice,
  t,
  tf,
}: {
  step: StepSpec;
  run: StepRun;
  notice: 'enterFirst' | 'chooseFirst' | null;
  t: Translate;
  tf: TranslateFeedback;
}) {
  let tone = '';
  let content: ReactNode = null;
  if (notice) {
    tone = 'border-slate-300 bg-slate-50 text-slate-800';
    content = t(notice);
  } else if (run.status === 'correct') {
    tone = 'border-emerald-300 bg-emerald-50 text-emerald-900';
    content = run.points > 0 ? t('correct', { points: run.points }) : t('correctNoPoints');
  } else if (run.status === 'incorrect' && run.code) {
    tone = 'border-rose-300 bg-rose-50 text-rose-900';
    content =
      step.type === 'MULTIPLE_CHOICE'
        ? t('wrongChoice')
        : tf.rich(run.code as Exclude<FeedbackCode, 'OK'>, {
            f: (chunks) => <Formula>{chunks}</Formula>,
          });
  } else if (run.status === 'revealed') {
    tone = 'border-amber-300 bg-amber-50 text-amber-900';
    content = (
      <>
        <span className="font-semibold">{t('answer')}</span> {answerText(step)}
        <span className="block text-sm">{t('revealed')}</span>
      </>
    );
  } else if (run.status === 'done') {
    tone = 'border-slate-300 bg-slate-50 text-slate-700';
    content = t('doneBefore');
  } else if (run.status === 'skipped') {
    tone = 'border-slate-300 bg-slate-50 text-slate-700';
    content = t('skipped');
  }
  return (
    <div role="status" aria-live="polite" className="min-h-14" data-feedback={run.status}>
      {content ? <div className={`rounded-lg border px-4 py-3 ${tone}`}>{content}</div> : null}
    </div>
  );
}

function Completion(props: {
  correct: number;
  firstTry: number;
  total: number;
  points: number;
  lessonsHref: string;
  nextLessonHref?: string;
  onRestart: () => void;
}) {
  const t = useTranslations('player');
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const link =
    'rounded-lg border px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700';
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-emerald-200 bg-white p-6 text-center shadow-sm">
      <h2
        ref={heading}
        tabIndex={-1}
        className="text-2xl font-bold text-emerald-800 focus:outline-none"
      >
        {t('completeTitle')}
      </h2>
      <p>
        {t('completeSummary', {
          correct: props.correct,
          total: props.total,
          firstTry: props.firstTry,
        })}
      </p>
      <p className="text-lg font-semibold">{t('completePoints', { points: props.points })}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {props.nextLessonHref ? (
          <a
            href={props.nextLessonHref}
            className={`${link} border-emerald-700 bg-emerald-700 text-white`}
          >
            {t('nextLesson')}
          </a>
        ) : null}
        <button
          type="button"
          className={`${link} border-slate-300 bg-white`}
          onClick={props.onRestart}
        >
          {t('restart')}
        </button>
        <a href={props.lessonsHref} className={`${link} border-slate-300 bg-white`}>
          {t('backToLessons')}
        </a>
      </div>
    </div>
  );
}

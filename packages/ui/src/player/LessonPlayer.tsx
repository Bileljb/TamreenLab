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
import { track } from '../analytics/track';
import { api, announcePoints } from '../api/client';
import { useSession } from '../api/session';
import { Formula } from '../Formula';
import { SpreadsheetGrid, useGrid } from '../grid/SpreadsheetGrid';
import { Confetti } from './Confetti';
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
  // One lesson_start per view of the lesson (and per restart).
  useEffect(() => {
    track('lesson_start', { lessonSlug: lesson.slug });
  }, [lesson.slug, round]);

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
    if (action.type === 'checked' && after !== before) {
      track(after.status === 'correct' ? 'step_correct' : 'step_incorrect', {
        lessonSlug: lesson.slug,
        stepSlug: step.slug,
      });
    }
    if (!state.finished && next.finished) track('lesson_complete', { lessonSlug: lesson.slug });
    if (!state.finished && next.finished && !signedIn) guest.complete();
  }

  const totals = lessonTotals(state);
  const total = lesson.steps.length;

  // A floating "+300" when the lesson's points go up.
  const lastPoints = useRef(totals.points);
  const [gained, setGained] = useState<{ key: number; points: number } | null>(null);
  useEffect(() => {
    if (totals.points > lastPoints.current) {
      setGained({ key: Date.now(), points: totals.points - lastPoints.current });
    }
    lastPoints.current = totals.points;
  }, [totals.points]);

  return (
    <section
      className="flex flex-col gap-5 rounded-[var(--radius-card,1.25rem)] border border-line bg-raised p-4 shadow-soft sm:p-6"
      aria-label={lesson.titleAr}
    >
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium text-muted">
            {t('progress', { current: Math.min(state.index + 1, total), total })}
          </span>
          <span className="relative inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 font-semibold text-accent">
            <svg viewBox="0 0 20 20" className="size-4" fill="currentColor" aria-hidden>
              <path d="m10 1.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z" />
            </svg>
            <span data-testid="lesson-points">{t('points', { points: totals.points })}</span>
            {gained ? (
              <span
                key={gained.key}
                aria-hidden
                className="pointer-events-none absolute -top-2 end-1 animate-rise text-sm font-extrabold text-accent"
              >
                +{gained.points}
              </span>
            ) : null}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={t('progress', { current: Math.min(state.index + 1, total), total })}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={totals.settled}
          className="flex gap-1.5"
        >
          {state.steps.map((run, i) => (
            <span
              key={i}
              className={`h-2 flex-1 rounded-full transition-all duration-500 ${STEP_TONE[run.status]} ${
                i === state.index && !state.finished ? 'ring-2 ring-accent/50 ring-offset-2 ring-offset-raised' : ''
              }`}
            />
          ))}
        </div>
        {resumed ? <p className="text-sm text-muted">{t('resumed')}</p> : null}
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

/** The colour of each step's dot in the progress bar. */
const STEP_TONE: Record<StepRun['status'], string> = {
  idle: 'bg-line',
  incorrect: 'bg-bad/50',
  correct: 'bg-brand',
  done: 'bg-brand/60',
  revealed: 'bg-warn/60',
  skipped: 'bg-line-strong',
};

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
    'rounded-full border px-4 py-2 text-sm font-semibold transition disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';
  const primaryButton = `${button} border-brand bg-brand px-6 text-brand-ink shadow-glow hover:-translate-y-px hover:bg-brand-strong`;
  const ghostButton = `${button} border-transparent text-muted hover:bg-sunken hover:text-ink`;

  return (
    <div className="flex animate-fade-up flex-col gap-4">
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
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-3 transition ${
                  choice === i
                    ? 'border-brand bg-brand-soft shadow-glow'
                    : 'border-line bg-raised hover:-translate-y-px hover:border-line-strong'
                }`}
              >
                <input
                  type="radio"
                  name={`choice-${step.slug}`}
                  className="size-4 accent-brand"
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
          <p className="rounded-2xl bg-warn-soft px-4 py-3 text-warn">{t('shortcutSoon')}</p>
        ) : null}
      </div>

      <Feedback step={step} run={run} notice={notice} t={t} tf={tf} />

      {run.hintShown && step.hintAr ? (
        <aside className="flex animate-fade-up gap-3 rounded-2xl border border-info/30 bg-info-soft px-4 py-3 text-info">
          <svg viewBox="0 0 24 24" className="mt-1.5 size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z" />
          </svg>
          <Prompt text={step.hintAr} glossary={glossary} introduce={new Set()} />
        </aside>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        {settled ? (
          <button
            ref={continueButton}
            type="button"
            className={primaryButton}
            onClick={props.onNext}
          >
            {t('continue')}
          </button>
        ) : (
          <button
            type="button"
            className={primaryButton}
            onClick={check}
            disabled={step.type === 'SHORTCUT'}
          >
            {t('check')}
          </button>
        )}
        <span className="text-xs text-muted max-sm:hidden">{t('enterKeyHint')}</span>
        <span className="ms-auto flex flex-wrap gap-1">
          {step.hintAr && !run.hintShown && !settled ? (
            <button
              type="button"
              className={ghostButton}
              onClick={props.onHint}
            >
              {t('hint')}
            </button>
          ) : null}
          {!settled && step.type !== 'SHORTCUT' ? (
            <button
              type="button"
              className={ghostButton}
              onClick={props.onReveal}
            >
              {t('showAnswer')}
            </button>
          ) : null}
          <button
            type="button"
            className={ghostButton}
            onClick={props.onPrevious}
            disabled={!props.canGoBack}
          >
            {t('previous')}
          </button>
          {!settled ? (
            <button
              type="button"
              className={ghostButton}
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
  let icon: ReactNode = null;
  let motion = 'animate-fade-up';
  let content: ReactNode = null;
  if (notice) {
    tone = 'border-line-strong bg-canvas text-ink';
    content = t(notice);
  } else if (run.status === 'correct') {
    tone = 'border-brand/40 bg-brand-soft text-brand-strong';
    icon = <FeedbackIcon path="m5 12.5 4.5 4.5L19 7.5" className="bg-brand text-brand-ink" />;
    motion = 'animate-pop';
    content = run.points > 0 ? t('correct', { points: run.points }) : t('correctNoPoints');
  } else if (run.status === 'incorrect' && run.code) {
    tone = 'border-bad/40 bg-bad-soft text-bad';
    icon = <FeedbackIcon path="M7 7l10 10M17 7 7 17" className="bg-bad text-raised" />;
    motion = 'animate-shake';
    content =
      step.type === 'MULTIPLE_CHOICE'
        ? t('wrongChoice')
        : tf.rich(run.code as Exclude<FeedbackCode, 'OK'>, {
            f: (chunks) => <Formula>{chunks}</Formula>,
          });
  } else if (run.status === 'revealed') {
    tone = 'border-warn/40 bg-warn-soft text-warn';
    content = (
      <>
        <span className="font-semibold">{t('answer')}</span> {answerText(step)}
        <span className="block text-sm">{t('revealed')}</span>
      </>
    );
  } else if (run.status === 'done') {
    tone = 'border-line-strong bg-canvas text-ink-soft';
    content = t('doneBefore');
  } else if (run.status === 'skipped') {
    tone = 'border-line-strong bg-canvas text-ink-soft';
    content = t('skipped');
  }
  return (
    <div role="status" aria-live="polite" className="min-h-14" data-feedback={run.status}>
      {content ? (
        <div
          key={`${run.status}-${run.attempts}-${notice}`}
          className={`flex items-start gap-3 rounded-2xl border px-4 py-3 font-medium ${tone} ${motion}`}
        >
          {icon}
          <div className="flex-1">{content}</div>
        </div>
      ) : null}
    </div>
  );
}

function FeedbackIcon({ path, className }: { path: string; className: string }) {
  return (
    <span aria-hidden className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${className}`}>
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
      </svg>
    </span>
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
  const rate = props.total ? props.firstTry / props.total : 0;
  const stars = rate >= 0.8 ? 3 : rate >= 0.5 ? 2 : 1;
  const link =
    'rounded-full border px-5 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';
  const tiles = [
    { label: t('statCorrect'), value: `${props.correct}/${props.total}` },
    { label: t('statFirstTry'), value: String(props.firstTry) },
    { label: t('statPoints'), value: String(props.points) },
  ];
  return (
    <div className="relative flex animate-pop flex-col items-center gap-5 overflow-hidden rounded-2xl bg-brand-soft px-4 py-8 text-center">
      <Confetti />
      <div className="flex gap-1" role="img" aria-label={t('stars', { count: stars })}>
        {[1, 2, 3].map((n) => (
          <svg
            key={n}
            viewBox="0 0 24 24"
            className={`size-10 drop-shadow-sm ${n <= stars ? 'animate-pop text-amber-400' : 'text-line-strong'}`}
            style={{ animationDelay: `${n * 140}ms` }}
            fill="currentColor"
            aria-hidden
          >
            <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />
          </svg>
        ))}
      </div>
      <h2 ref={heading} tabIndex={-1} className="text-3xl font-extrabold text-brand-strong focus:outline-none">
        {t('completeTitle')}
      </h2>
      <p className="text-muted">
        {t('completeSummary', { correct: props.correct, total: props.total, firstTry: props.firstTry })}
      </p>
      <p className="sr-only">{t('completePoints', { points: props.points })}</p>
      <dl className="grid w-full max-w-md grid-cols-3 gap-3" aria-hidden>
        {tiles.map((tile) => (
          <div key={tile.label} className="flex flex-col rounded-2xl bg-raised px-2 py-3 shadow-soft">
            <dd className="text-2xl font-extrabold tabular-nums text-ink" dir="ltr">
              {tile.value}
            </dd>
            <dt className="text-xs text-muted">{tile.label}</dt>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap justify-center gap-2">
        {props.nextLessonHref ? (
          <a
            href={props.nextLessonHref}
            className={`${link} border-brand bg-brand text-brand-ink shadow-glow hover:-translate-y-px hover:bg-brand-strong`}
          >
            {t('nextLesson')}
          </a>
        ) : null}
        <button type="button" className={`${link} border-line-strong bg-raised text-ink hover:bg-sunken`} onClick={props.onRestart}>
          {t('restart')}
        </button>
        <a href={props.lessonsHref} className={`${link} border-line-strong bg-raised text-ink hover:bg-sunken`}>
          {t('backToLessons')}
        </a>
      </div>
    </div>
  );
}

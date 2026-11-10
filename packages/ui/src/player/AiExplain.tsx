'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ASSISTANT_MAX_FORMULA } from '@tamreen/shared';
import { api } from '../api/client';
import { Prompt } from '../prompt/Prompt';

type Answer = { cell: string; formula: string };

type State =
  | { status: 'idle' }
  | { status: 'loading'; formula: string }
  | { status: 'ai'; formula: string; id: string; text: string; voted: boolean }
  | { status: 'none'; formula: string };

type Props = {
  lessonSlug: string;
  stepSlug: string;
  /** The learner's last formula while the step is answered wrongly; null otherwise. */
  wrong: Answer | null;
  /** The step has a static hint to fall back to. */
  hasStaticHint: boolean;
  /** Counts as a hint (ADR 012); `static` also shows the static hint. */
  onUsed: (kind: 'ai' | 'static') => void;
};

/**
 * "Explain my mistake": an AI explanation of a wrong formula (PLAN Phase 8). Whatever goes
 * wrong, the learner gets the static hint or a plain notice; the server decides which.
 */
export function AiExplain({ lessonSlug, stepSlug, wrong, hasStaticHint, onUsed }: Props) {
  const t = useTranslations('player');
  const [state, setState] = useState<State>({ status: 'idle' });

  async function explain(answer: Answer) {
    setState({ status: 'loading', formula: answer.formula });
    const reply = await api
      .assistantHint({ lessonSlug, stepSlug, answer })
      .catch(() => ({ source: 'static' as const }));
    if (reply.source === 'ai') {
      setState({
        status: 'ai',
        formula: answer.formula,
        id: reply.id,
        text: reply.text,
        voted: false,
      });
      onUsed('ai');
      return;
    }
    setState({ status: 'none', formula: answer.formula });
    if (hasStaticHint) onUsed('static');
  }

  function vote(helpful: boolean) {
    if (state.status !== 'ai') return;
    setState({ ...state, voted: true });
    void api.assistantFeedback(state.id, helpful).catch(() => undefined);
  }

  const canAsk =
    wrong !== null &&
    wrong.formula.length <= ASSISTANT_MAX_FORMULA &&
    state.status !== 'loading' &&
    (state.status === 'idle' || state.formula !== wrong.formula);
  const smallButton =
    'rounded-full border border-line-strong bg-raised px-3 py-1 text-xs font-semibold text-ink transition hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

  return (
    <>
      {canAsk || state.status === 'loading' ? (
        <button
          type="button"
          className="inline-flex items-center gap-2 self-start rounded-full border border-info/40 bg-info-soft px-4 py-2 text-sm font-semibold text-info transition hover:-translate-y-px disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          disabled={state.status === 'loading'}
          onClick={() => wrong && void explain(wrong)}
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
            <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8zM19 14l.9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9z" />
          </svg>
          {state.status === 'loading' ? t('aiLoading') : t('aiExplain')}
        </button>
      ) : null}

      {state.status === 'none' && !hasStaticHint ? (
        <p role="status" className="text-sm text-muted">
          {t('aiUnavailable')}
        </p>
      ) : null}

      {state.status === 'ai' ? (
        <section
          aria-label={t('aiLabel')}
          className="flex animate-fade-up flex-col gap-2 rounded-2xl border border-info/30 bg-info-soft px-4 py-3 text-info"
        >
          <span className="text-xs font-bold uppercase tracking-wide">{t('aiLabel')}</span>
          <Prompt text={state.text} glossary={{}} introduce={new Set()} />
          <p className="text-xs text-ink-soft">{t('aiNote')}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
            {state.voted ? (
              <span>{t('aiThanks')}</span>
            ) : (
              <>
                <span>{t('aiHelpfulQuestion')}</span>
                <button type="button" className={smallButton} onClick={() => vote(true)}>
                  {t('aiHelpful')}
                </button>
                <button type="button" className={smallButton} onClick={() => vote(false)}>
                  {t('aiNotHelpful')}
                </button>
              </>
            )}
          </div>
        </section>
      ) : null}
    </>
  );
}

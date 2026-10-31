'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSession } from './session';

type Stage = 'idle' | 'confirm' | 'working' | 'deleted' | 'failed';

/**
 * Lets a signed-in learner delete their account and all its data (`DELETE /api/me`). Two steps,
 * so one stray click never deletes anything. Guests see nothing: their progress is only in the
 * browser.
 */
export function DeleteAccount() {
  const t = useTranslations('deleteAccount');
  const session = useSession();
  const [stage, setStage] = useState<Stage>('idle');

  if (session.status !== 'user' && stage !== 'deleted') return null;

  const button =
    'rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

  async function remove() {
    setStage('working');
    try {
      await session.deleteAccount();
      setStage('deleted');
    } catch {
      setStage('failed');
    }
  }

  return (
    <section
      aria-labelledby="delete-account"
      className="flex flex-col gap-3 rounded-xl border border-bad/30 bg-raised p-5"
    >
      <h2 id="delete-account" className="text-lg font-bold">
        {t('title')}
      </h2>
      {stage === 'deleted' ? null : <p className="leading-7 text-ink-soft">{t('explain')}</p>}

      {stage === 'idle' || stage === 'failed' ? (
        <div>
          <button
            type="button"
            className={`${button} border-bad/40 text-bad`}
            onClick={() => setStage('confirm')}
          >
            {t('start')}
          </button>
        </div>
      ) : null}

      {stage === 'confirm' || stage === 'working' ? (
        <div className="flex flex-col gap-3">
          <p className="font-medium text-bad">{t('warning')}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`${button} border-bad bg-bad text-raised`}
              disabled={stage === 'working'}
              onClick={() => void remove()}
            >
              {stage === 'working' ? t('working') : t('confirm')}
            </button>
            <button
              type="button"
              className={`${button} border-line-strong bg-raised`}
              disabled={stage === 'working'}
              onClick={() => setStage('idle')}
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      ) : null}

      <div role="status" aria-live="polite">
        {stage === 'deleted' ? t('done') : stage === 'failed' ? t('failed') : null}
      </div>
    </section>
  );
}

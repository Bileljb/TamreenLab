'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from './client';
import { useSession } from './session';

/**
 * "Download my data" (ADR 013): everything stored about the learner, as a JSON file. The request
 * goes through the API client, so an expired 15-minute session is refreshed first.
 */
export function DownloadMyData() {
  const t = useTranslations('exportData');
  const session = useSession();
  const [stage, setStage] = useState<'idle' | 'working' | 'failed'>('idle');
  if (session.status !== 'user') return null;

  async function download() {
    setStage('working');
    try {
      const data = await api.exportData();
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = `tamreenlab-data-${data.exportedAt.slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setStage('idle');
    } catch {
      setStage('failed');
    }
  }

  return (
    <section
      aria-labelledby="export-data"
      className="flex flex-col gap-3 rounded-xl border border-line bg-raised p-5"
    >
      <h2 id="export-data" className="text-lg font-bold">
        {t('title')}
      </h2>
      <p className="leading-7 text-ink-soft">{t('explain')}</p>
      <div>
        <button
          type="button"
          disabled={stage === 'working'}
          onClick={() => void download()}
          className="rounded-lg border border-line-strong bg-raised px-4 py-2 text-sm font-medium hover:bg-sunken disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {stage === 'working' ? t('working') : t('button')}
        </button>
      </div>
      <div role="status" aria-live="polite" className="text-sm text-bad">
        {stage === 'failed' ? t('failed') : null}
      </div>
    </section>
  );
}

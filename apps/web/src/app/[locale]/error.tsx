'use client';

import { useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { reportClientError } from '@tamreen/ui';

/** A page that crashed: say so in the page language, report it, and offer a way on (ADR 013). */
export default function PageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');
  const locale = useLocale();
  useEffect(() => reportClientError(error), [error]);

  const button =
    'rounded-full border px-5 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-extrabold text-ink">{t('title')}</h1>
      <p className="text-muted">{t('body')}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className={`${button} border-brand bg-brand text-brand-ink hover:bg-brand-strong`}
        >
          {t('retry')}
        </button>
        <a
          href={`/${locale}`}
          className={`${button} border-line-strong bg-raised text-ink hover:bg-sunken`}
        >
          {t('home')}
        </a>
      </div>
    </main>
  );
}

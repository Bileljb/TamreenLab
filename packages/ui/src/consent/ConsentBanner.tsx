'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useConsent, writeConsent } from './consent';

/**
 * Asks once about anonymous statistics and personalised ads (decision D5 picks the ad network and
 * may change the wording). Fixed to the bottom, so it never shifts the page layout.
 */
export function ConsentBanner({ privacyHref }: { privacyHref: string }) {
  const t = useTranslations('consent');
  const consent = useConsent();
  const [details, setDetails] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [ads, setAds] = useState(false);

  if (consent !== null) return null; // undecided only (undefined = not read yet)

  const button =
    'rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';
  return (
    <div
      role="region"
      aria-label={t('label')}
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl animate-fade-up rounded-[var(--radius-card,1.25rem)] border border-line bg-raised/95 p-5 shadow-lift backdrop-blur-xl"
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm leading-7 text-ink-soft">
          {t.rich('text', {
            link: (chunks) => (
              <a
                href={privacyHref}
                className="font-medium text-brand-strong underline underline-offset-4"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
        {details ? (
          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className="sr-only">{t('label')}</legend>
            <label className="flex items-center gap-2">
              <input
                className="size-4 accent-brand"
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
              />
              {t('analytics')}
            </label>
            <label className="flex items-center gap-2">
              <input className="size-4 accent-brand" type="checkbox" checked={ads} onChange={(e) => setAds(e.target.checked)} />
              {t('ads')}
            </label>
          </fieldset>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`${button} bg-brand text-brand-ink shadow-glow hover:bg-brand-strong`}
            onClick={() => writeConsent({ analytics: true, personalisedAds: true })}
          >
            {t('acceptAll')}
          </button>
          {details ? (
            <button
              type="button"
              className={`${button} border border-line-strong bg-raised text-ink hover:bg-sunken`}
              onClick={() => writeConsent({ analytics, personalisedAds: ads })}
            >
              {t('save')}
            </button>
          ) : (
            <button
              type="button"
              className={`${button} border border-line-strong bg-raised text-ink hover:bg-sunken`}
              onClick={() => setDetails(true)}
            >
              {t('choose')}
            </button>
          )}
          <button
            type="button"
            className={`${button} text-muted hover:bg-sunken hover:text-ink`}
            onClick={() => writeConsent({ analytics: false, personalisedAds: false })}
          >
            {t('rejectAll')}
          </button>
        </div>
      </div>
    </div>
  );
}

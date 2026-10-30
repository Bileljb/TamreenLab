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
    'rounded-lg px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700';
  return (
    <div
      role="region"
      aria-label={t('label')}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        <p className="text-sm leading-7 text-slate-700">
          {t.rich('text', {
            link: (chunks) => (
              <a
                href={privacyHref}
                className="font-medium text-emerald-800 underline underline-offset-4"
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
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
              />
              {t('analytics')}
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={ads} onChange={(e) => setAds(e.target.checked)} />
              {t('ads')}
            </label>
          </fieldset>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`${button} bg-emerald-700 text-white`}
            onClick={() => writeConsent({ analytics: true, personalisedAds: true })}
          >
            {t('acceptAll')}
          </button>
          {details ? (
            <button
              type="button"
              className={`${button} border border-slate-300 bg-white`}
              onClick={() => writeConsent({ analytics, personalisedAds: ads })}
            >
              {t('save')}
            </button>
          ) : (
            <button
              type="button"
              className={`${button} border border-slate-300 bg-white`}
              onClick={() => setDetails(true)}
            >
              {t('choose')}
            </button>
          )}
          <button
            type="button"
            className={`${button} text-slate-700`}
            onClick={() => writeConsent({ analytics: false, personalisedAds: false })}
          >
            {t('rejectAll')}
          </button>
        </div>
      </div>
    </div>
  );
}

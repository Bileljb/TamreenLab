'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '../api/client';

/**
 * The page a reminder email's "unsubscribe" link opens. It works without signing in: the link
 * carries the user id and a signed token (ADR 011).
 */
export function UnsubscribeConfirm({ homeHref }: { homeHref: string }) {
  const t = useTranslations('engagement');
  const [state, setState] = useState<'working' | 'done' | 'invalid'>('working');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const u = params.get('u');
    const token = params.get('t');
    if (!u || !token) {
      setState('invalid');
      return;
    }
    api.unsubscribe(u, token).then(
      () => setState('done'),
      () => setState('invalid'),
    );
  }, []);

  return (
    <div role="status" aria-live="polite" className="flex flex-col items-start gap-4">
      <p className="text-lg font-semibold" data-testid="unsubscribe-result">
        {state === 'working'
          ? t('unsubscribing')
          : state === 'done'
            ? t('unsubscribed')
            : t('unsubscribeInvalid')}
      </p>
      {state === 'done' ? <p className="text-muted">{t('unsubscribedHelp')}</p> : null}
      <a href={homeHref} className="font-semibold text-brand-strong underline underline-offset-4">
        {t('backHome')}
      </a>
    </div>
  );
}

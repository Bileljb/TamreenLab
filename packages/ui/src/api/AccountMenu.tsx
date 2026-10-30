'use client';

import { useTranslations } from 'next-intl';
import { useSession } from './session';

/** Header links: sign in / sign up for guests, the name and sign-out for learners. */
export function AccountMenu({ locale }: { locale: string }) {
  const t = useTranslations('header');
  const session = useSession();
  const link =
    'rounded-lg px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-emerald-700';

  if (session.status === 'loading') return <div className="h-8" aria-hidden />;
  if (session.status === 'user') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-700" data-testid="account-name">
          {t('greeting', { name: session.user.displayName })}
        </span>
        <button
          type="button"
          className={`${link} border border-slate-300 bg-white`}
          onClick={() => void session.logout()}
        >
          {t('signOut')}
        </button>
      </div>
    );
  }
  const here = typeof window === 'undefined' ? `/${locale}` : window.location.pathname;
  const next = `?next=${encodeURIComponent(here)}`;
  return (
    <div className="flex items-center gap-2">
      <a href={`/${locale}/login${next}`} className={`${link} text-emerald-800`}>
        {t('signIn')}
      </a>
      <a href={`/${locale}/register${next}`} className={`${link} bg-emerald-700 text-white`}>
        {t('signUp')}
      </a>
    </div>
  );
}

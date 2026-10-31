'use client';

import { useTranslations } from 'next-intl';
import { useSession } from './session';

/**
 * Header links: sign in / sign up for guests, the name and sign-out for learners. The `menu`
 * variant is the mobile menu's copy: only the guest sign-in link, which the header hides on
 * small screens to save space.
 */
export function AccountMenu({ locale, variant = 'header' }: { locale: string; variant?: 'header' | 'menu' }) {
  const t = useTranslations('header');
  const session = useSession();
  const link =
    'rounded-full px-3.5 py-1.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';
  const here = typeof window === 'undefined' ? `/${locale}` : window.location.pathname;
  const next = `?next=${encodeURIComponent(here)}`;

  if (variant === 'menu') {
    if (session.status !== 'guest') return null;
    return (
      <a href={`/${locale}/login${next}`} className="block rounded-xl px-3 py-2 font-medium hover:bg-sunken">
        {t('signIn')}
      </a>
    );
  }

  if (session.status === 'loading') return <div className="h-8 w-24" aria-hidden />;
  if (session.status === 'user') {
    const initial = session.user.displayName.trim().charAt(0).toUpperCase();
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-2 text-sm text-ink-soft">
          <span
            aria-hidden
            className="brand-gradient grid size-8 place-items-center rounded-full text-sm font-bold text-white shadow-sm"
          >
            {initial}
          </span>
          <span className="max-sm:hidden" data-testid="account-name">
            {t('greeting', { name: session.user.displayName })}
          </span>
        </span>
        <button
          type="button"
          className={`${link} border border-line-strong bg-raised text-ink hover:bg-sunken`}
          onClick={() => void session.logout()}
        >
          {t('signOut')}
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <a href={`/${locale}/login${next}`} className={`${link} text-ink-soft hover:bg-sunken max-sm:hidden`}>
        {t('signIn')}
      </a>
      <a
        href={`/${locale}/register${next}`}
        className={`${link} bg-brand text-brand-ink shadow-glow hover:-translate-y-px hover:bg-brand-strong`}
      >
        {t('signUp')}
      </a>
    </div>
  );
}

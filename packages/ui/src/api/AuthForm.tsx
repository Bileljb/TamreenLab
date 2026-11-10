'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { ApiError } from './client';
import { useSession } from './session';

type Props = {
  mode: 'signIn' | 'signUp';
  /** The forgotten-password page, linked under the sign-in form. */
  forgotHref?: string;
  /** Where to go after success when the URL has no safe ?next= (e.g. the home page). */
  fallbackNext: string;
  /** Link to the other form. */
  switchHref: string;
};

const KNOWN_ERRORS = [
  'EMAIL_TAKEN',
  'INVALID_CREDENTIALS',
  'DISPLAY_NAME_NOT_ALLOWED',
  'VALIDATION_ERROR',
  'RATE_LIMITED',
  'NETWORK',
];

/** Only same-site paths: never redirect to another origin after sign-in. */
export function safeNext(raw: string | null, fallback: string): string {
  return raw && /^\/(?![/\\])[^\\]*$/.test(raw) ? raw : fallback;
}

export function AuthForm({ mode, fallbackNext, switchHref, forgotHref }: Props) {
  const t = useTranslations('auth');
  const session = useSession();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signUp') {
        await session.register({
          email,
          password,
          displayName: String(form.get('displayName') ?? ''),
          // Unticked by default: no reminder emails without an explicit opt-in (ADR 011).
          emailOptIn: form.get('emailOptIn') === 'on',
        });
      } else {
        await session.login({ email, password });
      }
      window.location.assign(
        safeNext(new URLSearchParams(window.location.search).get('next'), fallbackNext),
      );
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'other';
      setError(KNOWN_ERRORS.includes(code) ? code : 'other');
      setBusy(false);
    }
  }

  const input =
    'w-full rounded-xl border border-line-strong bg-canvas px-3.5 py-2.5 transition outline-none focus:border-brand focus:bg-raised focus:shadow-glow';

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {mode === 'signUp' ? (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-ink-soft">{t('displayName')}</span>
          <input
            name="displayName"
            required
            minLength={2}
            maxLength={30}
            autoComplete="nickname"
            className={input}
          />
          <span className="text-xs text-muted">{t('displayNameHint')}</span>
        </label>
      ) : null}
      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-ink-soft">{t('email')}</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          dir="ltr"
          className={input}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-ink-soft">{t('password')}</span>
        <input
          name="password"
          type="password"
          required
          minLength={mode === 'signUp' ? 8 : 1}
          autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
          dir="ltr"
          className={input}
        />
        {mode === 'signUp' ? <span className="text-xs text-muted">{t('passwordHint')}</span> : null}
      </label>
      {mode === 'signIn' && forgotHref ? (
        <a
          href={forgotHref}
          className="-mt-2 self-start text-sm text-brand-strong underline underline-offset-4"
        >
          {t('forgotLink')}
        </a>
      ) : null}
      {mode === 'signUp' ? (
        <label className="flex items-start gap-2.5 text-sm text-ink-soft">
          <input name="emailOptIn" type="checkbox" className="mt-1 size-4 accent-brand" />
          <span>{t('emailOptIn')}</span>
        </label>
      ) : null}
      <div role="alert" aria-live="assertive" className="min-h-6 text-sm text-bad">
        {error ? t(`errors.${error}`) : null}
      </div>
      <button
        type="submit"
        disabled={busy}
        className="rounded-full bg-brand px-4 py-3 font-semibold text-brand-ink shadow-glow transition hover:-translate-y-px hover:bg-brand-strong disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {busy ? t('working') : t(mode === 'signUp' ? 'submitSignUp' : 'submitSignIn')}
      </button>
      <p className="text-sm text-muted">
        {t(mode === 'signUp' ? 'haveAccount' : 'noAccount')}{' '}
        <a href={switchHref} className="font-medium text-brand-strong underline underline-offset-4">
          {t(mode === 'signUp' ? 'submitSignIn' : 'submitSignUp')}
        </a>
      </p>
    </form>
  );
}

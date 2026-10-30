'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { ApiError } from './client';
import { useSession } from './session';

type Props = {
  mode: 'signIn' | 'signUp';
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

export function AuthForm({ mode, fallbackNext, switchHref }: Props) {
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
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:outline-2 focus:outline-emerald-600';

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {mode === 'signUp' ? (
        <label className="flex flex-col gap-1">
          <span className="font-medium">{t('displayName')}</span>
          <input
            name="displayName"
            required
            minLength={2}
            maxLength={30}
            autoComplete="nickname"
            className={input}
          />
          <span className="text-xs text-slate-500">{t('displayNameHint')}</span>
        </label>
      ) : null}
      <label className="flex flex-col gap-1">
        <span className="font-medium">{t('email')}</span>
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
        <span className="font-medium">{t('password')}</span>
        <input
          name="password"
          type="password"
          required
          minLength={mode === 'signUp' ? 8 : 1}
          autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
          dir="ltr"
          className={input}
        />
        {mode === 'signUp' ? (
          <span className="text-xs text-slate-500">{t('passwordHint')}</span>
        ) : null}
      </label>
      <div role="alert" aria-live="assertive" className="min-h-6 text-sm text-rose-800">
        {error ? t(`errors.${error}`) : null}
      </div>
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
      >
        {busy ? t('working') : t(mode === 'signUp' ? 'submitSignUp' : 'submitSignIn')}
      </button>
      <p className="text-sm text-slate-600">
        {t(mode === 'signUp' ? 'haveAccount' : 'noAccount')}{' '}
        <a href={switchHref} className="font-medium text-emerald-800 underline underline-offset-4">
          {t(mode === 'signUp' ? 'submitSignIn' : 'submitSignUp')}
        </a>
      </p>
    </form>
  );
}

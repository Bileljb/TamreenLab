'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ApiError, api } from './client';

const input =
  'w-full rounded-xl border border-line-strong bg-canvas px-3.5 py-2.5 transition outline-none focus:border-brand focus:bg-raised focus:shadow-glow';
const submit =
  'rounded-full bg-brand px-4 py-3 font-semibold text-brand-ink shadow-glow transition hover:-translate-y-px hover:bg-brand-strong disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';
const link = 'font-medium text-brand-strong underline underline-offset-4';

const KNOWN_ERRORS = ['INVALID_RESET_TOKEN', 'VALIDATION_ERROR', 'RATE_LIMITED', 'NETWORK'];

function errorKey(err: unknown): string {
  const code = err instanceof ApiError ? err.code : 'other';
  return KNOWN_ERRORS.includes(code) ? code : 'other';
}

function Field(props: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-semibold text-ink-soft">{props.label}</span>
      {props.children}
    </label>
  );
}

/** Asks for the email; the answer never says whether an account exists (ADR 013). */
export function ForgotPasswordForm({ loginHref }: { loginHref: string }) {
  const t = useTranslations('auth');
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get('email') ?? '');
    setState('busy');
    setError(null);
    try {
      await api.forgotPassword(email);
      setState('sent');
    } catch (err) {
      setError(errorKey(err));
      setState('idle');
    }
  }

  if (state === 'sent') {
    return (
      <div className="flex flex-col gap-4">
        <p role="status">{t('forgotSent')}</p>
        <a href={loginHref} className={link}>
          {t('backToSignIn')}
        </a>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <p className="text-muted">{t('forgotIntro')}</p>
      <Field label={t('email')}>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          dir="ltr"
          className={input}
        />
      </Field>
      <div role="alert" aria-live="assertive" className="min-h-6 text-sm text-bad">
        {error ? t(`errors.${error}`) : null}
      </div>
      <button type="submit" disabled={state === 'busy'} className={submit}>
        {state === 'busy' ? t('working') : t('forgotSubmit')}
      </button>
      <a href={loginHref} className={`${link} text-sm`}>
        {t('backToSignIn')}
      </a>
    </form>
  );
}

/**
 * Sets a new password from the emailed link. The token is read once and removed from the address
 * bar, so it stays out of the history and of anything that reads the URL later.
 */
export function ResetPasswordForm({
  loginHref,
  forgotHref,
}: {
  loginHref: string;
  forgotHref: string;
}) {
  const t = useTranslations('auth');
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    setToken(url.searchParams.get('token'));
    url.searchParams.delete('token');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get('password') ?? '');
    if (password !== String(form.get('confirm') ?? '')) {
      setError('passwordsDiffer');
      return;
    }
    setState('busy');
    setError(null);
    try {
      await api.resetPassword(token!, password);
      setState('done');
    } catch (err) {
      setError(errorKey(err));
      setState('idle');
    }
  }

  if (token === undefined) return null;
  const newLink = (
    <a href={forgotHref} className={link}>
      {t('requestNewLink')}
    </a>
  );
  if (!token) {
    return (
      <div className="flex flex-col gap-4">
        <p>{t('resetInvalid')}</p>
        {newLink}
      </div>
    );
  }
  if (state === 'done') {
    return (
      <div className="flex flex-col gap-4">
        <p role="status">{t('resetDone')}</p>
        <a href={loginHref} className={link}>
          {t('submitSignIn')}
        </a>
      </div>
    );
  }
  const message =
    error === 'passwordsDiffer'
      ? t('passwordsDiffer')
      : error === 'INVALID_RESET_TOKEN'
        ? t('resetInvalid')
        : error
          ? t(`errors.${error}`)
          : null;
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1">
        <Field label={t('newPassword')}>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            aria-describedby="new-password-hint"
            dir="ltr"
            className={input}
          />
        </Field>
        <span id="new-password-hint" className="text-xs text-muted">
          {t('passwordHint')}
        </span>
      </div>
      <Field label={t('confirmPassword')}>
        <input
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          dir="ltr"
          className={input}
        />
      </Field>
      <div role="alert" aria-live="assertive" className="min-h-6 text-sm text-bad">
        {message}
      </div>
      {error === 'INVALID_RESET_TOKEN' ? newLink : null}
      <button type="submit" disabled={state === 'busy'} className={submit}>
        {state === 'busy' ? t('working') : t('resetSubmit')}
      </button>
    </form>
  );
}

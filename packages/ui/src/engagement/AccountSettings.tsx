'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { DAILY_GOALS, type SettingsUpdate } from '@tamreen/shared';
import { useSession } from '../api/session';

/**
 * Daily goal, streak freeze and weekly reminder emails (Phase 7). Each change is saved at once;
 * reminders stay off unless the learner switches them on here or at sign-up (ADR 011).
 */
export function AccountSettings({ loginHref }: { loginHref: string }) {
  const t = useTranslations('engagement');
  const session = useSession();
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  if (session.status === 'loading') return null;
  if (session.status !== 'user') {
    return (
      <p className="text-ink-soft">
        {t.rich('settingsGuest', {
          link: (chunks) => (
            <a
              href={loginHref}
              className="font-semibold text-brand-strong underline underline-offset-4"
            >
              {chunks}
            </a>
          ),
        })}
      </p>
    );
  }

  const { settings } = session.user;
  async function save(update: SettingsUpdate) {
    setStatus('saving');
    try {
      await session.updateSettings(update);
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }

  const card =
    'flex flex-col gap-3 rounded-[var(--radius-card,1.25rem)] border border-line bg-raised p-5 shadow-soft';
  const toggle = (checked: boolean) =>
    `relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${checked ? 'bg-brand' : 'bg-line-strong'}`;
  const knob = (checked: boolean) =>
    `inline-block size-5 rounded-full bg-white shadow transition ${checked ? 'translate-x-6 rtl:-translate-x-6' : 'translate-x-1 rtl:-translate-x-1'}`;

  return (
    <div className="flex flex-col gap-5">
      <fieldset className={card}>
        <legend className="sr-only">{t('goalTitle')}</legend>
        <h2 className="text-lg font-bold" aria-hidden>
          {t('goalTitle')}
        </h2>
        <p className="text-sm text-muted">{t('goalHelp')}</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {DAILY_GOALS.map((goal) => (
            <label
              key={goal}
              className={`flex cursor-pointer flex-col gap-0.5 rounded-2xl border-2 px-4 py-3 transition ${
                settings.dailyGoal === goal
                  ? 'border-brand bg-brand-soft'
                  : 'border-line hover:border-line-strong'
              }`}
            >
              <span className="flex items-center gap-2 font-semibold">
                <input
                  type="radio"
                  name="dailyGoal"
                  className="size-4 accent-brand"
                  checked={settings.dailyGoal === goal}
                  onChange={() => void save({ dailyGoal: goal })}
                />
                {t(`goal${goal}`)}
              </span>
              <span className="text-xs text-muted tabular-nums">
                {t('goalPoints', { points: goal })}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {(
        [
          ['streakFreeze', settings.streakFreeze, 'freezeTitle', 'freezeHelp'],
          ['emailOptIn', settings.emailOptIn, 'emailTitle', 'emailHelp'],
        ] as const
      ).map(([key, checked, title, help]) => (
        <div key={key} className={card}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 id={`setting-${key}`} className="text-lg font-bold">
                {t(title)}
              </h2>
              <p className="text-sm text-muted">{t(help)}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={checked}
              aria-labelledby={`setting-${key}`}
              data-testid={`setting-${key}`}
              className={toggle(checked)}
              onClick={() => void save({ [key]: !checked })}
            >
              <span className={knob(checked)} />
            </button>
          </div>
        </div>
      ))}

      <p role="status" aria-live="polite" className="min-h-6 text-sm text-muted">
        {status === 'saving'
          ? t('saving')
          : status === 'saved'
            ? t('saved')
            : status === 'error'
              ? t('saveError')
              : null}
      </p>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Stats } from '@tamreen/shared';
import { api } from '../api/client';
import { useSession } from '../api/session';
import { GoalRing, LevelBar } from './Progress';

type Props = {
  locale: string;
  /** Lesson titles in the page language, by slug, for "continue". */
  lessonTitles: Record<string, string>;
};

/**
 * The returning learner's panel on the home page (Phase 7): level, today's goal, streak, mistakes
 * waiting for review, and where to continue. Guests see nothing here.
 */
export function WelcomeBack({ locale, lessonTitles }: Props) {
  const t = useTranslations('engagement');
  const session = useSession();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (session.status !== 'user') return;
    api.stats().then(setStats, () => setStats(null));
  }, [session.status]);

  if (session.status !== 'user' || !stats) return null;
  const next = stats.nextLesson;
  const button =
    'rounded-full px-5 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

  return (
    <section
      aria-labelledby="welcome-back"
      className="mx-auto w-full max-w-6xl px-4 pt-8"
      data-testid="welcome-back"
    >
      <div className="grid gap-5 rounded-[var(--radius-card,1.25rem)] border border-line bg-raised p-5 shadow-soft sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
        <div className="flex flex-col gap-4">
          <h2 id="welcome-back" className="text-xl font-extrabold">
            {t('welcomeBack', { name: session.user.displayName })}
          </h2>
          <LevelBar {...stats.level} />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <GoalRing today={stats.pointsToday} goal={stats.dailyGoal} />
            <p className="text-sm text-ink-soft" data-testid="welcome-streak">
              {stats.streak.current > 0
                ? t('streakDays', { days: stats.streak.current })
                : t('streakNone')}
              {stats.streak.frozen ? (
                <span className="block text-xs text-info">{t('frozen')}</span>
              ) : null}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          {next ? (
            <a
              href={`/${locale}/lessons/${next.track}/${next.slug}`}
              className={`${button} bg-brand text-center text-brand-ink shadow-glow hover:-translate-y-px hover:bg-brand-strong`}
            >
              {t('continue', { lesson: lessonTitles[next.slug] ?? next.slug })}
            </a>
          ) : null}
          {stats.reviewsDue > 0 ? (
            <a
              href={`/${locale}/review`}
              className={`${button} border border-line-strong bg-raised text-center text-ink hover:bg-sunken`}
            >
              {t('reviewDue', { count: stats.reviewsDue })}
            </a>
          ) : null}
          <a
            href={`/${locale}/account`}
            className="text-center text-xs text-muted underline underline-offset-4 hover:text-ink"
          >
            {t('settingsLink')}
          </a>
        </div>
      </div>
    </section>
  );
}

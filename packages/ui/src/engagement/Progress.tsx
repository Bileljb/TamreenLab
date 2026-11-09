'use client';

import { useTranslations } from 'next-intl';

/** The learner's level and how far into it they are. */
export function LevelBar({ level, into, span }: { level: number; into: number; span: number }) {
  const t = useTranslations('engagement');
  const pct = span > 0 ? Math.min(100, Math.round((into / span) * 100)) : 0;
  return (
    <div className="flex flex-col gap-1.5" data-testid="level">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-bold text-ink">{t('level', { level })}</span>
        <span className="text-xs text-muted tabular-nums">
          {t('toNextLevel', { points: span - into })}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={t('levelProgress', { level })}
        aria-valuemin={0}
        aria-valuemax={span}
        aria-valuenow={into}
        className="h-2.5 overflow-hidden rounded-full bg-sunken"
      >
        <div
          className="brand-gradient h-full rounded-full transition-[width] duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** Today's points against the daily goal, as a ring. */
export function GoalRing({
  today,
  goal,
  size = 64,
}: {
  today: number;
  goal: number;
  size?: number;
}) {
  const t = useTranslations('engagement');
  const ratio = goal > 0 ? Math.min(1, today / goal) : 0;
  const r = 26;
  const c = 2 * Math.PI * r;
  const done = today >= goal;
  return (
    <div className="flex items-center gap-3" data-testid="daily-goal">
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        role="img"
        aria-label={t('goalProgress', { today, goal })}
        className="-rotate-90"
      >
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="7" className="stroke-sunken" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          className={`transition-[stroke-dashoffset] duration-700 ${done ? 'stroke-brand' : 'stroke-accent'}`}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - ratio)}
        />
      </svg>
      <div className="flex flex-col text-sm">
        <span className="font-bold text-ink">{done ? t('goalDone') : t('goalTitle')}</span>
        <span className="text-muted tabular-nums" dir="ltr">
          {today} / {goal}
        </span>
      </div>
    </div>
  );
}

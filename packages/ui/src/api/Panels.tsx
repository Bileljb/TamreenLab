'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Leaderboard, Stats } from '@tamreen/shared';
import { POINTS_EVENT, api } from './client';
import { useSession } from './session';

/** Reloads when the server awards points. */
function useReload(load: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    load();
    window.addEventListener(POINTS_EVENT, load);
    return () => window.removeEventListener(POINTS_EVENT, load);
  }, [load, enabled]);
}

const box = 'rounded-[var(--radius-card,1.25rem)] border border-line bg-raised p-5 shadow-soft';
const title = 'mb-4 flex items-center gap-2 font-bold';

/** Gold, silver and bronze for the top three. */
const MEDALS = ['bg-amber-400 text-amber-950', 'bg-slate-300 text-slate-800', 'bg-orange-300 text-orange-950'];

export function StatsPanel({ loginHref }: { loginHref: string }) {
  const t = useTranslations('panels');
  const session = useSession();
  const [stats, setStats] = useState<Stats | null>(null);
  const [load] = useState(() => () => {
    api.stats().then(setStats, () => setStats(null));
  });
  useReload(load, session.status === 'user');

  return (
    <section className={box} aria-labelledby="stats-title">
      <h2 id="stats-title" className={title}>
        <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-brand-soft text-brand-strong">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
        </span>
        {t('statsTitle')}
      </h2>
      {session.status === 'user' && stats ? (
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {(
            [
              ['pointsToday', stats.pointsToday],
              ['pointsTotal', stats.pointsTotal],
              ['streak', stats.streak.current],
              [
                'accuracy',
                stats.firstTryAccuracy === null
                  ? '—'
                  : `${Math.round(stats.firstTryAccuracy * 100)}%`,
              ],
            ] as const
          ).map(([key, value]) => (
            <div key={key} className="flex flex-col-reverse rounded-xl bg-sunken p-3">
              <dt className="text-xs text-muted">{t(key)}</dt>
              <dd className="text-2xl font-extrabold tabular-nums text-ink" data-testid={`stat-${key}`}>
                <bdi>{value}</bdi>
              </dd>
            </div>
          ))}
        </dl>
      ) : session.status === 'guest' ? (
        <p className="text-sm text-muted">
          {t.rich('statsGuest', {
            link: (chunks) => (
              <a
                href={loginHref}
                className="font-medium text-brand-strong underline underline-offset-4"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
      ) : null}
    </section>
  );
}

export function LeaderboardPanel() {
  const t = useTranslations('panels');
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [load] = useState(() => () => {
    api.leaderboard(10).then(setBoard, () => setBoard(null));
  });
  useReload(load, true);

  return (
    <section className={box} aria-labelledby="leaderboard-title">
      <h2 id="leaderboard-title" className={title}>
        <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-accent-soft text-accent">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 3M17 6h3a3 3 0 0 1-3 3" /></svg>
        </span>
        {t('leaderboardTitle')}
      </h2>
      {board && board.entries.length > 0 ? (
        <ol className="flex flex-col gap-1 text-sm" data-testid="leaderboard">
          {board.entries.map((e) => (
            <li
              key={e.rank}
              className={`flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 ${
                e.isMe ? 'bg-brand-soft font-semibold ring-1 ring-brand/30' : ''
              }`}
            >
              <span className="flex items-center gap-2">
                <span
                  className={`grid size-6 place-items-center rounded-full text-xs font-bold ${
                    MEDALS[e.rank - 1] ?? 'bg-sunken text-muted'
                  }`}
                >
                  {e.rank}
                </span>
                <bdi>{e.displayName}</bdi>
                {e.isMe ? <span className="text-brand-strong">({t('you')})</span> : null}
              </span>
              <span className="font-semibold tabular-nums text-ink-soft">{t('pointsShort', { points: e.points })}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted">{t('leaderboardEmpty')}</p>
      )}
    </section>
  );
}

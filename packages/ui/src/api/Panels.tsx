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

const box = 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm';

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
      <h2 id="stats-title" className="mb-3 font-semibold">
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
            <div key={key} className="rounded-lg bg-slate-50 p-2">
              <dt className="text-slate-600">{t(key)}</dt>
              <dd className="text-lg font-bold text-emerald-800" data-testid={`stat-${key}`}>
                <bdi>{value}</bdi>
              </dd>
            </div>
          ))}
        </dl>
      ) : session.status === 'guest' ? (
        <p className="text-sm text-slate-600">
          {t.rich('statsGuest', {
            link: (chunks) => (
              <a
                href={loginHref}
                className="font-medium text-emerald-800 underline underline-offset-4"
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
      <h2 id="leaderboard-title" className="mb-3 font-semibold">
        {t('leaderboardTitle')}
      </h2>
      {board && board.entries.length > 0 ? (
        <ol className="flex flex-col gap-1 text-sm" data-testid="leaderboard">
          {board.entries.map((e) => (
            <li
              key={e.rank}
              className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1 ${
                e.isMe ? 'bg-emerald-50 font-semibold' : ''
              }`}
            >
              <span className="flex gap-2">
                <span className="w-5 text-slate-500">{e.rank}</span>
                <bdi>{e.displayName}</bdi>
                {e.isMe ? <span className="text-emerald-700">({t('you')})</span> : null}
              </span>
              <span>{t('pointsShort', { points: e.points })}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-slate-600">{t('leaderboardEmpty')}</p>
      )}
    </section>
  );
}

'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import { useTranslations } from 'next-intl';
import type { LessonPlayer as Player } from '@tamreen/ui';

function Loading() {
  const t = useTranslations('lesson');
  return (
    <div className="flex h-full items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500">
      {t('loading')}
    </div>
  );
}

// The grid and engine load only in the browser, after the explanation has painted (PLAN Phase 5).
const LessonPlayer = dynamic(() => import('@tamreen/ui').then((m) => m.LessonPlayer), {
  ssr: false,
  loading: Loading,
});

/** Reserves the player's height up front, so loading it never shifts the page (CLS). */
export function LessonIsland({
  minHeight,
  ...props
}: ComponentProps<typeof Player> & { minHeight: number }) {
  return (
    <div style={{ minHeight }} className="flex flex-col [&>*]:flex-1">
      <LessonPlayer {...props} />
    </div>
  );
}

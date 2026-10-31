'use client';

import dynamic from 'next/dynamic';
import { createContext, useContext, type ComponentProps, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { LessonPlayer as Player } from '@tamreen/ui';

/** Server-rendered first step, shown until the player loads (see LessonPreview). */
const PreviewContext = createContext<ReactNode>(null);

function Loading() {
  const t = useTranslations('lesson');
  const preview = useContext(PreviewContext);
  return (
    <div className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-line bg-raised p-4 shadow-soft sm:p-6">
      {preview}
      <div className="flex flex-1 animate-pulse items-center justify-center rounded-xl border border-line bg-sunken text-muted">
        {t('loading')}
      </div>
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
  preview,
  ...props
}: ComponentProps<typeof Player> & { minHeight: number; preview: ReactNode }) {
  return (
    <PreviewContext.Provider value={preview}>
      <div style={{ minHeight }} className="flex flex-col [&>*]:flex-1">
        <LessonPlayer {...props} />
      </div>
    </PreviewContext.Provider>
  );
}

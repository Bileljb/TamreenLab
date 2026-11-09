'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LessonFileSchema, type Glossary, type LessonFile } from '@tamreen/shared';
import { api } from '../api/client';
import { useSession } from '../api/session';
import { LessonPlayer } from '../player/LessonPlayer';

type Props = {
  locale: string;
  glossary: Glossary;
  lessonsHref: string;
  loginHref: string;
  /** `/[locale]/lessons`: each lesson is served as JSON at `<base>/<track>/<slug>/data`. */
  lessonsBase: string;
};

type Loaded = { lesson: LessonFile; lessonSlugs: string[] } | 'empty' | 'error';

/**
 * "Review mistakes" (ADR 011): the missed steps that are due today, from every lesson, played in
 * one session. The queue comes from the API; the step text comes from the content in the page
 * language, so the review reads the same as the lesson did.
 */
export function ReviewSession({ locale, glossary, lessonsHref, loginHref, lessonsBase }: Props) {
  const t = useTranslations('engagement');
  const session = useSession();
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (session.status !== 'user') return;
    let cancelled = false;
    (async () => {
      const { items } = await api.review();
      if (items.length === 0) return 'empty' as const;
      const lessons = new Map<string, LessonFile>();
      for (const item of items) {
        if (lessons.has(item.lessonSlug)) continue;
        const res = await fetch(`${lessonsBase}/${item.track}/${item.lessonSlug}/data`);
        if (!res.ok) continue;
        lessons.set(item.lessonSlug, LessonFileSchema.parse(await res.json()));
      }
      const picked = items.flatMap((item) => {
        const step = lessons.get(item.lessonSlug)?.steps.find((s) => s.slug === item.stepSlug);
        return step ? [{ step, lessonSlug: item.lessonSlug }] : [];
      });
      if (picked.length === 0) return 'empty' as const;
      const lesson: LessonFile = {
        ...[...lessons.values()][0]!,
        slug: 'review',
        titleAr: t('reviewTitle'),
        steps: picked.map((p) => p.step),
      };
      return { lesson, lessonSlugs: picked.map((p) => p.lessonSlug) };
    })().then(
      (result) => !cancelled && setLoaded(result),
      () => !cancelled && setLoaded('error'),
    );
    return () => {
      cancelled = true;
    };
  }, [session.status, lessonsBase, t]);

  if (session.status === 'loading') return null;
  if (session.status !== 'user') {
    return (
      <p className="text-ink-soft">
        {t.rich('reviewGuest', {
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
  if (loaded === null) return <p className="text-muted">{t('loading')}</p>;
  if (loaded === 'error') return <p className="text-bad">{t('reviewError')}</p>;
  if (loaded === 'empty') {
    return (
      <div className="flex flex-col items-start gap-3 rounded-[var(--radius-card,1.25rem)] border border-line bg-raised p-6 shadow-soft">
        <p className="text-lg font-semibold" data-testid="review-empty">
          {t('reviewEmpty')}
        </p>
        <a
          href={lessonsHref}
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-ink shadow-glow"
        >
          {t('reviewToLessons')}
        </a>
      </div>
    );
  }
  return (
    <div lang={locale}>
      <LessonPlayer
        lesson={loaded.lesson}
        glossary={glossary}
        lessonsHref={lessonsHref}
        review={{ lessonSlugs: loaded.lessonSlugs }}
      />
    </div>
  );
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LeaderboardPanel, LessonPlayer, StatsPanel } from '@tamreen/ui';
import { getGlossary, getLesson, listLessons } from '@/lib/content';

type Params = { locale: string; track: string; slug: string };
type Props = { params: Promise<Params> };

export const dynamicParams = false;

export async function generateStaticParams() {
  const lessons = await listLessons();
  return lessons.map((l) => ({ track: l.track, slug: l.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { track, slug } = await params;
  const found = await getLesson(track, slug);
  if (!found) return {};
  return { title: found.lesson.titleAr, description: found.lesson.summaryAr };
}

export default async function LessonPage({ params }: Props) {
  const { locale, track, slug } = await params;
  setRequestLocale(locale);
  const [found, glossary, t] = await Promise.all([
    getLesson(track, slug),
    getGlossary(),
    getTranslations('lesson'),
  ]);
  if (!found) notFound();
  const { lesson, next } = found;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <nav aria-label={t('breadcrumb')} className="text-sm text-slate-500">
        <a href={`/${locale}`} className="underline-offset-4 hover:underline">
          {t('home')}
        </a>
        <span aria-hidden className="mx-2">
          ‹
        </span>
        <span aria-current="page">{lesson.titleAr}</span>
      </nav>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold sm:text-3xl">{lesson.titleAr}</h1>
        <p className="text-slate-600">{lesson.summaryAr}</p>
      </div>
      <LessonPlayer
        lesson={lesson}
        glossary={glossary}
        lessonsHref={`/${locale}`}
        nextLessonHref={next ? `/${locale}/lessons/${next.track}/${next.slug}` : undefined}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <StatsPanel
          loginHref={`/${locale}/login?next=${encodeURIComponent(`/${locale}/lessons/${track}/${slug}`)}`}
        />
        <LeaderboardPanel />
      </div>
    </main>
  );
}

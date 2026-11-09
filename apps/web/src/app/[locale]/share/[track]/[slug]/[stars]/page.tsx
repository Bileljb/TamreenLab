import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Locale } from '@tamreen/shared';
import { PageHero } from '@/components/PageHero';
import { TrackIcon } from '@/components/TrackIcon';
import { getLesson, lessonHref, listLessons } from '@/lib/content';
import { pageMetadata } from '@/lib/seo';

type Params = { locale: string; track: string; slug: string; stars: string };
type Props = { params: Promise<Params> };

const STAR_COUNTS = ['1', '2', '3'];
export const dynamicParams = false;

export async function generateStaticParams() {
  const lessons = await listLessons('ar');
  return lessons.flatMap((l) =>
    STAR_COUNTS.map((stars) => ({ track: l.track, slug: l.slug, stars })),
  );
}

async function load(params: Params) {
  const found = await getLesson(params.locale as Locale, params.track, params.slug);
  return found && STAR_COUNTS.includes(params.stars) ? found.lesson : null;
}

/**
 * The page a shared result links to (Phase 7): the lesson, the stars, and a way in. Only the stars
 * travel in the link (no name or points), so a shared link says nothing about the person.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await params;
  const lesson = await load(p);
  if (!lesson) return {};
  const t = await getTranslations({ locale: p.locale, namespace: 'pages.share' });
  return pageMetadata({
    path: `/${p.locale}/share/${p.track}/${p.slug}/${p.stars}`,
    title: t('title', { lesson: lesson.titleAr }),
    description: t('text'),
    // A thin page that exists to be shared: link previews read it, search engines need not.
    noindex: true,
  });
}

export default async function SharePage({ params }: Props) {
  const p = await params;
  setRequestLocale(p.locale);
  const lesson = await load(p);
  if (!lesson) notFound();
  const t = await getTranslations('pages.share');
  const stars = Number(p.stars);
  return (
    <main className="flex flex-col">
      <PageHero title={t('title', { lesson: lesson.titleAr })} intro={t('text')}>
        <div className="flex items-center gap-3">
          <TrackIcon track={lesson.track} size="lg" />
          <div className="flex gap-1" role="img" aria-label={t('stars', { stars })}>
            {[1, 2, 3].map((n) => (
              <svg
                key={n}
                viewBox="0 0 24 24"
                className={`size-9 ${n <= stars ? 'text-amber-400' : 'text-line-strong'}`}
                fill="currentColor"
                aria-hidden
              >
                <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />
              </svg>
            ))}
          </div>
        </div>
        <a
          href={lessonHref(p.locale, lesson)}
          className="self-start rounded-full bg-brand px-6 py-3 font-semibold text-brand-ink shadow-glow transition hover:-translate-y-px hover:bg-brand-strong"
        >
          {t('cta')}
        </a>
      </PageHero>
    </main>
  );
}

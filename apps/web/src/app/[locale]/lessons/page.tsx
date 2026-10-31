import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Locale } from '@tamreen/shared';
import { Ad } from '@/components/Ad';
import { JsonLd } from '@/components/JsonLd';
import { PageHero } from '@/components/PageHero';
import { ContinueBanner, LessonStatus, ProgressRing } from '@/components/Progress';
import { TrackIcon } from '@/components/TrackIcon';
import { lessonHref, listLessons, listTracks } from '@/lib/content';
import { absoluteUrl, pageMetadata, plainText } from '@/lib/seo';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'curriculum' });
  return pageMetadata({
    path: `/${locale}/lessons`,
    title: t('title'),
    description: t('description'),
  });
}

export default async function CurriculumPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, home, lessons, tracks] = await Promise.all([
    getTranslations('curriculum'),
    getTranslations('home'),
    listLessons(locale as Locale),
    listTracks(locale as Locale),
  ]);
  let number = 0;

  return (
    <main className="flex flex-col gap-10">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          itemListElement: lessons.map((l, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: absoluteUrl(lessonHref(locale, l)),
            name: plainText(l.titleAr),
          })),
        }}
      />
      <PageHero title={t('title')} intro={t('intro')}>
        <nav aria-label={t('jump')} className="flex flex-wrap gap-2">
          {tracks.map((track) => (
            <a
              key={track.slug}
              href={`#${track.slug}`}
              className="rounded-full border border-line bg-raised px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:border-brand hover:text-brand-strong"
            >
              {track.titleAr}
            </a>
          ))}
        </nav>
      </PageHero>

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-12 px-4">
        <ContinueBanner
          lessons={lessons.map((l) => ({ slug: l.slug, title: plainText(l.titleAr), href: lessonHref(locale, l) }))}
          labels={{ title: t('continueTitle'), cta: t('continueCta') }}
        />
        {tracks.map((track, i) => {
          const inTrack = lessons.filter((l) => l.track === track.slug);
          if (inTrack.length === 0) return null;
          return (
            <section
              key={track.slug}
              id={track.slug}
              aria-labelledby={`track-${track.slug}`}
              className="flex scroll-mt-24 flex-col gap-4"
            >
              <div data-reveal className="flex items-center gap-4">
                <TrackIcon track={track.slug} size="lg" />
                <div className="flex flex-1 flex-col">
                  <h2 id={`track-${track.slug}`} className="text-2xl font-extrabold tracking-tight">
                    {track.titleAr}
                  </h2>
                  <span className="text-sm text-muted">{home('lessonCount', { count: inTrack.length })}</span>
                </div>
                <ProgressRing slugs={inTrack.map((l) => l.slug)} label={home.raw('trackProgress') as string} />
              </div>
              <ol className="relative flex flex-col gap-3 ps-6 before:absolute before:inset-y-3 before:start-[11px] before:w-0.5 before:rounded-full before:bg-line">
                {inTrack.map((lesson) => {
                  number++;
                  return (
                    <li key={lesson.slug} data-reveal className="relative">
                      <span
                        aria-hidden
                        className="absolute -start-6 top-5 grid size-6 place-items-center rounded-full border-2 border-raised bg-brand text-[10px] font-bold text-brand-ink shadow-soft"
                      >
                        {number}
                      </span>
                      <a
                        href={lessonHref(locale, lesson)}
                        className="group flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-raised p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-lift"
                      >
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-lg font-bold text-ink transition group-hover:text-brand-strong">
                            {lesson.titleAr}
                          </span>
                          <LessonStatus
                            slug={lesson.slug}
                            steps={lesson.steps.length}
                            labels={{ done: t('done'), inProgress: t('inProgress') }}
                          />
                        </span>
                        <span className="leading-7 text-muted">{lesson.summaryAr}</span>
                        <span className="flex flex-wrap gap-2 text-xs font-medium text-muted">
                          <span className="rounded-full bg-sunken px-2 py-0.5">{t(`kind.${lesson.kind}`)}</span>
                          <span className="rounded-full bg-sunken px-2 py-0.5">{home('minutes', { minutes: lesson.minutes })}</span>
                          <span className="rounded-full bg-sunken px-2 py-0.5">{t('stepCount', { count: lesson.steps.length })}</span>
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ol>
              {i === 1 ? <Ad name="curriculum-between-tracks" size="list" /> : null}
            </section>
          );
        })}
      </div>
    </main>
  );
}

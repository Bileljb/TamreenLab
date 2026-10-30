import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Ad } from '@/components/Ad';
import { JsonLd } from '@/components/JsonLd';
import { lessonHref, listLessons, listTracks } from '@/lib/content';
import { absoluteUrl, pageMetadata } from '@/lib/seo';

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
    listLessons(),
    listTracks(),
  ]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          itemListElement: lessons.map((l, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: absoluteUrl(lessonHref(locale, l)),
            name: l.titleAr,
          })),
        }}
      />
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-slate-600">{t('intro')}</p>
      </div>
      {tracks.map((track, i) => {
        const inTrack = lessons.filter((l) => l.track === track.slug);
        if (inTrack.length === 0) return null;
        return (
          <section
            key={track.slug}
            id={track.slug}
            aria-labelledby={`track-${track.slug}`}
            className="flex flex-col gap-3"
          >
            <h2 id={`track-${track.slug}`} className="text-xl font-bold">
              {track.titleAr}
            </h2>
            <ol className="flex flex-col gap-3">
              {inTrack.map((lesson) => (
                <li key={lesson.slug}>
                  <a
                    href={lessonHref(locale, lesson)}
                    className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-500"
                  >
                    <span className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-semibold text-emerald-800">{lesson.titleAr}</span>
                      <span className="text-xs text-slate-500">
                        {t(`kind.${lesson.kind}`)} · {home('minutes', { minutes: lesson.minutes })}
                      </span>
                    </span>
                    <span className="text-sm text-slate-600">{lesson.summaryAr}</span>
                  </a>
                </li>
              ))}
            </ol>
            {i === 1 ? <Ad name="curriculum-between-tracks" size="list" /> : null}
          </section>
        );
      })}
    </main>
  );
}

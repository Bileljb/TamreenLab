import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Formula } from '@tamreen/ui';
import { JsonLd } from '@/components/JsonLd';
import { lessonHref, listLessons, listTracks } from '@/lib/content';
import { SITE_NAME, SITE_URL, pageMetadata } from '@/lib/seo';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  return pageMetadata({ path: `/${locale}`, title: t('title'), description: t('description') });
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, meta, lessons, tracks] = await Promise.all([
    getTranslations('home'),
    getTranslations('meta'),
    listLessons(),
    listTracks(),
  ]);
  const first = lessons[0]!;
  const features = ['practice', 'feedback', 'arabic', 'mobile'] as const;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-12 px-4 py-10">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: SITE_NAME,
          url: `${SITE_URL}/${locale}`,
          inLanguage: 'ar',
          description: meta('description'),
        }}
      />
      <section className="flex flex-col gap-5">
        <h1 className="text-3xl font-bold leading-snug sm:text-4xl">{t('title')}</h1>
        <p className="max-w-2xl text-lg text-slate-600">{t('tagline')}</p>
        <div className="flex flex-wrap gap-3">
          <a
            href={lessonHref(locale, first)}
            className="rounded-lg bg-emerald-700 px-5 py-2.5 font-medium text-white hover:bg-emerald-800"
          >
            {t('start')}
          </a>
          <a
            href={`/${locale}/lessons`}
            className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 font-medium hover:border-emerald-600"
          >
            {t('browse')}
          </a>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold">{t('exampleTitle')}</h2>
          <p className="leading-8">
            {t.rich('example', {
              cell: (chunks) => <Formula>{chunks}</Formula>,
              formula: (chunks) => (
                <Formula className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-sm">
                  {chunks}
                </Formula>
              ),
            })}
          </p>
        </div>
      </section>

      <section aria-labelledby="features" className="flex flex-col gap-4">
        <h2 id="features" className="text-2xl font-bold">
          {t('featuresTitle')}
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {features.map((f) => (
            <li key={f} className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="font-semibold text-emerald-800">{t(`features.${f}.title`)}</h3>
              <p className="text-slate-600">{t(`features.${f}.text`)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="tracks" className="flex flex-col gap-4">
        <h2 id="tracks" className="text-2xl font-bold">
          {t('tracksTitle')}
        </h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tracks.map((track) => {
            const inTrack = lessons.filter((l) => l.track === track.slug);
            if (inTrack.length === 0) return null;
            return (
              <li key={track.slug}>
                <a
                  href={`/${locale}/lessons#${track.slug}`}
                  className="flex h-full flex-col gap-1 rounded-xl border border-slate-200 bg-white p-4 hover:border-emerald-500"
                >
                  <span className="font-semibold">{track.titleAr}</span>
                  <span className="text-sm text-slate-600">
                    {t('lessonCount', { count: inTrack.length })}
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="flex flex-col gap-2 rounded-xl bg-emerald-50 p-5">
        <h2 className="text-xl font-bold">{t('functionsTitle')}</h2>
        <p className="text-slate-700">{t('functionsText')}</p>
        <a
          href={`/${locale}/functions`}
          className="font-medium text-emerald-800 underline underline-offset-4"
        >
          {t('functionsLink')}
        </a>
      </section>
    </main>
  );
}

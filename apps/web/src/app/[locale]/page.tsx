import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Formula } from '@tamreen/ui';
import { listLessons } from '@/lib/content';

type Props = { params: Promise<{ locale: string }> };

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, lessons] = await Promise.all([getTranslations('home'), listLessons()]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-4 py-12">
      <h1 className="text-3xl font-bold sm:text-4xl">{t('title')}</h1>
      <p className="text-lg text-slate-600">{t('tagline')}</p>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t('lessonsTitle')}</h2>
        <ol className="flex flex-col gap-3">
          {lessons.map((lesson) => (
            <li key={lesson.slug}>
              <a
                href={`/${locale}/lessons/${lesson.track}/${lesson.slug}`}
                className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-500 focus-visible:outline-2 focus-visible:outline-emerald-700"
              >
                <span className="font-semibold text-emerald-800">{lesson.titleAr}</span>
                <span className="text-sm text-slate-600">{lesson.summaryAr}</span>
                <span className="text-xs text-slate-500">
                  {t('minutes', { minutes: lesson.minutes })}
                </span>
              </a>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

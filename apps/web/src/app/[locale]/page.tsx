import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { use } from 'react';
import { Formula } from '@tamreen/ui';

type Props = { params: Promise<{ locale: string }> };

export default function HomePage({ params }: Props) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations('home');

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

      <p className="text-sm text-slate-500">{t('comingSoon')}</p>
    </main>
  );
}

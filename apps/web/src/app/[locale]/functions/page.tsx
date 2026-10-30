import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FUNCTION_CATEGORIES } from '@tamreen/shared';
import { functionHref, listFunctions } from '@/lib/content';
import { pageMetadata } from '@/lib/seo';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'functions' });
  return pageMetadata({
    path: `/${locale}/functions`,
    title: t('title'),
    description: t('description'),
  });
}

export default async function FunctionsIndexPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, fns] = await Promise.all([getTranslations('functions'), listFunctions()]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-slate-600">{t('intro')}</p>
      </div>
      {FUNCTION_CATEGORIES.map((category) => {
        const inCategory = fns.filter((f) => f.category === category);
        if (inCategory.length === 0) return null;
        return (
          <section
            key={category}
            aria-labelledby={`cat-${category}`}
            className="flex flex-col gap-3"
          >
            <h2 id={`cat-${category}`} className="text-xl font-bold">
              {t(`categories.${category}`)}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {inCategory.map((fn) => (
                <li key={fn.slug}>
                  <a
                    href={functionHref(locale, fn)}
                    className="flex h-full flex-col gap-1 rounded-xl border border-slate-200 bg-white p-4 hover:border-emerald-500"
                  >
                    <bdi dir="ltr" className="font-mono font-bold text-emerald-800">
                      {fn.name}
                    </bdi>
                    <span className="text-sm text-slate-600">{fn.summaryAr}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
}

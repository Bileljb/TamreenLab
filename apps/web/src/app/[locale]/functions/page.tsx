import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FRENCH_EXCEL_NAMES, FUNCTION_CATEGORIES, type Locale } from '@tamreen/shared';
import { FunctionSearch } from '@/components/FunctionSearch';
import { PageHero } from '@/components/PageHero';
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
  const [t, fns] = await Promise.all([getTranslations('functions'), listFunctions(locale as Locale)]);

  return (
    <main className="flex flex-col gap-10">
      <PageHero title={t('title')} intro={t('intro')} />
      <div className="mx-auto w-full max-w-4xl px-4">
        <FunctionSearch
          items={fns.map((f) => ({
            name: f.name,
            summary: f.summaryAr,
            href: functionHref(locale, f),
            category: f.category,
            localName: locale === 'fr' && FRENCH_EXCEL_NAMES[f.name] !== f.name ? FRENCH_EXCEL_NAMES[f.name] : undefined,
          }))}
          categories={FUNCTION_CATEGORIES.map((key) => ({ key, title: t(`categories.${key}`) }))}
          labels={{ search: t('search'), empty: t('noResults') }}
        />
      </div>
    </main>
  );
}

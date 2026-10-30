import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { pageMetadata } from '@/lib/seo';

export type StaticPageName = 'about' | 'privacy' | 'terms' | 'contact';

export async function staticPageMetadata(locale: string, page: StaticPageName): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: `pages.${page}` });
  return pageMetadata({
    path: `/${locale}/${page}`,
    title: t('title'),
    description: t('description'),
  });
}

/** About, privacy, terms and contact: text from the message file, paragraphs split by blank lines. */
export async function StaticPage({ locale, page }: { locale: string; page: StaticPageName }) {
  setRequestLocale(locale);
  const t = await getTranslations(`pages.${page}`);
  const draft = t.has('draft') ? t('draft') : null;
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-10">
      <h1 className="text-3xl font-bold">{t('title')}</h1>
      {draft ? (
        <p role="note" className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {draft}
        </p>
      ) : null}
      {t('body')
        .split(/\n{2,}/)
        .map((paragraph, i) => (
          <p key={i} className="leading-8 text-slate-700">
            {paragraph}
          </p>
        ))}
    </main>
  );
}

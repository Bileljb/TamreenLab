import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageHero } from '@/components/PageHero';
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
export async function StaticPage({
  locale,
  page,
  children,
}: {
  locale: string;
  page: StaticPageName;
  /** Extra content after the text (the privacy page adds account deletion). */
  children?: ReactNode;
}) {
  setRequestLocale(locale);
  const t = await getTranslations(`pages.${page}`);
  const draft = t.has('draft') ? t('draft') : null;
  return (
    <main className="flex flex-col">
      <PageHero title={t('title')} intro={t('description')} />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
        {draft ? (
          <p role="note" className="rounded-2xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm font-medium text-warn">
            {draft}
          </p>
        ) : null}
        <div className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-line bg-raised p-6 shadow-soft sm:p-8">
          {t('body')
            .split(/\n{2,}/)
            .map((paragraph, i) => (
              <p key={i} className="text-lg leading-8 text-ink-soft">
                {paragraph}
              </p>
            ))}
        </div>
        {children}
      </div>
    </main>
  );
}

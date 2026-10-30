import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Cairo } from 'next/font/google';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LOCALE_DIRECTION } from '@tamreen/shared';
import { AccountMenu, ConsentBanner, SessionProvider } from '@tamreen/ui';
import { routing } from '@/i18n/routing';
import { SITE_URL } from '@/lib/seo';
import '../globals.css';

const cairo = Cairo({ subsets: ['arabic', 'latin'], display: 'swap', variable: '--font-cairo' });

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Omit<Props, 'children'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t('title'), template: '%s | تمرين' },
    description: t('description'),
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const [t, nav, footer] = await Promise.all([
    getTranslations('header'),
    getTranslations('nav'),
    getTranslations('footer'),
  ]);
  const link = 'rounded-md px-2 py-1 text-sm text-slate-700 hover:text-emerald-800';

  return (
    <html lang={locale} dir={LOCALE_DIRECTION[locale]} className={cairo.variable}>
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider>
          <SessionProvider>
            <header className="border-b border-slate-200 bg-white">
              <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2">
                <div className="flex items-center gap-3">
                  <a href={`/${locale}`} className="text-lg font-bold text-emerald-800">
                    {t('brand')}
                  </a>
                  <nav aria-label={nav('label')} className="flex items-center gap-1">
                    <a href={`/${locale}/lessons`} className={link}>
                      {nav('lessons')}
                    </a>
                    <a href={`/${locale}/functions`} className={link}>
                      {nav('functions')}
                    </a>
                    <a href={`/${locale}/shortcuts`} className={`${link} max-sm:hidden`}>
                      {nav('shortcuts')}
                    </a>
                  </nav>
                </div>
                <AccountMenu locale={locale} />
              </div>
            </header>
            <div className="flex-1">{children}</div>
            <footer className="mt-12 border-t border-slate-200 bg-white">
              <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 text-sm text-slate-600">
                <nav aria-label={footer('label')} className="flex flex-wrap gap-x-4 gap-y-1">
                  {(['about', 'privacy', 'terms', 'contact'] as const).map((page) => (
                    <a key={page} href={`/${locale}/${page}`} className="hover:text-emerald-800">
                      {footer(page)}
                    </a>
                  ))}
                </nav>
                <p>{footer('note')}</p>
              </div>
            </footer>
            <ConsentBanner privacyHref={`/${locale}/privacy`} />
          </SessionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

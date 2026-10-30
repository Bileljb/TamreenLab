import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Cairo } from 'next/font/google';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LOCALE_DIRECTION } from '@tamreen/shared';
import { AccountMenu, SessionProvider } from '@tamreen/ui';
import { routing } from '@/i18n/routing';
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
  return { title: t('title'), description: t('description') };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('header');

  return (
    <html lang={locale} dir={LOCALE_DIRECTION[locale]} className={cairo.variable}>
      <body>
        <NextIntlClientProvider>
          <SessionProvider>
            <header className="border-b border-slate-200 bg-white">
              <nav
                aria-label={t('nav')}
                className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2"
              >
                <a href={`/${locale}`} className="text-lg font-bold text-emerald-800">
                  {t('brand')}
                </a>
                <AccountMenu locale={locale} />
              </nav>
            </header>
            {children}
          </SessionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

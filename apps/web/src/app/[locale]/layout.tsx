import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Cairo, Inter } from 'next/font/google';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LOCALE_DIRECTION, type Locale } from '@tamreen/shared';
import { AccountMenu, ConsentBanner, SessionProvider } from '@tamreen/ui';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Logo } from '@/components/Logo';
import { Reveal } from '@/components/Reveal';
import { THEME_SCRIPT, ThemeToggle } from '@/components/Theme';
import { routing } from '@/i18n/routing';
import { SITE_NAME, SITE_URL } from '@/lib/seo';
import '../globals.css';

// Cairo for Arabic (and for Latin text on Arabic pages), Inter for English and French. OFL-1.1.
const cairo = Cairo({ subsets: ['arabic', 'latin'], display: 'swap', variable: '--font-arabic' });
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-latin', preload: false });

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f8fb' },
    { media: '(prefers-color-scheme: dark)', color: '#0a101c' },
  ],
};

export async function generateMetadata({ params }: Omit<Props, 'children'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t('title'), template: `%s | ${SITE_NAME}` },
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
  const links = [
    { href: `/${locale}/lessons`, label: nav('lessons') },
    { href: `/${locale}/functions`, label: nav('functions') },
    { href: `/${locale}/shortcuts`, label: nav('shortcuts') },
  ];
  const themeLabels = {
    system: t('themeSystem'),
    light: t('themeLight'),
    dark: t('themeDark'),
  };

  return (
    <html
      lang={locale}
      dir={LOCALE_DIRECTION[locale as Locale]}
      className={`${cairo.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider>
          <SessionProvider>
            <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/75 backdrop-blur-xl backdrop-saturate-150">
              <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
                <div className="flex items-center gap-6">
                  <a href={`/${locale}`} className="rounded-lg focus-visible:outline-2 focus-visible:outline-brand">
                    <Logo name={t('brand')} />
                  </a>
                  <nav aria-label={nav('label')} className="flex items-center gap-1 max-md:hidden">
                    {links.map((l) => (
                      <a
                        key={l.href}
                        href={l.href}
                        className="rounded-full px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-sunken hover:text-ink"
                      >
                        {l.label}
                      </a>
                    ))}
                  </nav>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="max-sm:hidden">
                    <LanguageSwitcher locale={locale as Locale} label={t('language')} />
                  </div>
                  <ThemeToggle labels={themeLabels} />
                  <AccountMenu locale={locale} />
                  <details className="group relative md:hidden">
                    <summary
                      aria-label={t('menu')}
                      className="grid size-9 cursor-pointer list-none place-items-center rounded-full text-muted hover:bg-sunken hover:text-ink [&::-webkit-details-marker]:hidden"
                    >
                      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                        <path d="M4 7h16M4 12h16M4 17h16" className="group-open:hidden" />
                        <path d="M6 6l12 12M18 6 6 18" className="hidden group-open:block" />
                      </svg>
                    </summary>
                    <div className="absolute end-0 top-12 flex w-64 animate-fade-up flex-col gap-1 rounded-2xl border border-line bg-raised p-3 shadow-lift">
                      {links.map((l) => (
                        <a key={l.href} href={l.href} className="rounded-xl px-3 py-2 font-medium hover:bg-sunken">
                          {l.label}
                        </a>
                      ))}
                      <div className="my-2 h-px bg-line" />
                      <div className="sm:hidden">
                        <LanguageSwitcher locale={locale as Locale} label={t('language')} />
                      </div>
                      <div className="mt-2 sm:hidden">
                        <AccountMenu locale={locale} variant="menu" />
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            </header>
            <div className="flex-1">{children}</div>
            <footer className="mt-20 border-t border-line bg-raised/60">
              <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex max-w-sm flex-col gap-3">
                  <Logo name={t('brand')} />
                  <p className="text-sm leading-6 text-muted">{footer('note')}</p>
                </div>
                <div className="flex flex-col gap-4">
                  <nav aria-label={footer('label')} className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                    {(['about', 'privacy', 'terms', 'contact'] as const).map((page) => (
                      <a key={page} href={`/${locale}/${page}`} className="text-muted hover:text-ink">
                        {footer(page)}
                      </a>
                    ))}
                  </nav>
                  <LanguageSwitcher locale={locale as Locale} label={t('language')} />
                </div>
              </div>
            </footer>
            <ConsentBanner privacyHref={`/${locale}/privacy`} />
            <Reveal />
          </SessionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

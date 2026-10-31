import type { Metadata } from 'next';
import { LOCALES, OG_LOCALES, isLocale, type Locale } from '@tamreen/shared';

/** The public origin, used for canonical URLs, the sitemap and structured data. */
export const SITE_URL = (process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

/** The brand (decision D1, ADR 008). */
export const SITE_NAME = 'TamreenLab';

export const absoluteUrl = (path: string) => `${SITE_URL}${path}`;

/** The same page in another language: `/ar/lessons` → `/en/lessons`. */
export const inLocale = (path: string, locale: Locale) =>
  path.replace(/^\/[a-z]{2}(?=\/|$)/, `/${locale}`);

/** hreflang alternates for a page in every language; x-default is the Arabic page. */
export function languageAlternates(path: string): Record<string, string> {
  return {
    ...Object.fromEntries(LOCALES.map((l) => [l, absoluteUrl(inLocale(path, l))])),
    'x-default': absoluteUrl(inLocale(path, 'ar')),
  };
}

type PageMeta = {
  path: string;
  title: string;
  description: string;
  /** Pages that must stay out of search (sign-in forms). */
  noindex?: boolean;
  ogType?: 'website' | 'article';
};

/** Title, description, canonical, hreflang and Open Graph for one page. */
export function pageMetadata({
  path,
  title,
  description,
  noindex,
  ogType = 'website',
}: PageMeta): Metadata {
  const url = absoluteUrl(path);
  const locale = path.split('/')[1] ?? 'ar';
  return {
    title,
    description,
    alternates: { canonical: url, languages: languageAlternates(path) },
    openGraph: {
      type: ogType,
      url,
      title,
      description,
      locale: isLocale(locale) ? OG_LOCALES[locale] : OG_LOCALES.ar,
      siteName: SITE_NAME,
    },
    twitter: { card: 'summary_large_image', title, description },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}

/** Plain text of prompt markup, for descriptions and structured data. */
export function plainText(markup: string): string {
  return markup
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\{\{(.+?)\}\}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function faqJsonLd(faq: { qAr: string; aAr: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: plainText(f.qAr),
      acceptedAnswer: { '@type': 'Answer', text: plainText(f.aAr) },
    })),
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

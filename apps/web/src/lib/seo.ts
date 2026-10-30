import type { Metadata } from 'next';

/** The public origin, used for canonical URLs, the sitemap and structured data. */
export const SITE_URL = (process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export const absoluteUrl = (path: string) => `${SITE_URL}${path}`;

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
  return {
    title,
    description,
    alternates: { canonical: url, languages: { ar: url, 'x-default': url } },
    openGraph: { type: ogType, url, title, description, locale: 'ar_AR', siteName: 'تمرين' },
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

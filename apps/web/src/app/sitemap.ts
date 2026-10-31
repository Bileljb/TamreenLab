import type { MetadataRoute } from 'next';
import { DEFAULT_LOCALE, LOCALES } from '@tamreen/shared';
import { functionHref, lessonHref, listFunctions, listLessons } from '@/lib/content';
import { absoluteUrl, inLocale, languageAlternates } from '@/lib/seo';

/** Every public, indexable page in every language. Sign-in pages are left out (noindex). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = DEFAULT_LOCALE;
  const [lessons, functions] = await Promise.all([listLessons(base), listFunctions(base)]);
  const pages: [string, number][] = [
    [`/${base}`, 1],
    [`/${base}/lessons`, 0.9],
    [`/${base}/functions`, 0.8],
    ...lessons.map((l): [string, number] => [lessonHref(base, l), 0.8]),
    ...functions.map((f): [string, number] => [functionHref(base, f), 0.7]),
    [`/${base}/shortcuts`, 0.5],
    ...(['about', 'privacy', 'terms', 'contact'] as const).map((p): [string, number] => [
      `/${base}/${p}`,
      0.3,
    ]),
  ];
  return pages.flatMap(([path, priority]) =>
    LOCALES.map((locale) => ({
      url: absoluteUrl(inLocale(path, locale)),
      changeFrequency: 'weekly' as const,
      priority,
      alternates: { languages: languageAlternates(path) },
    })),
  );
}

import type { MetadataRoute } from 'next';
import { DEFAULT_LOCALE } from '@tamreen/shared';
import { functionHref, lessonHref, listFunctions, listLessons } from '@/lib/content';
import { absoluteUrl } from '@/lib/seo';

/** Every public, indexable page. Sign-in pages are left out (they are noindex). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const locale = DEFAULT_LOCALE;
  const [lessons, functions] = await Promise.all([listLessons(), listFunctions()]);
  const entry = (path: string, priority: number): MetadataRoute.Sitemap[number] => ({
    url: absoluteUrl(path),
    changeFrequency: 'weekly',
    priority,
    alternates: { languages: { ar: absoluteUrl(path) } },
  });
  return [
    entry(`/${locale}`, 1),
    entry(`/${locale}/lessons`, 0.9),
    entry(`/${locale}/functions`, 0.8),
    ...lessons.map((l) => entry(lessonHref(locale, l), 0.8)),
    ...functions.map((f) => entry(functionHref(locale, f), 0.7)),
    entry(`/${locale}/shortcuts`, 0.5),
    ...(['about', 'privacy', 'terms', 'contact'] as const).map((p) =>
      entry(`/${locale}/${p}`, 0.3),
    ),
  ];
}

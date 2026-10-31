import type { MetadataRoute } from 'next';
import { LOCALES } from '@tamreen/shared';
import { absoluteUrl } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  const signIn = LOCALES.flatMap((l) => [`/${l}/login`, `/${l}/register`]);
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', ...signIn] },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}

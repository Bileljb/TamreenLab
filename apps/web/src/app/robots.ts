import type { MetadataRoute } from 'next';
import { LOCALES } from '@tamreen/shared';
import { absoluteUrl } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  // Sign-in and personal pages. Share pages stay crawlable so link previews can read them; they
  // carry noindex instead.
  const signIn = LOCALES.flatMap((l) =>
    [
      'login',
      'register',
      'forgot-password',
      'reset-password',
      'account',
      'review',
      'unsubscribe',
    ].map((p) => `/${l}/${p}`),
  );
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', ...signIn] },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}

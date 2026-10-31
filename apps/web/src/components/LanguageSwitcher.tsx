'use client';

import { usePathname } from 'next/navigation';
import { LOCALES, LOCALE_DIRECTION, LOCALE_NAMES, type Locale } from '@tamreen/shared';

/**
 * Links to the same page in each language. Following one sets next-intl's locale cookie, so a
 * later visit to `/` opens that language (ADR 009).
 */
export function LanguageSwitcher({ locale, label }: { locale: Locale; label: string }) {
  const pathname = usePathname() ?? `/${locale}`;
  const to = (l: Locale) => pathname.replace(/^\/[a-z]{2}(?=\/|$)/, `/${l}`);
  return (
    <nav aria-label={label} className="flex w-fit items-center rounded-full bg-sunken p-0.5 text-xs">
      {LOCALES.map((l) => (
        <a
          key={l}
          href={to(l)}
          hrefLang={l}
          lang={l}
          dir={LOCALE_DIRECTION[l]}
          aria-current={l === locale ? 'true' : undefined}
          className={`rounded-full px-2.5 py-1 font-medium transition-colors ${
            l === locale
              ? 'bg-raised text-ink shadow-sm'
              : 'text-muted hover:text-ink'
          }`}
        >
          {LOCALE_NAMES[l]}
        </a>
      ))}
    </nav>
  );
}

import { CONTENT_LOCALES } from './i18n';

/** The site languages: Arabic (the default and the content source), English and French. */
export const LOCALES = CONTENT_LOCALES;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ar';

export const LOCALE_DIRECTION: Record<Locale, 'rtl' | 'ltr'> = { ar: 'rtl', en: 'ltr', fr: 'ltr' };

/** Each language's name in itself, for the language switcher. */
export const LOCALE_NAMES: Record<Locale, string> = { ar: 'العربية', en: 'English', fr: 'Français' };

/** Open Graph locale tags. Region-neutral where the format allows (ADR 008). */
export const OG_LOCALES: Record<Locale, string> = { ar: 'ar_AR', en: 'en_US', fr: 'fr_FR' };

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export * from './feedback';
export * from './step';
export * from './attempt';
export * from './lesson';
export * from './progress';
export * from './api';
export * from './functions';
export * from './analytics';
export * from './i18n';

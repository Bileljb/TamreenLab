export const LOCALES = ['ar'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ar';

export const LOCALE_DIRECTION: Record<Locale, 'rtl' | 'ltr'> = { ar: 'rtl' };

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

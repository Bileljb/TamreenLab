import { CONTENT_LOCALES, type ContentLocale } from '@tamreen/shared';

/** The language of the page (`<html lang>`), so the API checks answers in that language. */
export function pageLocale(): ContentLocale {
  const lang = typeof document === 'undefined' ? '' : document.documentElement.lang;
  return (CONTENT_LOCALES as readonly string[]).includes(lang) ? (lang as ContentLocale) : 'ar';
}

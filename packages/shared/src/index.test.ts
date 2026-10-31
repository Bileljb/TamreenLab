import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, LOCALE_DIRECTION, isLocale } from './index';

describe('locales', () => {
  it('defaults to Arabic, written right to left', () => {
    expect(DEFAULT_LOCALE).toBe('ar');
    expect(LOCALE_DIRECTION[DEFAULT_LOCALE]).toBe('rtl');
  });

  it('supports Arabic, English and French; the Latin ones run left to right', () => {
    expect(['ar', 'en', 'fr'].every(isLocale)).toBe(true);
    expect(isLocale('de')).toBe(false);
    expect(LOCALE_DIRECTION.en).toBe('ltr');
    expect(LOCALE_DIRECTION.fr).toBe('ltr');
  });
});

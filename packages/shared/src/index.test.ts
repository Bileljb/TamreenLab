import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, LOCALE_DIRECTION, isLocale } from './index';

describe('locales', () => {
  it('defaults to Arabic, written right to left', () => {
    expect(DEFAULT_LOCALE).toBe('ar');
    expect(LOCALE_DIRECTION[DEFAULT_LOCALE]).toBe('rtl');
  });

  it('recognises supported locales only', () => {
    expect(isLocale('ar')).toBe(true);
    expect(isLocale('en')).toBe(false);
  });
});

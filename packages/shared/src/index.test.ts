import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, isLocale } from './index';

describe('locales', () => {
  it('defaults to Arabic', () => {
    expect(DEFAULT_LOCALE).toBe('ar');
  });

  it('recognises supported locales only', () => {
    expect(isLocale('ar')).toBe(true);
    expect(isLocale('en')).toBe(false);
  });
});

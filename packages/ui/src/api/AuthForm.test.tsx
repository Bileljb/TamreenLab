import { describe, expect, it } from 'vitest';
import { safeNext } from './AuthForm';

describe('safeNext', () => {
  it.each([
    ['/ar/lessons/basics/cells-and-selection', '/ar/lessons/basics/cells-and-selection'],
    ['/ar', '/ar'],
    [null, '/fallback'],
    ['', '/fallback'],
    ['https://evil.example', '/fallback'],
    ['//evil.example', '/fallback'],
    ['/\\evil.example', '/fallback'],
    ['javascript:alert(1)', '/fallback'],
  ])('%s -> %s', (raw, expected) => {
    expect(safeNext(raw, '/fallback')).toBe(expected);
  });
});

import { describe, expect, it } from 'vitest';
import { formatFor, formatValue } from './format';

describe('formatValue', () => {
  it.each([
    [null, undefined, ''],
    ['قلم', undefined, 'قلم'],
    [true, undefined, 'TRUE'],
    [false, undefined, 'FALSE'],
    [1250.5, undefined, '1250.5'],
    [0.1 + 0.2, undefined, '0.3'],
    [1250.456, 'number', '1,250.46'],
    [12, 'currency', '12.00'],
    [0.075, 'percent', '7.5%'],
    [45306, 'date', '2024-01-15'],
    [42, 'text', '42'],
    [{ error: '#N/A' }, undefined, '#N/A'],
    [{ error: 'SYNTAX' }, undefined, '#ERROR!'],
    [{ error: 'TIMEOUT' }, undefined, '#TIMEOUT!'],
  ] as const)('%j (%s) -> %s', (value, format, expected) => {
    expect(formatValue(value, format)).toBe(expected);
  });
});

describe('formatFor', () => {
  const formats = { 'B2:B8': 'number', B5: 'currency', 'd1:c3': 'percent' } as const;

  it.each([
    ['B2', 'number'],
    ['B5', 'currency'],
    ['C2', 'percent'],
    ['D3', 'percent'],
    ['A1', undefined],
    ['B9', undefined],
  ])('%s -> %s', (address, expected) => {
    expect(formatFor(formats, address)).toBe(expected);
  });

  it('handles a sheet without formats', () => {
    expect(formatFor(undefined, 'A1')).toBeUndefined();
  });
});

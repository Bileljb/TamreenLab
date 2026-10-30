import { describe, expect, it } from 'vitest';
import { Sheet } from './sheet';
import { expandRange, normalizeAddress, normalizeRange, sameCell, sameRange } from './ref';

describe('references', () => {
  it.each([
    ['b2', 'B2'],
    ['$B$2', 'B2'],
    ['  $aa10 ', 'AA10'],
  ])('normalizes address %s to %s', (input, expected) => {
    expect(normalizeAddress(input)).toBe(expected);
  });

  it.each([
    ['A1:B3', 'A1:B3'],
    ['b3:a1', 'A1:B3'],
    ['$B$1:A3', 'A1:B3'],
    ['C1:A1', 'A1:C1'],
  ])('normalizes range %s to %s (top-left first)', (input, expected) => {
    expect(normalizeRange(input)).toBe(expected);
  });

  it('rejects malformed references', () => {
    expect(() => normalizeAddress('B0')).toThrow();
    expect(() => normalizeAddress('هـ1')).toThrow();
    expect(() => normalizeRange('A1')).toThrow();
  });

  it('compares cells and ranges ignoring "$", case and corner order', () => {
    expect(sameCell('$c$3', 'C3')).toBe(true);
    expect(sameCell('C3', 'C4')).toBe(false);
    expect(sameRange('B3:A1', 'a1:$B$3')).toBe(true);
    expect(sameRange('A1:B3', 'A1:B4')).toBe(false);
    expect(sameCell('nonsense', 'A1')).toBe(false);
    expect(sameRange('A1', 'A1:A1')).toBe(false);
  });

  it('expands a range row by row', () => {
    expect(expandRange('B2:A1')).toEqual(['A1', 'B1', 'A2', 'B2']);
  });
});

describe('Sheet', () => {
  const sheet = Sheet.fromSpec({
    visible: 'A1:C4',
    cells: { A1: 'المنتج', B1: 'السعر', A2: 'قلم', B2: 2.5, A3: 'دفتر', B3: 6, C3: '=B2+B3' },
  });

  it('reads raw cells by any spelling of the address', () => {
    expect(sheet.raw('a2')).toBe('قلم');
    expect(sheet.raw('$B$3')).toBe(6);
    expect(sheet.raw('Z9')).toBeUndefined();
  });

  it('evaluates formula cells and plain cells', () => {
    expect(sheet.valueAt('C3')).toBe(8.5);
    expect(sheet.valueAt('B2')).toBe(2.5);
    expect(sheet.valueAt('C1')).toBeNull();
  });

  it('evaluates a formula against its cells', () => {
    expect(sheet.evaluate('=SUM(B2:B3)')).toBe(8.5);
    expect(sheet.evaluate('=VLOOKUP("دفتر",A2:B3,2,FALSE)')).toBe(6);
  });

  it('returns new sheets for variants and edits, leaving the original untouched', () => {
    const variant = sheet.withCells({ B2: 10 });
    expect(variant.evaluate('=SUM(B2:B3)')).toBe(16);
    expect(sheet.evaluate('=SUM(B2:B3)')).toBe(8.5);
    const edited = sheet.withCells({ $d$1: '=B3*2' });
    expect(edited.valueAt('D1')).toBe(12);
  });

  it('exposes a copy of its cells', () => {
    const cells = sheet.cells();
    cells.A2 = 'changed';
    expect(sheet.raw('A2')).toBe('قلم');
  });

  it('builds from plain cells', () => {
    expect(new Sheet({ a1: 3 }).valueAt('A1')).toBe(3);
  });
});

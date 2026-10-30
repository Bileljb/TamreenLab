import { describe, expect, it } from 'vitest';
import {
  anchoringMatches,
  canonicalFormula,
  hasCellReference,
  normalizeDigits,
  prepareFormula,
} from './normalize';

describe('normalizeDigits', () => {
  it.each([
    ['١٢٣', '123'],
    ['۴۵', '45'],
    ['١٢٫٥', '12.5'],
    ['abc', 'abc'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeDigits(input)).toBe(expected);
  });
});

describe('prepareFormula', () => {
  it.each([
    ['SUM(A1:A3)', '=SUM(A1:A3)'],
    ['  =SUM(A1:A3)  ', '=SUM(A1:A3)'],
    ['＝SUM(A1)', '=SUM(A1)'],
    ['=SUMIF(A1:A3؛"قلم"؛B1:B3)', '=SUMIF(A1:A3,"قلم",B1:B3)'],
    ['=ROUND(B2،٢)', '=ROUND(B2,2)'],
    ['=B2*١٫٥', '=B2*1.5'],
    // Inside string literals nothing changes: the learner's text is data.
    ['=IF(A1="١؛٢",1,2)', '=IF(A1="١؛٢",1,2)'],
    ['=CONCAT("a""؛""b"؛"c")', '=CONCAT("a""؛""b","c")'],
  ])('%s -> %s', (input, expected) => {
    expect(prepareFormula(input)).toBe(expected);
  });

  it('leaves an empty answer empty', () => {
    expect(prepareFormula('   ')).toBe('');
  });
});

describe('canonicalFormula', () => {
  it.each([
    ['=sum( a1 : a3 )', '=SUM(A1:A3)'],
    ['=SUMIF(A2:A8;"قلم";B2:B8)', '=SUMIF(A2:A8,"قلم",B2:B8)'],
    ['=if(a1>=1,true,"x""y")', '=IF(A1>=1,TRUE,"x""y")'],
    ['=1.50+2', '=1.5+2'],
    ['=-B2%', '=-B2%'],
    ['=foo', '=FOO'],
    ['SUM(A1)', '=SUM(A1)'],
  ])('%s -> %s', (input, expected) => {
    expect(canonicalFormula(input)).toBe(expected);
  });

  it('strips "$" only when asked', () => {
    expect(canonicalFormula('=SUM($A$2:A8)')).toBe('=SUM($A$2:A8)');
    expect(canonicalFormula('=SUM($A$2:A8)', { ignoreAbsolute: true })).toBe('=SUM(A2:A8)');
  });

  it('returns null when the formula cannot be tokenized', () => {
    expect(canonicalFormula('="abc')).toBeNull();
  });
});

describe('hasCellReference', () => {
  it.each([
    ['=450', false],
    ['=100+350', false],
    ['="A1"', false],
    ['=SUM(1,2)', false],
    ['=B2', true],
    ['=SUM($B$2:B8)', true],
    ['="x', false],
  ])('%s -> %s', (formula, expected) => {
    expect(hasCellReference(formula)).toBe(expected);
  });
});

describe('anchoringMatches', () => {
  it('requires the solution\'s "$" on every cell both formulas reference', () => {
    expect(anchoringMatches('=B2*$E$1', '=B2*$E$1')).toBe(true);
    expect(anchoringMatches('=b2*$e$1', '=B2*$E$1')).toBe(true);
    expect(anchoringMatches('=B2*E1', '=B2*$E$1')).toBe(false);
    expect(anchoringMatches('=B2*$E1', '=B2*$E$1')).toBe(false);
    expect(anchoringMatches('=$B$2*$E$1', '=B2*$E$1')).toBe(false);
  });

  it('ignores cells the solution does not use', () => {
    expect(anchoringMatches('=$C$9+B2', '=B2')).toBe(true);
  });

  it('is false when either formula cannot be tokenized', () => {
    expect(anchoringMatches('="x', '=A1')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { customEngine, type CellValue } from './index';

// Excel's implicit conversions and criteria rules, driven through formulas on tiny sheets.
const cells = {
  A1: 'نص',
  A2: '  42 ',
  A3: true,
  A4: false,
  A5: 'true',
  A6: 'FALSE',
  A7: '',
  A8: 10,
  B1: 5,
  B2: 15,
  B3: 25,
  B4: 'ب',
  B5: 'د',
  C1: '=1/0',
};
const ev = (formula: string) => customEngine.evaluate(cells, formula);

describe('coercion', () => {
  it.each<[string, CellValue]>([
    // Numbers from text, booleans and blanks.
    ['=A2+1', 43],
    ['=A3+A4', 1],
    ['=Z1*5', 0],
    ['=A1+1', { error: '#VALUE!' }],
    ['=A7+1', { error: '#VALUE!' }],
    ['=C1+1', { error: '#DIV/0!' }],
    ['=SUM(A3)', 1],
    ['=SUM(C1)', { error: '#DIV/0!' }],
    // Text from numbers, booleans and blanks.
    ['=A3&""', 'TRUE'],
    ['=A4&"!"', 'FALSE!'],
    ['=Z1&"x"', 'x'],
    ['=8&8', '88'],
    ['=C1&"x"', { error: '#DIV/0!' }],
    // Booleans from numbers, text and blanks.
    ['=IF(A8,"y","n")', 'y'],
    ['=IF(0,"y","n")', 'n'],
    ['=IF(Z1,"y","n")', 'n'],
    ['=IF(A5,"y","n")', 'y'],
    ['=IF(A6,"y","n")', 'n'],
    ['=IF(A1,"y","n")', { error: '#VALUE!' }],
    ['=IF(C1,"y","n")', { error: '#DIV/0!' }],
    ['=NOT(A3)', false],
    // Comparisons across types and with blanks.
    ['=Z1=0', true],
    ['=Z1=""', true],
    ['=""=Z1', true],
    ['=Z1<"a"', true],
    ['=TRUE>1', true],
    ['=FALSE<TRUE', true],
    ['="ب"<"د"', true],
    ['=C1=1', { error: '#DIV/0!' }],
    ['=1=C1', { error: '#DIV/0!' }],
  ])('%s', (formula, expected) => {
    expect(ev(formula)).toEqual(expected);
  });
});

describe('criteria', () => {
  it.each<[string, CellValue]>([
    ['=COUNTIF(B1:B3,15)', 1],
    ['=COUNTIF(A2:A3,42)', 1],
    ['=COUNTIF(A3:A4,TRUE)', 1],
    ['=COUNTIF(B1:B3,"=15")', 1],
    ['=COUNTIF(B1:B3,"<>15")', 2],
    ['=COUNTIF(B1:B5,"<>15")', 4],
    ['=COUNTIF(B1:B3,"<15")', 1],
    ['=COUNTIF(B1:B3,"<=15")', 2],
    ['=COUNTIF(B1:B3,">15")', 1],
    ['=COUNTIF(B1:B3,">=15")', 2],
    ['=COUNTIF(B4:B5,"<ج")', 1],
    ['=COUNTIF(B4:B5,"<=ب")', 1],
    ['=COUNTIF(B4:B5,">=ب")', 2],
    ['=COUNTIF(B4:B5,"<>ب")', 1],
    ['=COUNTIF(A7:A9,"")', 2],
    ['=COUNTIF(B1:B3,Z1)', 0],
    ['=COUNTIF(B1:B3,C1)', { error: '#DIV/0!' }],
    ['=SUMIF(B1:B3,">10")', 40],
    ['=SUMIF(A1:A2,"*",B1:B2)', 20],
    ['=SUMIF(B1:B3,">10",C1:C3)', 0],
  ])('%s', (formula, expected) => {
    expect(ev(formula)).toEqual(expected);
  });

  it('propagates an error inside the summed cells that match', () => {
    expect(customEngine.evaluate({ A1: 'x', B1: '=1/0' }, '=SUMIF(A1,"x",B1)')).toEqual({
      error: '#DIV/0!',
    });
  });
});

describe('function argument rules', () => {
  it.each<[string, CellValue]>([
    ['=ROUND(1)', { error: '#VALUE!' }],
    ['=IF(1)', { error: '#VALUE!' }],
    ['=SUMIF(B1:B3)', { error: '#VALUE!' }],
    ['=SUMIFS(B1:B3,A1:A3)', { error: '#VALUE!' }],
    ['=VLOOKUP(1,B1:B3)', { error: '#VALUE!' }],
    ['=INDEX(B1:B3)', { error: '#VALUE!' }],
    ['=INDEX(B1:B3,0)', { error: '#REF!' }],
    // A single row with one index reads that column: C1, which is #DIV/0!.
    ['=INDEX(B1:D1,2)', { error: '#DIV/0!' }],
    ['=MATCH(20,B1:B3,-1)', { error: '#N/A' }],
    ['=SUM(C1:C2)', { error: '#DIV/0!' }],
    ['=AVERAGE(C1)', { error: '#DIV/0!' }],
    ['=LEFT(A1)', 'ن'],
    ['=RIGHT(A1)', 'ص'],
    ['=RIGHT(A1,-1)', { error: '#VALUE!' }],
    ['=FIND("x","abc",9)', { error: '#VALUE!' }],
    ['=SEARCH("B","abcb",3)', 4],
    ['=SUMIF(C1,1)', { error: '#DIV/0!' }],
  ])('%s', (formula, expected) => {
    expect(ev(formula)).toEqual(expected);
  });
});

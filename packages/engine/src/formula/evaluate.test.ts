import { describe, expect, it } from 'vitest';
import { salesSheet } from '../fixtures/sales';
import { customEngine, SUPPORTED_FUNCTIONS, type CellValue } from './index';

const sheet = salesSheet();
const ev = (formula: string) => customEngine.evaluate(sheet, formula);

/** Same sheet with different quantities: a hard-coded "=450" must stop matching. */
const variantSheet = { ...sheet, D2: 10, D5: 20, D7: 30 };

// The 22 shared cases from the ADR 001 spike, on the same original dataset.
const spikeCases: [string, string, CellValue][] = [
  ['sum', '=SUM(D2:D9)', 755],
  ['sum-absolute-refs', '=SUM($D$2:$D$9)', 755],
  ['if', '=IF(D2>100,"مرتفع","منخفض")', 'مرتفع'],
  ['if-and', '=IF(AND(D3>50,E3>5),"نعم","لا")', 'نعم'],
  ['sumif-text', '=SUMIF(C2:C9,"قلم",D2:D9)', 450],
  ['sumif-operator', '=SUMIF(D2:D9,"<60")', 75],
  ['countifs', '=COUNTIFS(B2:B9,"الرياض",D2:D9,">50")', 2],
  ['vlookup-exact', '=VLOOKUP("مسطرة",C2:E9,3,FALSE)', 4],
  ['vlookup-approx', '=VLOOKUP(120,H2:I5,2,TRUE)', 0.05],
  ['vlookup-na', '=VLOOKUP("قلم رصاص",C2:E9,3,FALSE)', { error: '#N/A' }],
  ['xlookup', '=XLOOKUP("عمر",A2:A9,D2:D9)', 200],
  ['xlookup-if-not-found', '=XLOOKUP("خالد",A2:A9,D2:D9,"غير موجود")', 'غير موجود'],
  ['index-match', '=INDEX(B2:B9,MATCH(200,D2:D9,0))', 'تونس'],
  ['left', '=LEFT(K2,3)', 'EMP'],
  ['mid-find', '=MID(K2,FIND("-",K2)+1,4)', '0042'],
  ['left-find-arabic', '=LEFT(K3,FIND(" ",K3)-1)', 'سارة'],
  ['datedif-months', '=DATEDIF(F2,F9,"m")', 3],
  ['datedif-days', '=DATEDIF(F2,F9,"d")', 116],
  ['div0', '=D2/0', { error: '#DIV/0!' }],
  ['unknown-function', '=SUMM(D2:D9)', { error: '#NAME?' }],
  ['syntax-error', '=SUM(D2:D9', { error: 'SYNTAX' }],
  ['sumif-semicolons', '=SUMIF(C2:C9;"قلم";D2:D9)', 450],
];

// Lesson functions (ADR 001 scope) and Excel coercion details.
const functionCases: [string, string, CellValue][] = [
  ['average', '=AVERAGE(D2:D9)', 94.375],
  ['average-empty', '=AVERAGE(Z1:Z3)', { error: '#DIV/0!' }],
  ['min', '=MIN(D2:D9)', 30],
  ['max', '=MAX(D2:D9)', 200],
  ['min-empty', '=MIN(Z1:Z3)', 0],
  ['count-numbers-only', '=COUNT(A1:D9)', 8],
  ['counta', '=COUNTA(A1:A9)', 9],
  ['round', '=ROUND(2.345,2)', 2.35],
  ['sum-mixed-args', '=SUM(D2:D3,10,"5")', 215],
  ['sum-text-arg', '=SUM("abc")', { error: '#VALUE!' }],
  ['sum-skips-text-in-range', '=SUM(A2:A9)', 0],
  ['if-no-else', '=IF(D2<0,"x")', false],
  ['if-empty-else', '=IF(D2<0,"x",)', ''],
  ['or', '=OR(D2>500,D3=80)', true],
  ['not', '=NOT(D2>100)', false],
  ['and-text-arg', '=AND("abc")', { error: '#VALUE!' }],
  ['iferror-ok', '=IFERROR(D2/2,0)', 60],
  ['iferror-catch', '=IFERROR(D2/0,0)', 0],
  ['sumifs', '=SUMIFS(D2:D9,C2:C9,"دفتر",B2:B9,"<>الرياض")', 170],
  ['countif-number', '=COUNTIF(E2:E9,6)', 3],
  ['countif-gte', '=COUNTIF(D2:D9,">=120")', 3],
  ['countif-not', '=COUNTIF(C2:C9,"<>قلم")', 5],
  ['countif-blank', '=COUNTIF(Z1:Z4,"")', 4],
  ['sumif-shape-mismatch', '=SUMIF(C2:C9,"قلم",D2:D5)', { error: '#VALUE!' }],
  ['countifs-odd-args', '=COUNTIFS(B2:B9)', { error: '#VALUE!' }],
  ['vlookup-case-insensitive', '=VLOOKUP("emp-0042-ryd",K2:K3,1,FALSE)', 'EMP-0042-RYD'],
  ['vlookup-col-zero', '=VLOOKUP("قلم",C2:E9,0,FALSE)', { error: '#VALUE!' }],
  ['vlookup-wildcard', '=VLOOKUP("مس*",C2:E9,2,FALSE)', 30],
  ['vlookup-lookup-error', '=VLOOKUP(1/0,C2:E9,2,FALSE)', { error: '#DIV/0!' }],
  ['xlookup-next-smaller', '=XLOOKUP(70,D2:D9,A2:A9,"-",-1)', 'سارة'],
  ['xlookup-next-larger', '=XLOOKUP(70,D2:D9,A2:A9,"-",1)', 'أحمد'],
  ['xlookup-shape', '=XLOOKUP(1,D2:D9,A2:A5)', { error: '#VALUE!' }],
  ['match-approx', '=MATCH(120,H2:H5)', 3],
  ['match-not-found', '=MATCH("x",C2:C9,0)', { error: '#N/A' }],
  ['index-2d', '=INDEX(A2:D9,4,3)', 'قلم'],
  ['index-out-of-range', '=INDEX(A2:D9,20,1)', { error: '#REF!' }],
  ['len-arabic', '=LEN(K3)', 9],
  ['right', '=RIGHT(K2,3)', 'RYD'],
  ['right-zero', '=RIGHT(K2,0)', ''],
  ['mid-bad-start', '=MID(K2,0,2)', { error: '#VALUE!' }],
  ['find-case-sensitive', '=FIND("emp",K2)', { error: '#VALUE!' }],
  ['search-case-insensitive', '=SEARCH("emp",K2)', 1],
  ['upper', '=UPPER("abc")', 'ABC'],
  ['lower', '=LOWER(K2)', 'emp-0042-ryd'],
  ['upper-arity', '=UPPER("a","b")', { error: '#VALUE!' }],
  ['concat', '=CONCAT(A2," - ",B2)', 'سارة - الرياض'],
  ['ampersand-number', '="المجموع: "&SUM(D2:D3)', 'المجموع: 200'],
  ['date-serial', '=DATE(2024,1,15)', 45306],
  ['datedif-bad-unit', '=DATEDIF(F2,F9,"w")', { error: '#NUM!' }],
  ['bool-literal', '=TRUE', true],
  ['bool-arith', '=TRUE+1', 2],
  ['text-number-coercion', '="3"*2', 6],
  ['text-arith-error', '=A2*2', { error: '#VALUE!' }],
  ['percent', '=20%', 0.2],
  ['blank-is-zero', '=Z99+1', 1],
  ['blank-equals-empty-text', '=Z99=""', true],
  ['overflow', '=10^400', { error: '#NUM!' }],
  ['range-as-scalar', '=D2:D3+1', { error: '#VALUE!' }],
  ['single-cell-range', '=D2:D2+1', 121],
  ['unknown-name', '=foo+1', { error: '#NAME?' }],
  ['col-out-of-grid', '=XFE1+1', { error: '#REF!' }],
  ['row-out-of-grid', '=A1048577', { error: '#REF!' }],
  ['whitespace', '=  SUM( D2 : D3 )  ', 200],
  ['lower-case-input', '=sum(d2:d3)', 200],
  ['no-leading-equals', 'SUM(D2:D3)', 200],
  ['escaped-quote', '="قال ""مرحبا"""', 'قال "مرحبا"'],
];

describe('customEngine.evaluate', () => {
  it.each([...spikeCases, ...functionCases])('%s: %s', (_id, formula, expected) => {
    const actual = ev(formula);
    if (typeof expected === 'number') expect(actual).toBeCloseTo(expected, 10);
    else expect(actual).toEqual(expected);
  });

  it('recomputes a SUMIF on a variant dataset, so "=450" is exposed', () => {
    expect(customEngine.evaluate(variantSheet, '=SUMIF(C2:C9,"قلم",D2:D9)')).toBe(60);
    expect(customEngine.evaluate(variantSheet, '=450')).toBe(450);
  });

  it('follows Excel operator precedence', () => {
    expect(ev('=1+2*3')).toBe(7);
    expect(ev('=-2^2')).toBe(4);
    expect(ev('=2^3^2')).toBe(64);
    expect(ev('=50%*D2')).toBe(60);
    expect(ev('="a"&1+1')).toBe('a2');
    expect(ev('=(1+2)*3')).toBe(9);
    expect(ev('=1+2>2')).toBe(true);
  });

  it('compares text case-insensitively and orders numbers < text < booleans', () => {
    expect(ev('="ABC"="abc"')).toBe(true);
    expect(ev('=1<"a"')).toBe(true);
    expect(ev('="z"<TRUE')).toBe(true);
    expect(ev('="b">="a"')).toBe(true);
    expect(ev('=1<>2')).toBe(true);
    expect(ev('=2<=1')).toBe(false);
  });

  it('supports wildcards and escapes in criteria', () => {
    expect(ev('=COUNTIF(C2:C9,"د*")')).toBe(3);
    expect(ev('=SUMIF(A2:A9,"?مر",D2:D9)')).toBe(290);
    expect(customEngine.evaluate({ A1: 'a*b', A2: 'axb' }, '=COUNTIF(A1:A2,"a~*b")')).toBe(1);
    expect(customEngine.evaluate({ A1: 'b', A2: 'c' }, '=COUNTIF(A1:A2,">a")')).toBe(2);
  });

  it('evaluates formulas in referenced cells and detects cycles', () => {
    expect(customEngine.evaluate({ A1: 2, A2: '=A1*3' }, '=A2+1')).toBe(7);
    expect(customEngine.evaluate({ A1: '=A2', A2: '=A1' }, '=A1')).toEqual({ error: '#CYCLE!' });
    expect(customEngine.evaluate({ A1: '=SUM(' }, '=A1')).toEqual({ error: 'SYNTAX' });
  });

  it('propagates errors from ranges and arguments', () => {
    expect(customEngine.evaluate({ A1: 1, A2: '=1/0' }, '=SUM(A1:A2)')).toEqual({
      error: '#DIV/0!',
    });
    expect(customEngine.evaluate({ A1: 1, A2: '=1/0' }, '=A2+1')).toEqual({ error: '#DIV/0!' });
    expect(customEngine.evaluate({ A1: 1, A2: '=1/0' }, '=1+A2')).toEqual({ error: '#DIV/0!' });
    expect(customEngine.evaluate({ A1: '=1/0' }, '=-A1')).toEqual({ error: '#DIV/0!' });
    expect(ev('=IFERROR(VLOOKUP("x",C2:E9,3,FALSE),"لا يوجد")')).toBe('لا يوجد');
    expect(ev('=LEFT(K2,-1)')).toEqual({ error: '#VALUE!' });
    expect(ev('=VLOOKUP("قلم",C2:E9,9,FALSE)')).toEqual({ error: '#REF!' });
  });

  it('handles DATE and DATEDIF units', () => {
    expect(ev('=DATEDIF(DATE(2020,5,20),DATE(2024,3,10),"y")')).toBe(3);
    expect(ev('=DATEDIF(DATE(2020,5,20),DATE(2024,3,10),"ym")')).toBe(9);
    expect(ev('=DATEDIF(DATE(2020,5,20),DATE(2024,3,10),"md")')).toBe(19);
    expect(ev('=DATEDIF(DATE(2020,5,10),DATE(2024,3,20),"md")')).toBe(10);
    expect(ev('=DATEDIF(F9,F2,"d")')).toEqual({ error: '#NUM!' });
  });

  it('rejects malformed formulas as syntax errors', () => {
    for (const f of ['=SUM(', '=1+', '=)', '="abc', '=A1:', '=1 2', '=*2', '=#', '=SUM(1,2']) {
      expect(ev(f), f).toEqual({ error: 'SYNTAX' });
    }
  });

  it('gives up with TIMEOUT instead of hanging', () => {
    expect(ev('=SUM(A1:XFD1048576)')).toEqual({ error: 'TIMEOUT' });
    expect(customEngine.evaluate(sheet, '=SUM(D2:D9)', { budget: 5 })).toEqual({
      error: 'TIMEOUT',
    });
    // IFERROR must not turn a timeout into its fallback value.
    expect(ev('=IFERROR(SUM(A1:XFD1048576),0)')).toEqual({ error: 'TIMEOUT' });
    // Nor may a nested cell.
    expect(customEngine.evaluate({ A1: '=SUM(A2:XFD1048576)' }, '=IFERROR(A1,0)')).toEqual({
      error: 'TIMEOUT',
    });
  });
});

describe('customEngine.functionsUsed', () => {
  it('lists nested functions from the AST, in first-use order', () => {
    expect(customEngine.functionsUsed('=INDEX(B2:B9,MATCH(200,D2:D9,0))')).toEqual([
      'INDEX',
      'MATCH',
    ]);
    expect(customEngine.functionsUsed('=-SUM(1)+ABS(2)')).toEqual(['SUM', 'ABS']);
    expect(customEngine.functionsUsed('=450')).toEqual([]);
    expect(customEngine.functionsUsed('=sumif(C2:C9;"x";D2:D9)')).toEqual(['SUMIF']);
  });

  it('does not mistake function names inside strings for calls', () => {
    expect(customEngine.functionsUsed('=IF(A1="SUM(1)",1,2)')).toEqual(['IF']);
  });

  it('returns null when the formula does not parse', () => {
    expect(customEngine.functionsUsed('=SUM(')).toBeNull();
  });

  it('exposes the supported function list', () => {
    expect(SUPPORTED_FUNCTIONS).toContain('SUMIF');
    expect(SUPPORTED_FUNCTIONS).not.toContain('TEXTJOIN');
  });
});

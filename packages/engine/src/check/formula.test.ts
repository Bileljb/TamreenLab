import { describe, expect, it } from 'vitest';
import {
  StepSpecSchema,
  type FeedbackCode,
  type StepOf,
  type StepSpecInput,
} from '@tamreen/shared';
import { salesSheet } from '../fixtures/sales';
import { checkAnswer, verifyReferenceSolution } from './index';

const sheet = { visible: 'A1:K9', cells: salesSheet() };

function formulaStep(check: Record<string, unknown>, cells = sheet.cells) {
  const input = {
    slug: 'formula-step',
    type: 'ENTER_FORMULA',
    promptAr: 'اكتب المعادلة في الخلية المطلوبة.',
    sheet: { ...sheet, cells },
    check: { target: 'D12', ...check },
  } as StepSpecInput;
  return StepSpecSchema.parse(input) as StepOf<'ENTER_FORMULA'>;
}

// Total quantity of "قلم" (pens): rows 2, 5 and 7 -> 120 + 200 + 130.
const sumif = formulaStep({
  expected: { value: 450 },
  solution: '=SUMIF(C2:C9,"قلم",D2:D9)',
  mustUseFunctions: ['SUMIF'],
  mustNotUseFunctions: ['SUMIFS'],
  variants: [{ cells: { D2: 10, D5: 20, D7: 30 } }, { cells: { C3: 'قلم' } }],
});

const run = (step: ReturnType<typeof formulaStep>, formula: string, cell = 'D12') =>
  checkAnswer(step, { cell, formula }).code;

describe('ENTER_FORMULA: SUMIF step', () => {
  it.each<[string, FeedbackCode]>([
    // Correct and equivalent answers.
    ['=SUMIF(C2:C9,"قلم",D2:D9)', 'OK'],
    ['=sumif(c2:c9,"قلم",d2:d9)', 'OK'],
    ['=SUMIF(C2:C9;"قلم";D2:D9)', 'OK'],
    ['=SUMIF(C2:C9؛"قلم"؛D2:D9)', 'OK'],
    ['=SUMIF(C2:C9،"قلم"،D2:D9)', 'OK'],
    ['SUMIF(C2:C9,"قلم",D2:D9)', 'OK'],
    ['  = SUMIF ( C2:C9 , "قلم" , D2:D9 )  ', 'OK'],
    ['=SUMIF($C$2:$C$9,"قلم",$D$2:$D$9)', 'OK'],
    ['=SUMIF(C9:C2,"قلم",D9:D2)', 'OK'],
    ['=SUMIF(C2:C9,"قل*",D2:D9)', 'OK'],
    ['=SUMIF(C2:C9,C2,D2:D9)', 'OK'],
    ['=SUMIF(C1:C9,"قلم",D1:D9)', 'OK'],
    ['=SUMIF(C2:C9,"قلم",D2:D9)+0', 'OK'],
    // Hard-coded answers.
    ['=450', 'HARDCODED_VALUE'],
    ['450', 'HARDCODED_VALUE'],
    ['=١٢٠+٢٠٠+١٣٠', 'HARDCODED_VALUE'],
    ['=SUMIF(C2:C9,"قلم",D2:D9)*0+450', 'HARDCODED_VALUE'],
    ['=SUMIF(C2:C2,"قلم",D2:D2)+330', 'HARDCODED_VALUE'],
    // Wrong ranges and values.
    ['=SUMIF(C2:C6,"قلم",D2:D6)', 'WRONG_VALUE'],
    // C2:C8 misses row 9, which is not a pen in any dataset, so it is genuinely equivalent.
    ['=SUMIF(C2:C8,"قلم",D2:D8)', 'OK'],
    ['=SUMIF(C2:C9,"دفتر",D2:D9)', 'WRONG_VALUE'],
    ['=SUMIF(C2:C9,"قلم",E2:E9)', 'WRONG_VALUE'],
    ['=SUMIF(C2:C9,"قلم")', 'WRONG_VALUE'],
    ['=SUMIF(C2:C9,"قلم",D2:D5)', 'WRONG_VALUE'],
    // Function rules.
    ['=D2+D5+D7', 'MISSING_FUNCTION'],
    ['=SUM(D2,D5,D7)', 'MISSING_FUNCTION'],
    ['=SUMIFS(D2:D9,C2:C9,"قلم")', 'FORBIDDEN_FUNCTION'],
    ['=SUMIF(C2:C9,"قلم",D2:D9)+SUMIFS(D2:D9,C2:C9,"x")', 'FORBIDDEN_FUNCTION'],
    // Errors.
    ['=SUMIF(C2:C9,"قلم",D2:D9', 'SYNTAX_ERROR'],
    ['=SUMIF(C2:C9,"قلم,D2:D9)', 'SYNTAX_ERROR'],
    ['=SUMIF(C2:C9,,"قلم",D2:D9))', 'SYNTAX_ERROR'],
    ['', 'SYNTAX_ERROR'],
    ['=', 'SYNTAX_ERROR'],
    ['=SUMIF(C2:C9,قلم,D2:D9)', 'NAME_ERROR'],
    ['=SUMIF(C2:C9,"قلم",D2:D9)/0', 'DIV0'],
    ['=SUMIF(C2:C9,"قلم",D2:D9)+XFE1', 'REF_ERROR'],
    ['=SUMIF(C2:C9,"قلم",D2:D9)+VLOOKUP("x",C2:D9,2,FALSE)', 'NA_ERROR'],
    ['=SUMIF(C2:C9,"قلم",D2:D9)+A2', 'WRONG_VALUE'],
    ['=SUMIF(C2:C9,"قلم",D2:D9)+SUM(A1:XFD1048576)', 'TIMEOUT'],
  ])('%s -> %s', (formula, code) => {
    expect(run(sumif, formula)).toBe(code);
  });

  it('accepts the answer only in the target cell', () => {
    expect(run(sumif, '=SUMIF(C2:C9,"قلم",D2:D9)', 'D11')).toBe('WRONG_CELL');
    expect(run(sumif, '=SUMIF(C2:C9,"قلم",D2:D9)', '$d$12')).toBe('OK');
  });

  it('fails a hard-coded =450 through the variant check (Phase 1 acceptance)', () => {
    const noFunctionRule = formulaStep({
      expected: { value: 450 },
      solution: '=SUMIF(C2:C9,"قلم",D2:D9)',
      variants: [{ cells: { D2: 10, D5: 20, D7: 30 } }],
    });
    expect(checkAnswer(noFunctionRule, { cell: 'D12', formula: '=450' })).toEqual({
      correct: false,
      code: 'HARDCODED_VALUE',
    });
    // A formula that reads cells but only fits the base data is caught by the variant too.
    expect(run(noFunctionRule, '=D2+D5+D7*0+130')).toBe('HARDCODED_VALUE');
    expect(run(noFunctionRule, '=SUMIF(C2:C9,"قلم",D2:D9)')).toBe('OK');
  });

  it('marks a formula that refers to its own cell as wrong', () => {
    expect(run(sumif, '=SUMIF(C2:C9,"قلم",D2:D9)+D12*0')).toBe('WRONG_VALUE');
  });
});

describe('ENTER_FORMULA: other result types', () => {
  it('compares text results without case or tashkeel differences', () => {
    const step = formulaStep({
      target: 'G2',
      expected: { value: 'مرتفع' },
      solution: '=IF(D2>100,"مرتفع","منخفض")',
      mustUseFunctions: ['IF'],
      variants: [{ cells: { D2: 50 } }],
    });
    expect(run(step, '=IF(D2>100,"مرتفع","منخفض")', 'G2')).toBe('OK');
    expect(run(step, '=IF(D2<=100,"منخفض","مرتفع")', 'G2')).toBe('OK');
    expect(run(step, '=IF(D2>100,"مُرتفع","منخفض")', 'G2')).toBe('OK');
    expect(run(step, '=IF(D2>100,"مرتفع","مرتفع")', 'G2')).toBe('HARDCODED_VALUE');
    expect(run(step, '=IF(D2>100,"عالٍ","منخفض")', 'G2')).toBe('WRONG_VALUE');
    expect(run(step, '="مرتفع"', 'G2')).toBe('HARDCODED_VALUE');
    expect(run(step, '=IF(D2>100,1,0)', 'G2')).toBe('WRONG_VALUE');
  });

  it('compares boolean results strictly', () => {
    const step = formulaStep({
      target: 'G3',
      expected: { value: true },
      solution: '=AND(D3>50,E3>5)',
    });
    expect(run(step, '=AND(D3>50,E3>5)', 'G3')).toBe('OK');
    expect(run(step, '=D3>50', 'G3')).toBe('OK');
    expect(run(step, '=D3>0', 'G3')).toBe('OK');
    expect(run(step, '=IF(D3>50,1,0)', 'G3')).toBe('WRONG_VALUE');
    expect(run(step, '=1', 'G3')).toBe('HARDCODED_VALUE');
    expect(run(step, '=TRUE', 'G3')).toBe('HARDCODED_VALUE');
  });

  it('applies a numeric tolerance and treats an empty result as zero', () => {
    const avg = formulaStep({
      target: 'G4',
      expected: { value: 94.38 },
      solution: '=ROUND(AVERAGE(D2:D9),2)',
      tolerance: 0.01,
    });
    expect(run(avg, '=AVERAGE(D2:D9)', 'G4')).toBe('OK');
    expect(run(avg, '=ROUND(AVERAGE(D2:D9),1)', 'G4')).toBe('WRONG_VALUE');

    const zero = formulaStep({ target: 'G5', expected: { value: 0 }, solution: '=Z1' });
    expect(run(zero, '=Z2', 'G5')).toBe('OK');
  });

  it('handles Arabic text in cells (lookup by Arabic name)', () => {
    const step = formulaStep({
      target: 'G6',
      expected: { value: 'تونس' },
      solution: '=INDEX(B2:B9,MATCH(200,D2:D9,0))',
      mustUseFunctions: ['INDEX', 'MATCH'],
      variants: [{ cells: { D5: 199, D8: 200 } }],
    });
    expect(run(step, '=INDEX(B2:B9;MATCH(200;D2:D9;0))', 'G6')).toBe('OK');
    expect(run(step, '=INDEX(B2:B9,4)', 'G6')).toBe('MISSING_FUNCTION');
    expect(run(step, '=INDEX(B2:B9,MATCH(4,{1},0))', 'G6')).toBe('SYNTAX_ERROR');
    expect(run(step, '=INDEX(B2:B9,MATCH(5,E2:E9,0))', 'G6')).toBe('NA_ERROR');
  });

  it('passes VLOOKUP #N/A through as NA_ERROR and accepts IFERROR fallbacks', () => {
    const step = formulaStep({
      target: 'G7',
      expected: { value: 'غير موجود' },
      solution: '=IFERROR(VLOOKUP("ممحاة كبيرة",C2:E9,3,FALSE),"غير موجود")',
      mustUseFunctions: ['VLOOKUP'],
    });
    expect(run(step, '=IFERROR(VLOOKUP("ممحاة كبيرة",C2:E9,3,FALSE),"غير موجود")', 'G7')).toBe(
      'OK',
    );
    expect(run(step, '=VLOOKUP("ممحاة كبيرة",C2:E9,3,FALSE)', 'G7')).toBe('NA_ERROR');
    expect(run(step, '=VLOOKUP("ممحاة",C2:E9,5,FALSE)', 'G7')).toBe('REF_ERROR');
  });
});

describe('ENTER_FORMULA: absolute references', () => {
  // Commission per row: quantity × rate in $I$3. Teaching "$" means the anchoring matters.
  const step = formulaStep({
    target: 'G2',
    expected: { value: 2.4 },
    solution: '=D2*$I$3',
    acceptEquivalentRefs: false,
  });

  it.each<[string, FeedbackCode]>([
    ['=D2*$I$3', 'OK'],
    ['=$I$3*D2', 'OK'],
    ['=d2*$i$3', 'OK'],
    ['=D2*I3', 'WRONG_VALUE'],
    ['=D2*I$3', 'WRONG_VALUE'],
    ['=D2*$I3', 'WRONG_VALUE'],
  ])('%s -> %s', (formula, code) => {
    expect(run(step, formula, 'G2')).toBe(code);
  });

  it('ignores "$" when acceptEquivalentRefs is left at its default', () => {
    const relaxed = formulaStep({ target: 'G2', expected: { value: 2.4 }, solution: '=D2*$I$3' });
    expect(run(relaxed, '=D2*I3', 'G2')).toBe('OK');
  });
});

describe('verifyReferenceSolution', () => {
  it('passes when the solution produces the expected value on every dataset', () => {
    expect(verifyReferenceSolution(sumif)).toEqual({ correct: true, code: 'OK' });
  });

  it('reports a solution that does not match expected.value', () => {
    const wrong = formulaStep({ expected: { value: 451 }, solution: '=SUMIF(C2:C9,"قلم",D2:D9)' });
    expect(verifyReferenceSolution(wrong).code).toBe('WRONG_VALUE');
  });
});

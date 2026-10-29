import { describe, expect, it } from 'vitest';
import { cases, cellsFor, semicolonCase, variantSheet } from './cases';
import { salesSheet } from './dataset';
import { customEngine } from './custom';
import { hyperFormulaEngine } from './hyperformula-engine';
import type { FormulaEngine } from './types';

const engines: FormulaEngine[] = [hyperFormulaEngine, customEngine];

/**
 * Cases where an engine differs from Excel. They are asserted to fail so the gap stays visible
 * (and the test breaks if a new version fixes it).
 */
export const knownGaps: Record<string, Record<string, string>> = {
  HyperFormula: {
    'datedif-months': 'DATEDIF unit is case-sensitive: "m" gives #NUM!, only "M" works',
    'datedif-days': 'DATEDIF unit is case-sensitive: "d" gives #NUM!, only "D" works',
  },
  custom: {},
};

/** The normalisation PLAN T9 puts in front of the engine: ";" -> "," outside string literals. */
function normaliseSeparators(formula: string): string {
  return formula.replace(/("(?:[^"]|"")*")|;/g, (m, str: string | undefined) => str ?? ',');
}

describe.each(engines)('$name', (engine) => {
  for (const c of cases) {
    const gap = knownGaps[engine.name]?.[c.id];
    const run = () => {
      const actual = engine.evaluate(cellsFor(c), c.formula);
      if (typeof c.expected === 'number') {
        expect(actual).toBeCloseTo(c.expected, 10);
      } else {
        expect(actual).toEqual(c.expected);
      }
    };
    if (gap) it.fails(`${c.id}: ${c.formula} [known gap: ${gap}]`, run);
    else it(`${c.id}: ${c.formula}`, run);
  }

  it('accepts ";" separators after normalisation', () => {
    const formula = normaliseSeparators(semicolonCase.formula);
    expect(engine.evaluate(salesSheet(), formula)).toBe(450);
  });

  it('exposes a hard-coded answer through the variant dataset', () => {
    const expectedBase = engine.evaluate(salesSheet(), '=SUMIF(C2:C9,"قلم",D2:D9)');
    const expectedVariant = engine.evaluate(variantSheet, '=SUMIF(C2:C9,"قلم",D2:D9)');
    const hardCoded = '=450';
    expect(engine.evaluate(salesSheet(), hardCoded)).toBe(expectedBase);
    expect(engine.evaluate(variantSheet, hardCoded)).not.toBe(expectedVariant);
  });
});

describe('separator handling without normalisation', () => {
  it('custom accepts ";" natively', () => {
    expect(customEngine.evaluate(salesSheet(), semicolonCase.formula)).toBe(450);
  });

  it('HyperFormula needs the formula normalised first (it uses one configured separator)', () => {
    expect(hyperFormulaEngine.evaluate(salesSheet(), semicolonCase.formula)).toEqual({
      error: 'SYNTAX',
    });
  });

  it('normalisation leaves ";" inside string literals alone', () => {
    expect(normaliseSeparators('=CONCAT("a;b";"c")')).toBe('=CONCAT("a;b","c")');
  });
});

describe('functionsUsed (needed for mustUseFunctions / mustNotUseFunctions)', () => {
  it('custom lists nested functions from its AST', () => {
    expect(customEngine.functionsUsed('=INDEX(B2:B9,MATCH(200,D2:D9,0))')).toEqual([
      'INDEX',
      'MATCH',
    ]);
    expect(customEngine.functionsUsed('=450')).toEqual([]);
    expect(customEngine.functionsUsed('=sumif(C2:C9;"x";D2:D9)')).toEqual(['SUMIF']);
  });

  it('does not mistake function names inside strings for calls', () => {
    expect(customEngine.functionsUsed('=IF(A1="SUM(1)",1,2)')).toEqual(['IF']);
  });

  it('HyperFormula has no public API for it', () => {
    expect(hyperFormulaEngine.functionsUsed('=SUM(A1:A2)')).toBeNull();
  });
});

describe('custom evaluator details', () => {
  const sheet = salesSheet();
  const ev = (f: string) => customEngine.evaluate(sheet, f);

  it('follows Excel operator precedence', () => {
    expect(ev('=1+2*3')).toBe(7);
    expect(ev('=-2^2')).toBe(4);
    expect(ev('=2^3^2')).toBe(64);
    expect(ev('=50%*D2')).toBe(60);
    expect(ev('="a"&1+1')).toBe('a2');
  });

  it('compares text case-insensitively and orders numbers before text', () => {
    expect(ev('="ABC"="abc"')).toBe(true);
    expect(ev('=1<"a"')).toBe(true);
  });

  it('supports wildcards in criteria', () => {
    expect(ev('=COUNTIF(C2:C9,"د*")')).toBe(3);
    expect(ev('=SUMIF(A2:A9,"?مر",D2:D9)')).toBe(290);
  });

  it('evaluates formulas in referenced cells and detects cycles', () => {
    expect(customEngine.evaluate({ A1: 2, A2: '=A1*3' }, '=A2+1')).toBe(7);
    expect(customEngine.evaluate({ A1: '=A2', A2: '=A1' }, '=A1')).toEqual({ error: '#CYCLE!' });
  });

  it('propagates errors from ranges and arguments', () => {
    expect(customEngine.evaluate({ A1: 1, A2: '=1/0' }, '=SUM(A1:A2)')).toEqual({
      error: '#DIV/0!',
    });
    expect(ev('=IFERROR(VLOOKUP("x",C2:E9,3,FALSE),"لا يوجد")')).toBe('لا يوجد');
    expect(ev('=LEFT(K2,-1)')).toEqual({ error: '#VALUE!' });
    expect(ev('=VLOOKUP("قلم",C2:E9,9,FALSE)')).toEqual({ error: '#REF!' });
  });

  it('handles DATE and DATEDIF units', () => {
    expect(ev('=DATEDIF(DATE(2020,5,20),DATE(2024,3,10),"y")')).toBe(3);
    expect(ev('=DATEDIF(DATE(2020,5,20),DATE(2024,3,10),"ym")')).toBe(9);
    expect(ev('=DATEDIF(DATE(2020,5,20),DATE(2024,3,10),"md")')).toBe(19);
    expect(ev('=DATEDIF(F9,F2,"d")')).toEqual({ error: '#NUM!' });
  });

  it('rejects malformed formulas as syntax errors', () => {
    for (const f of ['=SUM(', '=1+', '=)', '="abc', '=A1:', '=1 2']) {
      expect(ev(f), f).toEqual({ error: 'SYNTAX' });
    }
  });
});

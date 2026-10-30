import type { FormulaEngine } from './types';
import { evaluateFormula } from './evaluate';
import { collectFunctions, parse } from './parser';
import { FormulaSyntaxError } from './tokenizer';

/** The custom evaluator chosen in ADR 001 (D4). */
export const customEngine: FormulaEngine = {
  name: 'custom',
  evaluate: evaluateFormula,
  functionsUsed(formula) {
    try {
      return [...collectFunctions(parse(formula))];
    } catch (e) {
      if (e instanceof FormulaSyntaxError) return null;
      throw e;
    }
  },
};

export { SUPPORTED_FUNCTIONS } from './functions';
export { DEFAULT_BUDGET } from './evaluate';
export { parse, type Node } from './parser';
export { FormulaSyntaxError, tokenize, type Token } from './tokenizer';
export { columnToIndex, indexToColumn, parseAddress, toAddress, MAX_COL, MAX_ROW } from './address';
export * from './types';

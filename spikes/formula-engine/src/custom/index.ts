import type { FormulaEngine } from '../types';
import { evaluateFormula } from './evaluate';
import { collectFunctions, parse } from './parser';
import { FormulaSyntaxError } from './tokenizer';

export const customEngine: FormulaEngine = {
  name: 'custom',
  evaluate: evaluateFormula,
  functionsUsed(formula) {
    try {
      return [...collectFunctions(parse(formula))];
    } catch (e) {
      if (e instanceof FormulaSyntaxError) return [];
      throw e;
    }
  },
};

export { SUPPORTED_FUNCTIONS } from './functions';

import type { AnswerFor, FeedbackCode, StepOf } from '@tamreen/shared';
import { customEngine } from '../formula';
import type { CellValue, ErrorCode } from '../formula/types';
import { anchoringMatches, hasCellReference, prepareFormula } from '../normalize';
import { normalizeAddress, sameCell } from '../ref';
import { Sheet } from '../sheet';
import { normalizeText, numbersClose } from './simple';
import { result, type CheckResult } from './result';

const ERROR_CODES: Partial<Record<ErrorCode, FeedbackCode>> = {
  '#REF!': 'REF_ERROR',
  '#NAME?': 'NAME_ERROR',
  '#N/A': 'NA_ERROR',
  '#DIV/0!': 'DIV0',
  SYNTAX: 'SYNTAX_ERROR',
  TIMEOUT: 'TIMEOUT',
};

const isError = (v: CellValue): v is { error: ErrorCode } => typeof v === 'object' && v !== null;

/** Excel shows an empty result as 0, so null is 0 (or "") for comparison. */
function sameValue(actual: CellValue, expected: CellValue, tolerance?: number): boolean {
  if (isError(actual) || isError(expected)) {
    return isError(actual) && isError(expected) && actual.error === expected.error;
  }
  if (typeof expected === 'number' || expected === null) {
    const n = actual === null ? 0 : actual;
    return typeof n === 'number' && numbersClose(n, expected ?? 0, tolerance);
  }
  if (typeof expected === 'boolean') return actual === expected;
  return normalizeText(actual === null ? '' : String(actual)) === normalizeText(expected);
}

/**
 * Checks a formula typed into the grid, in this order (ADR 003): target cell, syntax, forbidden
 * functions, no cell reference at all (hard-coded), required functions, Excel errors, the value on
 * the base sheet, variant datasets against the solution (hard-coded), and finally "$" anchoring
 * when the step teaches absolute references.
 */
export function checkEnterFormula(
  step: StepOf<'ENTER_FORMULA'>,
  answer: AnswerFor['ENTER_FORMULA'],
): CheckResult {
  const { check } = step;
  if (!sameCell(answer.cell, check.target)) return result('WRONG_CELL');

  const formula = prepareFormula(answer.formula);
  const used = formula === '' ? null : customEngine.functionsUsed(formula);
  if (!used) return result('SYNTAX_ERROR');
  if (check.mustNotUseFunctions?.some((f) => used.includes(f))) {
    return result('FORBIDDEN_FUNCTION');
  }
  // A formula that reads no cell ("=450") is hard-coded whatever it evaluates to.
  if (hasCellReference(check.solution) && !hasCellReference(formula)) {
    return result('HARDCODED_VALUE');
  }
  if (check.mustUseFunctions?.some((f) => !used.includes(f))) return result('MISSING_FUNCTION');

  const target = normalizeAddress(check.target);
  // The formula goes into its target cell, so a reference to itself is a cycle, as in Excel.
  const valueIn = (sheet: Sheet, f: string) => sheet.withCells({ [target]: f }).valueAt(target);

  const base = Sheet.fromSpec(step.sheet);
  const actual = valueIn(base, formula);
  if (isError(actual)) return result(ERROR_CODES[actual.error] ?? 'WRONG_VALUE');
  if (!sameValue(actual, check.expected.value, check.tolerance)) return result('WRONG_VALUE');

  // Right on this data, but does it compute? Re-run on each variant against the solution.
  for (const variant of check.variants ?? []) {
    const sheet = base.withCells(variant.cells);
    if (!sameValue(valueIn(sheet, formula), valueIn(sheet, check.solution), check.tolerance)) {
      return result('HARDCODED_VALUE');
    }
  }

  if (!check.acceptEquivalentRefs && !anchoringMatches(formula, check.solution)) {
    return result('WRONG_VALUE');
  }
  return result('OK');
}

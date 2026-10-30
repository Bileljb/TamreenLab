import type { Cells } from '@tamreen/shared';

export type { Cells };

/**
 * Excel error values, plus two that are not Excel values: SYNTAX (the formula could not be
 * parsed) and TIMEOUT (evaluation went over its step budget).
 */
export type ErrorCode =
  '#N/A' | '#NAME?' | '#DIV/0!' | '#VALUE!' | '#REF!' | '#NUM!' | '#CYCLE!' | 'SYNTAX' | 'TIMEOUT';

export type ErrorValue = { error: ErrorCode };
export type CellValue = number | string | boolean | null | ErrorValue;

export type EvaluateOptions = {
  /** Maximum number of AST nodes and cells visited before giving up with TIMEOUT. */
  budget?: number;
};

/** The adapter contract from ADR 001. The custom evaluator is the only implementation. */
export interface FormulaEngine {
  readonly name: string;
  /** Evaluates `formula` (leading "=" optional) against `cells`, as if typed into an empty cell. */
  evaluate(cells: Cells, formula: string, options?: EvaluateOptions): CellValue;
  /** Upper-case names of every function the formula calls, in first-use order; null if unparseable. */
  functionsUsed(formula: string): string[] | null;
}

export function isError(value: CellValue): value is ErrorValue {
  return typeof value === 'object' && value !== null;
}

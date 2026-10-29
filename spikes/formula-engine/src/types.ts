// The adapter contract both candidates implement. Phase 1 turns this into packages/engine's FormulaEngine.

/** Excel error values, plus SYNTAX (not an Excel value): the formula could not be parsed. */
export type ErrorCode =
  '#N/A' | '#NAME?' | '#DIV/0!' | '#VALUE!' | '#REF!' | '#NUM!' | '#CYCLE!' | 'SYNTAX';

export type ErrorValue = { error: ErrorCode };
export type CellValue = number | string | boolean | null | ErrorValue;

/** Raw sheet contents, keyed by A1 address. Strings starting with "=" are formulas. */
export type Cells = Record<string, number | string | boolean>;

export interface FormulaEngine {
  readonly name: string;
  /** Evaluates `formula` (with leading "=") against `cells`, as if typed into an empty cell. */
  evaluate(cells: Cells, formula: string): CellValue;
  /** Upper-case names of every function the formula calls, or null if the engine cannot tell. */
  functionsUsed(formula: string): string[] | null;
}

export function isError(value: CellValue): value is ErrorValue {
  return typeof value === 'object' && value !== null;
}

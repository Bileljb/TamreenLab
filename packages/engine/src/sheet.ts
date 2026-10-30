import type { CellInput, Cells, SheetSpec } from '@tamreen/shared';
import { customEngine } from './formula';
import type { CellValue, EvaluateOptions, FormulaEngine } from './formula/types';
import { normalizeAddress } from './ref';

/**
 * An immutable sheet: typed cell inputs keyed by normalised A1 address. Strings starting with
 * "=" are formulas. Variants and learner edits produce new sheets.
 */
export class Sheet {
  readonly #cells: Readonly<Cells>;

  constructor(
    cells: Cells,
    private readonly engine: FormulaEngine = customEngine,
  ) {
    const normalized: Cells = {};
    for (const [address, value] of Object.entries(cells)) {
      normalized[normalizeAddress(address)] = value;
    }
    this.#cells = normalized;
  }

  static fromSpec(spec: SheetSpec, engine?: FormulaEngine): Sheet {
    return new Sheet(spec.cells, engine);
  }

  /** The input stored in a cell, as written (a formula stays a formula). */
  raw(address: string): CellInput | undefined {
    return this.#cells[normalizeAddress(address)];
  }

  /** The value a cell shows: formulas are evaluated, an empty cell is null. */
  valueAt(address: string, options?: EvaluateOptions): CellValue {
    return this.evaluate(`=${normalizeAddress(address)}`, options);
  }

  /** Evaluates a formula as if typed into an empty cell of this sheet. */
  evaluate(formula: string, options?: EvaluateOptions): CellValue {
    return this.engine.evaluate(this.#cells, formula, options);
  }

  /** A new sheet with some cells replaced (a variant dataset, or the learner's entry). */
  withCells(overrides: Cells): Sheet {
    return new Sheet({ ...this.#cells, ...overrides }, this.engine);
  }

  /** A copy of the cells, safe to mutate. */
  cells(): Cells {
    return { ...this.#cells };
  }
}

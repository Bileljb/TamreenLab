import { CellError, ErrorType, HyperFormula } from 'hyperformula';
import type { CellValue, Cells, ErrorCode, FormulaEngine } from './types';
import { parseAddress, toAddress } from './custom/address';

const errorMap: Partial<Record<ErrorType, ErrorCode>> = {
  [ErrorType.NA]: '#N/A',
  [ErrorType.NAME]: '#NAME?',
  [ErrorType.DIV_BY_ZERO]: '#DIV/0!',
  [ErrorType.VALUE]: '#VALUE!',
  [ErrorType.REF]: '#REF!',
  [ErrorType.NUM]: '#NUM!',
  [ErrorType.CYCLE]: '#CYCLE!',
  [ErrorType.ERROR]: 'SYNTAX', // HyperFormula reports parse failures as #ERROR!
};

function toGrid(cells: Cells): { grid: (number | string | boolean | null)[][]; target: string } {
  let maxRow = 0;
  let maxCol = 0;
  for (const address of Object.keys(cells)) {
    const { row, col } = parseAddress(address);
    maxRow = Math.max(maxRow, row);
    maxCol = Math.max(maxCol, col);
  }
  // The formula under test goes one row below the data, in column A.
  const targetRow = maxRow + 1;
  const grid = Array.from({ length: targetRow + 1 }, () =>
    Array<number | string | boolean | null>(maxCol + 1).fill(null),
  );
  for (const [address, value] of Object.entries(cells)) {
    const { row, col } = parseAddress(address);
    grid[row]![col] = value;
  }
  return { grid, target: toAddress(targetRow, 0) };
}

export const hyperFormulaEngine: FormulaEngine = {
  name: 'HyperFormula',

  evaluate(cells, formula) {
    const { grid, target } = toGrid(cells);
    const { row } = parseAddress(target);
    grid[row]![0] = formula;
    // HyperFormula only knows TRUE()/FALSE() as functions; bare TRUE/FALSE (as learners type them,
    // e.g. VLOOKUP(...,FALSE)) are #NAME? unless defined as named expressions.
    const hf = HyperFormula.buildFromArray(grid, { licenseKey: 'gpl-v3' }, [
      { name: 'TRUE', expression: '=TRUE()' },
      { name: 'FALSE', expression: '=FALSE()' },
    ]);
    try {
      const value = hf.getCellValue({ sheet: 0, row, col: 0 });
      if (value instanceof CellError || (typeof value === 'object' && value && 'type' in value)) {
        const type = (value as { type: ErrorType }).type;
        return { error: errorMap[type] ?? '#VALUE!' };
      }
      return value as CellValue;
    } finally {
      hf.destroy();
    }
  },

  // HyperFormula has no public API that lists the functions in a formula (its AST is internal),
  // so the "must use SUMIF" check would need our own tokenizer anyway.
  functionsUsed() {
    return null;
  },
};

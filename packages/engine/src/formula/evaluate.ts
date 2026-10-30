import type { CellValue, Cells, EvaluateOptions } from './types';
import { MAX_COL, MAX_ROW, parseAddress, toAddress } from './address';
import { FUNCTIONS } from './functions';
import { parse, type Node } from './parser';
import { FormulaSyntaxError } from './tokenizer';
import {
  FormulaError,
  compare,
  err,
  isErr,
  isRange,
  toNumber,
  toText,
  type Range,
  type Scalar,
  type Value,
} from './values';

export type Context = {
  value(node: Node): Value;
  scalar(node: Node): Scalar;
};

/** Default evaluation budget: far above any lesson formula, low enough to stay instant. */
export const DEFAULT_BUDGET = 50_000;

export function evaluateFormula(
  cells: Cells,
  formula: string,
  options: EvaluateOptions = {},
): CellValue {
  const visiting = new Set<string>();
  let budget = options.budget ?? DEFAULT_BUDGET;
  const spend = (amount = 1) => {
    budget -= amount;
    if (budget < 0) throw new BudgetExceeded();
  };

  function cell(address: string): Scalar {
    spend();
    const key = address.replace(/\$/g, '');
    const raw = cells[key];
    if (raw === undefined) return null;
    if (typeof raw === 'string' && raw.startsWith('=')) {
      if (visiting.has(key)) return err('#CYCLE!');
      visiting.add(key);
      try {
        return run(raw);
      } finally {
        visiting.delete(key);
      }
    }
    return raw;
  }

  function range(start: string, end: string): Range {
    const a = parseAddress(start);
    const b = parseAddress(end);
    // Charge for the whole range up front so A1:XFD1048576 fails fast instead of allocating.
    spend((Math.abs(a.row - b.row) + 1) * (Math.abs(a.col - b.col) + 1));
    const rows: Scalar[][] = [];
    for (let r = Math.min(a.row, b.row); r <= Math.max(a.row, b.row); r++) {
      const row: Scalar[] = [];
      for (let c = Math.min(a.col, b.col); c <= Math.max(a.col, b.col); c++) {
        row.push(cell(toAddress(r, c)));
      }
      rows.push(row);
    }
    return { kind: 'range', rows };
  }

  const ctx: Context = {
    value(node) {
      spend();
      switch (node.type) {
        case 'number':
        case 'string':
        case 'bool':
          return node.value;
        case 'name':
          return err('#NAME?');
        case 'ref':
          return inGrid(node.address) ? cell(node.address) : err('#REF!');
        case 'range':
          return inGrid(node.start) && inGrid(node.end)
            ? range(node.start, node.end)
            : err('#REF!');
        case 'unary': {
          const v = ctx.scalar(node.operand);
          if (isErr(v)) return v;
          const n = toNumber(v);
          return node.op === '-' ? -n : node.op === '%' ? n / 100 : n;
        }
        case 'binary':
          return binary(node.op, ctx.scalar(node.left), ctx.scalar(node.right));
        case 'call': {
          const fn = FUNCTIONS[node.name];
          if (!fn) return err('#NAME?');
          return fn(node.args, ctx);
        }
      }
    },
    scalar(node) {
      const v = ctx.value(node);
      if (!isRange(v)) return v;
      // A single-cell range behaves like the cell; implicit intersection is out of scope.
      if (v.rows.length === 1 && v.rows[0]!.length === 1) return v.rows[0]![0]!;
      return err('#VALUE!');
    },
  };

  function run(src: string): CellValue {
    let ast: Node;
    try {
      ast = parse(src);
    } catch (e) {
      if (e instanceof FormulaSyntaxError) return err('SYNTAX');
      throw e;
    }
    try {
      const v = ctx.scalar(ast);
      if (typeof v === 'number' && !Number.isFinite(v)) return err('#NUM!');
      return v;
    } catch (e) {
      if (e instanceof FormulaError) return err(e.code);
      throw e;
    }
  }

  try {
    return run(formula);
  } catch (e) {
    if (e instanceof BudgetExceeded) return err('TIMEOUT');
    throw e;
  }
}

/**
 * Not a FormulaError on purpose: IFERROR and nested cells must not turn it into a value.
 * It unwinds the whole evaluation and becomes TIMEOUT at the top.
 */
class BudgetExceeded extends Error {}

function inGrid(address: string): boolean {
  const { row, col } = parseAddress(address);
  return row <= MAX_ROW && col <= MAX_COL;
}

function binary(op: string, a: Scalar, b: Scalar): Scalar {
  if (isErr(a)) return a;
  if (isErr(b)) return b;
  switch (op) {
    case '+':
      return toNumber(a) + toNumber(b);
    case '-':
      return toNumber(a) - toNumber(b);
    case '*':
      return toNumber(a) * toNumber(b);
    case '/': {
      const d = toNumber(b);
      if (d === 0) return err('#DIV/0!');
      return toNumber(a) / d;
    }
    case '^':
      return toNumber(a) ** toNumber(b);
    case '&':
      return toText(a) + toText(b);
    case '=':
      return compare(a, b) === 0;
    case '<>':
      return compare(a, b) !== 0;
    case '<':
      return compare(a, b) < 0;
    case '>':
      return compare(a, b) > 0;
    case '<=':
      return compare(a, b) <= 0;
    case '>=':
      return compare(a, b) >= 0;
    default:
      return err('#VALUE!');
  }
}

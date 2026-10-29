import type { Context } from './evaluate';
import type { Node } from './parser';
import { makeCriterion } from './criteria';
import {
  FormulaError,
  compare,
  err,
  flatten,
  isErr,
  isRange,
  toBool,
  toNumber,
  toText,
  type Range,
  type Scalar,
  type Value,
} from './values';

type Fn = (args: Node[], ctx: Context) => Value;

function arity(args: Node[], min: number, max = min) {
  if (args.length < min || args.length > max) throw new FormulaError('#VALUE!');
}

function asRange(v: Value): Range {
  if (isRange(v)) return v;
  if (isErr(v)) throw new FormulaError(v.error);
  return { kind: 'range', rows: [[v]] };
}

/** Numbers for SUM-like functions: ranges skip text/booleans/blanks; direct arguments are coerced. */
function numbers(args: Node[], ctx: Context): number[] {
  const out: number[] = [];
  for (const node of args) {
    const v = ctx.value(node);
    if (isRange(v)) {
      for (const cell of v.rows.flat()) {
        if (isErr(cell)) throw new FormulaError(cell.error);
        if (typeof cell === 'number') out.push(cell);
      }
    } else {
      out.push(toNumber(v));
    }
  }
  return out;
}

function sameShape(a: Range, b: Range) {
  if (a.rows.length !== b.rows.length || a.rows[0]?.length !== b.rows[0]?.length) {
    throw new FormulaError('#VALUE!');
  }
}

/** Indices of cells matching every (range, criterion) pair. */
function matchingIndices(pairs: [Range, Scalar][]): number[] {
  const [first] = pairs;
  if (!first) throw new FormulaError('#VALUE!');
  pairs.forEach(([r]) => sameShape(first[0], r));
  const tests = pairs.map(([r, c]) => [r.rows.flat(), makeCriterion(c)] as const);
  const size = tests[0]![0].length;
  const out: number[] = [];
  for (let i = 0; i < size; i++) {
    if (tests.every(([cells, t]) => t(cells[i]!))) out.push(i);
  }
  return out;
}

function sumAt(range: Range, indices: number[]): number {
  const cells = range.rows.flat();
  let total = 0;
  for (const i of indices) {
    const v = cells[i];
    if (v !== undefined && isErr(v)) throw new FormulaError(v.error);
    if (typeof v === 'number') total += v;
  }
  return total;
}

function lookupIndex(values: Scalar[], target: Scalar, mode: 'exact' | 'below' | 'above'): number {
  if (mode === 'exact') {
    const matches = typeof target === 'string' ? makeCriterion(target) : null;
    return values.findIndex((v) => (matches ? matches(v) : compare(v, target) === 0 && v !== null));
  }
  // Approximate match on sorted data: the last value <= target ('below') or >= target ('above').
  let found = -1;
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    if (v === null || isErr(v)) continue;
    const c = compare(v, target);
    if (mode === 'below' ? c <= 0 : c >= 0) found = i;
    else break;
  }
  return found;
}

// ---- dates (Excel 1900 system, serial 1 = 1900-01-01, valid from 1900-03-01) ----
const EPOCH = Date.UTC(1899, 11, 30);
const toDate = (serial: number) => new Date(EPOCH + Math.floor(serial) * 86_400_000);
const toSerial = (y: number, m: number, d: number) => (Date.UTC(y, m - 1, d) - EPOCH) / 86_400_000;

export const FUNCTIONS: Record<string, Fn> = {
  SUM: (args, ctx) => numbers(args, ctx).reduce((a, b) => a + b, 0),
  AVERAGE: (args, ctx) => {
    const ns = numbers(args, ctx);
    return ns.length === 0 ? err('#DIV/0!') : ns.reduce((a, b) => a + b, 0) / ns.length;
  },
  MIN: (args, ctx) => {
    const ns = numbers(args, ctx);
    return ns.length === 0 ? 0 : Math.min(...ns);
  },
  MAX: (args, ctx) => {
    const ns = numbers(args, ctx);
    return ns.length === 0 ? 0 : Math.max(...ns);
  },
  COUNT: (args, ctx) =>
    args.flatMap((a) => flatten(ctx.value(a))).filter((v) => typeof v === 'number').length,
  COUNTA: (args, ctx) =>
    args.flatMap((a) => flatten(ctx.value(a))).filter((v) => v !== null && v !== '').length,
  ROUND: (args, ctx) => {
    arity(args, 2);
    const n = toNumber(ctx.scalar(args[0]!));
    const f = 10 ** toNumber(ctx.scalar(args[1]!));
    return (Math.sign(n) * Math.round(Math.abs(n) * f)) / f;
  },

  IF: (args, ctx) => {
    arity(args, 2, 3);
    const cond = ctx.scalar(args[0]!);
    if (isErr(cond)) return cond;
    if (toBool(cond)) return ctx.value(args[1]!);
    return args[2] ? ctx.value(args[2]) : false;
  },
  AND: (args, ctx) => args.flatMap((a) => flatten(ctx.value(a))).every((v) => toBool(v)),
  OR: (args, ctx) => args.flatMap((a) => flatten(ctx.value(a))).some((v) => toBool(v)),
  NOT: (args, ctx) => {
    arity(args, 1);
    return !toBool(ctx.scalar(args[0]!));
  },
  IFERROR: (args, ctx) => {
    arity(args, 2);
    try {
      const v = ctx.scalar(args[0]!);
      return isErr(v) ? ctx.value(args[1]!) : v;
    } catch (e) {
      if (e instanceof FormulaError) return ctx.value(args[1]!);
      throw e;
    }
  },

  SUMIF: (args, ctx) => {
    arity(args, 2, 3);
    const range = asRange(ctx.value(args[0]!));
    const sumRange = args[2] ? asRange(ctx.value(args[2])) : range;
    sameShape(range, sumRange);
    return sumAt(sumRange, matchingIndices([[range, ctx.scalar(args[1]!)]]));
  },
  SUMIFS: (args, ctx) => {
    if (args.length < 3 || args.length % 2 === 0) throw new FormulaError('#VALUE!');
    const sumRange = asRange(ctx.value(args[0]!));
    const pairs: [Range, Scalar][] = [];
    for (let i = 1; i < args.length; i += 2) {
      pairs.push([asRange(ctx.value(args[i]!)), ctx.scalar(args[i + 1]!)]);
    }
    pairs.forEach(([r]) => sameShape(sumRange, r));
    return sumAt(sumRange, matchingIndices(pairs));
  },
  COUNTIF: (args, ctx) => {
    arity(args, 2);
    return matchingIndices([[asRange(ctx.value(args[0]!)), ctx.scalar(args[1]!)]]).length;
  },
  COUNTIFS: (args, ctx) => {
    if (args.length < 2 || args.length % 2 === 1) throw new FormulaError('#VALUE!');
    const pairs: [Range, Scalar][] = [];
    for (let i = 0; i < args.length; i += 2) {
      pairs.push([asRange(ctx.value(args[i]!)), ctx.scalar(args[i + 1]!)]);
    }
    return matchingIndices(pairs).length;
  },

  VLOOKUP: (args, ctx) => {
    arity(args, 3, 4);
    const target = ctx.scalar(args[0]!);
    if (isErr(target)) return target;
    const table = asRange(ctx.value(args[1]!));
    const col = Math.trunc(toNumber(ctx.scalar(args[2]!)));
    const approximate = args[3] ? toBool(ctx.scalar(args[3])) : true;
    if (col < 1) return err('#VALUE!');
    if (col > (table.rows[0]?.length ?? 0)) return err('#REF!');
    const first = table.rows.map((r) => r[0]!);
    const i = lookupIndex(first, target, approximate ? 'below' : 'exact');
    return i < 0 ? err('#N/A') : table.rows[i]![col - 1]!;
  },
  XLOOKUP: (args, ctx) => {
    arity(args, 3, 5);
    const target = ctx.scalar(args[0]!);
    if (isErr(target)) return target;
    const lookup = asRange(ctx.value(args[1]!)).rows.flat();
    const result = asRange(ctx.value(args[2]!)).rows.flat();
    if (lookup.length !== result.length) return err('#VALUE!');
    const mode = args[4] ? toNumber(ctx.scalar(args[4])) : 0;
    let i: number;
    if (mode === 0 || mode === 2) {
      i =
        mode === 2
          ? lookupIndex(lookup, target, 'exact')
          : lookup.findIndex((v) => v !== null && compare(v, target) === 0);
    } else {
      // -1: exact or next smaller; 1: exact or next larger. Data need not be sorted.
      let best = -1;
      lookup.forEach((v, j) => {
        if (v === null || isErr(v)) return;
        const c = compare(v, target);
        if (c === 0 && (best < 0 || compare(lookup[best]!, target) !== 0)) best = j;
        else if (mode === -1 && c < 0 && (best < 0 || compare(v, lookup[best]!) > 0)) best = j;
        else if (mode === 1 && c > 0 && (best < 0 || compare(v, lookup[best]!) < 0)) best = j;
      });
      i = best;
    }
    if (i >= 0) return result[i]!;
    return args[3] ? ctx.value(args[3]) : err('#N/A');
  },
  MATCH: (args, ctx) => {
    arity(args, 2, 3);
    const target = ctx.scalar(args[0]!);
    if (isErr(target)) return target;
    const values = asRange(ctx.value(args[1]!)).rows.flat();
    const type = args[2] ? toNumber(ctx.scalar(args[2])) : 1;
    const i = lookupIndex(values, target, type === 0 ? 'exact' : type > 0 ? 'below' : 'above');
    return i < 0 ? err('#N/A') : i + 1;
  },
  INDEX: (args, ctx) => {
    arity(args, 2, 3);
    const table = asRange(ctx.value(args[0]!));
    let row = Math.trunc(toNumber(ctx.scalar(args[1]!)));
    let col = args[2] ? Math.trunc(toNumber(ctx.scalar(args[2]))) : 1;
    // A single row with one index argument means "column N".
    if (!args[2] && table.rows.length === 1) [row, col] = [1, row];
    const v = table.rows[row - 1]?.[col - 1];
    return v === undefined || row < 1 || col < 1 ? err('#REF!') : v;
  },

  LEN: (args, ctx) => {
    arity(args, 1);
    return [...toText(ctx.scalar(args[0]!))].length;
  },
  LEFT: (args, ctx) => {
    arity(args, 1, 2);
    const n = args[1] ? toNumber(ctx.scalar(args[1])) : 1;
    if (n < 0) return err('#VALUE!');
    return [...toText(ctx.scalar(args[0]!))].slice(0, n).join('');
  },
  RIGHT: (args, ctx) => {
    arity(args, 1, 2);
    const n = args[1] ? toNumber(ctx.scalar(args[1])) : 1;
    if (n < 0) return err('#VALUE!');
    const chars = [...toText(ctx.scalar(args[0]!))];
    return n === 0 ? '' : chars.slice(-n).join('');
  },
  MID: (args, ctx) => {
    arity(args, 3);
    const start = Math.trunc(toNumber(ctx.scalar(args[1]!)));
    const n = Math.trunc(toNumber(ctx.scalar(args[2]!)));
    if (start < 1 || n < 0) return err('#VALUE!');
    return [...toText(ctx.scalar(args[0]!))].slice(start - 1, start - 1 + n).join('');
  },
  FIND: (args, ctx) => find(args, ctx, true),
  SEARCH: (args, ctx) => find(args, ctx, false),
  UPPER: (args, ctx) => toText(ctx.scalar(args[0]!)).toUpperCase(),
  LOWER: (args, ctx) => toText(ctx.scalar(args[0]!)).toLowerCase(),
  CONCAT: (args, ctx) =>
    args
      .flatMap((a) => flatten(ctx.value(a)))
      .map(toText)
      .join(''),

  DATE: (args, ctx) => {
    arity(args, 3);
    const [y, m, d] = args.map((a) => Math.trunc(toNumber(ctx.scalar(a))));
    return toSerial(y!, m!, d!);
  },
  DATEDIF: (args, ctx) => {
    arity(args, 3);
    const start = toNumber(ctx.scalar(args[0]!));
    const end = toNumber(ctx.scalar(args[1]!));
    const unit = toText(ctx.scalar(args[2]!)).toUpperCase();
    if (start > end) return err('#NUM!');
    const a = toDate(start);
    const b = toDate(end);
    const months =
      (b.getUTCFullYear() - a.getUTCFullYear()) * 12 +
      (b.getUTCMonth() - a.getUTCMonth()) -
      (b.getUTCDate() < a.getUTCDate() ? 1 : 0);
    switch (unit) {
      case 'D':
        return Math.floor(end) - Math.floor(start);
      case 'M':
        return months;
      case 'Y':
        return Math.floor(months / 12);
      case 'YM':
        return months % 12;
      case 'MD': {
        const diff = b.getUTCDate() - a.getUTCDate();
        if (diff >= 0) return diff;
        const prevMonthDays = new Date(
          Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), 0),
        ).getUTCDate();
        return prevMonthDays - a.getUTCDate() + b.getUTCDate();
      }
      default:
        return err('#NUM!');
    }
  },
};

function find(args: Node[], ctx: Context, caseSensitive: boolean): Value {
  arity(args, 2, 3);
  let needle = toText(ctx.scalar(args[0]!));
  let hay = toText(ctx.scalar(args[1]!));
  const start = args[2] ? Math.trunc(toNumber(ctx.scalar(args[2]))) : 1;
  if (start < 1 || start > [...hay].length + 1) return err('#VALUE!');
  if (!caseSensitive) {
    needle = needle.toLowerCase();
    hay = hay.toLowerCase();
  }
  const chars = [...hay];
  const offset = chars.slice(0, start - 1).join('').length;
  const i = hay.indexOf(needle, offset);
  return i < 0 ? err('#VALUE!') : [...hay.slice(0, i)].length + 1;
}

export const SUPPORTED_FUNCTIONS = Object.keys(FUNCTIONS).sort();

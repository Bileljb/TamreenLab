import type { CellValue, ErrorCode, ErrorValue } from './types';

export type Scalar = CellValue;
export type Range = { kind: 'range'; rows: Scalar[][] };
export type Value = Scalar | Range;

export class FormulaError extends Error {
  constructor(readonly code: ErrorCode) {
    super(code);
  }
}

export const err = (code: ErrorCode): ErrorValue => ({ error: code });

export function isErr(v: Value): v is ErrorValue {
  return typeof v === 'object' && v !== null && 'error' in v;
}

export function isRange(v: Value): v is Range {
  return typeof v === 'object' && v !== null && 'kind' in v;
}

export function flatten(v: Value): Scalar[] {
  return isRange(v) ? v.rows.flat() : [v];
}

/** Excel's implicit conversion to number for operators and scalar arguments. */
export function toNumber(v: Scalar): number {
  if (isErr(v)) throw new FormulaError(v.error);
  if (v === null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const trimmed = v.trim();
  if (trimmed !== '' && !Number.isNaN(Number(trimmed))) return Number(trimmed);
  throw new FormulaError('#VALUE!');
}

export function toText(v: Scalar): string {
  if (isErr(v)) throw new FormulaError(v.error);
  if (v === null) return '';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return String(v);
}

export function toBool(v: Scalar): boolean {
  if (isErr(v)) throw new FormulaError(v.error);
  if (typeof v === 'boolean') return v;
  if (v === null) return false;
  if (typeof v === 'number') return v !== 0;
  const upper = v.toUpperCase();
  if (upper === 'TRUE') return true;
  if (upper === 'FALSE') return false;
  throw new FormulaError('#VALUE!');
}

/** Excel ordering for comparisons: numbers < text < booleans; text is case-insensitive. */
export function compare(a: Scalar, b: Scalar): number {
  const rank = (v: Scalar) =>
    typeof v === 'number' || v === null ? 0 : typeof v === 'string' ? 1 : 2;
  const ra = rank(a);
  const rb = rank(b);
  if (a === null && typeof b === 'string') return compare('', b);
  if (b === null && typeof a === 'string') return compare(a, '');
  if (ra !== rb) return ra - rb;
  if (ra === 1) {
    const x = (a as string).toLocaleLowerCase();
    const y = (b as string).toLocaleLowerCase();
    return x < y ? -1 : x > y ? 1 : 0;
  }
  const x = Number(a ?? 0);
  const y = Number(b ?? 0);
  return x - y;
}

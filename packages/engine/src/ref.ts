import { CELL_ADDRESS, RANGE_REF } from '@tamreen/shared';
import { parseAddress, toAddress } from './formula/address';

/** `$b$2` -> `B2`. Throws on anything that is not a cell address. */
export function normalizeAddress(address: string): string {
  const trimmed = address.trim();
  if (!CELL_ADDRESS.test(trimmed)) throw new Error(`Invalid cell address: ${address}`);
  return trimmed.replace(/\$/g, '').toUpperCase();
}

/** `$B$3:a1` -> `A1:B3`: no `$`, upper case, top-left corner first. Throws on a non-range. */
export function normalizeRange(range: string): string {
  const trimmed = range.trim();
  if (!RANGE_REF.test(trimmed)) throw new Error(`Invalid range: ${range}`);
  const [start, end] = trimmed.split(':').map((a) => parseAddress(a.replace(/\$/g, '')));
  const top = Math.min(start!.row, end!.row);
  const bottom = Math.max(start!.row, end!.row);
  const left = Math.min(start!.col, end!.col);
  const right = Math.max(start!.col, end!.col);
  return `${toAddress(top, left)}:${toAddress(bottom, right)}`;
}

export function sameCell(a: string, b: string): boolean {
  try {
    return normalizeAddress(a) === normalizeAddress(b);
  } catch {
    return false;
  }
}

export function sameRange(a: string, b: string): boolean {
  try {
    return normalizeRange(a) === normalizeRange(b);
  } catch {
    return false;
  }
}

/** Every address in a range, row by row. */
export function expandRange(range: string): string[] {
  const [start, end] = normalizeRange(range).split(':').map(parseAddress);
  const out: string[] = [];
  for (let r = start!.row; r <= end!.row; r++) {
    for (let c = start!.col; c <= end!.col; c++) out.push(toAddress(r, c));
  }
  return out;
}

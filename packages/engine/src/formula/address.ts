/** Last zero-based row and column of an Excel sheet (1,048,576 rows, columns up to XFD). */
export const MAX_ROW = 1_048_575;
export const MAX_COL = 16_383;

/** Zero-based row/column. */
export type Position = { row: number; col: number };

const ADDRESS = /^\$?([A-Z]{1,3})\$?(\d+)$/i;

export function columnToIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function indexToColumn(index: number): string {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

export function parseAddress(address: string): Position {
  const m = ADDRESS.exec(address);
  if (!m) throw new Error(`Invalid cell address: ${address}`);
  return { row: Number(m[2]) - 1, col: columnToIndex(m[1]!) };
}

export function toAddress(row: number, col: number): string {
  return `${indexToColumn(col)}${row + 1}`;
}

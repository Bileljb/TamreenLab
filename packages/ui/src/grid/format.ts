import type { CellValue } from '@tamreen/engine';
import { normalizeRange, parseAddress } from '@tamreen/engine';
import type { CELL_FORMATS } from '@tamreen/shared';

export type CellFormat = (typeof CELL_FORMATS)[number];

const DAY_MS = 86_400_000;
const EPOCH = Date.UTC(1899, 11, 30);

// Spreadsheet numbers use Latin digits, like Excel's grid; the surrounding UI is Arabic.
const general = new Intl.NumberFormat('en-US', { maximumFractionDigits: 10, useGrouping: false });
const grouped = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const money = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const ERROR_LABELS: Record<string, string> = { SYNTAX: '#ERROR!', TIMEOUT: '#TIMEOUT!' };

/** The text a cell shows for a value. */
export function formatValue(value: CellValue, format?: CellFormat): string {
  if (value === null) return '';
  if (typeof value === 'object') return ERROR_LABELS[value.error] ?? value.error;
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'string') return value;
  switch (format) {
    case 'number':
      return grouped.format(value);
    case 'currency':
      return money.format(value);
    case 'percent':
      return `${grouped.format(value * 100)}%`;
    case 'date':
      return new Date(EPOCH + Math.floor(value) * DAY_MS).toISOString().slice(0, 10);
    default:
      return general.format(value);
  }
}

/** The format that applies to a cell: the last matching entry wins, like later rules in a sheet. */
export function formatFor(
  formats: Record<string, CellFormat> | undefined,
  address: string,
): CellFormat | undefined {
  if (!formats) return undefined;
  const { row, col } = parseAddress(address);
  let found: CellFormat | undefined;
  for (const [ref, format] of Object.entries(formats)) {
    const range = ref.includes(':') ? ref : `${ref}:${ref}`;
    const [a, b] = normalizeRange(range).split(':').map(parseAddress);
    if (row >= a!.row && row <= b!.row && col >= a!.col && col <= b!.col) found = format;
  }
  return found;
}

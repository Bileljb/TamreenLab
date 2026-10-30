import type { Cells } from '@tamreen/shared';

/** Excel 1900 date system serial number (valid from 1900-03-01 onwards). */
export function dateSerial(year: number, month: number, day: number): number {
  return (Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 86_400_000;
}

// Original sample data: a small stationery sales table, a commission bracket table
// and a few text cells for the string functions.
const rows: [string, string, string, number, number, number][] = [
  ['سارة', 'الرياض', 'قلم', 120, 2.5, dateSerial(2024, 1, 15)],
  ['أحمد', 'القاهرة', 'دفتر', 80, 6, dateSerial(2024, 2, 3)],
  ['ليلى', 'الرياض', 'دفتر', 45, 6, dateSerial(2024, 2, 20)],
  ['عمر', 'تونس', 'قلم', 200, 2.5, dateSerial(2024, 3, 5)],
  ['سارة', 'القاهرة', 'ممحاة', 60, 1.5, dateSerial(2024, 3, 18)],
  ['أحمد', 'الرياض', 'قلم', 130, 2.5, dateSerial(2024, 4, 2)],
  ['ليلى', 'تونس', 'مسطرة', 30, 4, dateSerial(2024, 4, 25)],
  ['عمر', 'القاهرة', 'دفتر', 90, 6, dateSerial(2024, 5, 10)],
];

export function salesSheet(): Cells {
  const cells: Cells = {
    A1: 'المندوب',
    B1: 'المدينة',
    C1: 'المنتج',
    D1: 'الكمية',
    E1: 'السعر',
    F1: 'تاريخ البيع',
    H1: 'الحد الأدنى',
    I1: 'النسبة',
    H2: 0,
    I2: 0,
    H3: 50,
    I3: 0.02,
    H4: 100,
    I4: 0.05,
    H5: 150,
    I5: 0.08,
    K1: 'نص',
    K2: 'EMP-0042-RYD',
    K3: 'سارة أحمد',
  };
  rows.forEach((row, i) => {
    const r = i + 2;
    (['A', 'B', 'C', 'D', 'E', 'F'] as const).forEach((col, c) => {
      cells[`${col}${r}`] = row[c]!;
    });
  });
  return cells;
}

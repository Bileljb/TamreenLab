import { salesSheet } from './dataset';
import type { CellValue, Cells } from './types';

export type Case = {
  id: string;
  formula: string;
  expected: CellValue;
  /** Optional replacement data, used for the hard-coded answer (variant) check. */
  cells?: Cells;
};

const base = salesSheet();

/** Same sheet with different quantities: a hard-coded "=450" must stop matching. */
export const variantSheet: Cells = { ...base, D2: 10, D5: 20, D7: 30 };

export const cases: Case[] = [
  { id: 'sum', formula: '=SUM(D2:D9)', expected: 755 },
  { id: 'sum-absolute-refs', formula: '=SUM($D$2:$D$9)', expected: 755 },
  { id: 'if', formula: '=IF(D2>100,"مرتفع","منخفض")', expected: 'مرتفع' },
  { id: 'if-and', formula: '=IF(AND(D3>50,E3>5),"نعم","لا")', expected: 'نعم' },
  { id: 'sumif-text', formula: '=SUMIF(C2:C9,"قلم",D2:D9)', expected: 450 },
  { id: 'sumif-variant', formula: '=SUMIF(C2:C9,"قلم",D2:D9)', expected: 60, cells: variantSheet },
  { id: 'sumif-operator', formula: '=SUMIF(D2:D9,"<60")', expected: 75 },
  { id: 'countifs', formula: '=COUNTIFS(B2:B9,"الرياض",D2:D9,">50")', expected: 2 },
  { id: 'vlookup-exact', formula: '=VLOOKUP("مسطرة",C2:E9,3,FALSE)', expected: 4 },
  { id: 'vlookup-approx', formula: '=VLOOKUP(120,H2:I5,2,TRUE)', expected: 0.05 },
  { id: 'vlookup-na', formula: '=VLOOKUP("قلم رصاص",C2:E9,3,FALSE)', expected: { error: '#N/A' } },
  { id: 'xlookup', formula: '=XLOOKUP("عمر",A2:A9,D2:D9)', expected: 200 },
  {
    id: 'xlookup-if-not-found',
    formula: '=XLOOKUP("خالد",A2:A9,D2:D9,"غير موجود")',
    expected: 'غير موجود',
  },
  { id: 'index-match', formula: '=INDEX(B2:B9,MATCH(200,D2:D9,0))', expected: 'تونس' },
  { id: 'left', formula: '=LEFT(K2,3)', expected: 'EMP' },
  { id: 'mid-find', formula: '=MID(K2,FIND("-",K2)+1,4)', expected: '0042' },
  { id: 'left-find-arabic', formula: '=LEFT(K3,FIND(" ",K3)-1)', expected: 'سارة' },
  { id: 'datedif-months', formula: '=DATEDIF(F2,F9,"m")', expected: 3 },
  { id: 'datedif-days', formula: '=DATEDIF(F2,F9,"d")', expected: 116 },
  { id: 'div0', formula: '=D2/0', expected: { error: '#DIV/0!' } },
  { id: 'unknown-function', formula: '=SUMM(D2:D9)', expected: { error: '#NAME?' } },
  { id: 'syntax-error', formula: '=SUM(D2:D9', expected: { error: 'SYNTAX' } },
];

/** Separator handling (PLAN T9): learners may type ";" instead of ",". */
export const semicolonCase: Case = {
  id: 'sumif-semicolons',
  formula: '=SUMIF(C2:C9;"قلم";D2:D9)',
  expected: 450,
};

export function cellsFor(c: Case): Cells {
  return c.cells ?? base;
}

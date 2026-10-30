import type { AnswerFor, StepOf } from '@tamreen/shared';
import { normalizeDigits } from '../normalize';
import { sameCell, sameRange } from '../ref';
import { result, type CheckResult } from './result';

export function checkSelectCell(
  step: StepOf<'SELECT_CELL'>,
  answer: AnswerFor['SELECT_CELL'],
): CheckResult {
  return result(sameCell(answer.cell, step.check.target) ? 'OK' : 'WRONG_CELL');
}

export function checkSelectRange(
  step: StepOf<'SELECT_RANGE'>,
  answer: AnswerFor['SELECT_RANGE'],
): CheckResult {
  return result(sameRange(answer.range, step.check.target) ? 'OK' : 'WRONG_CELL');
}

export function checkMultipleChoice(
  step: StepOf<'MULTIPLE_CHOICE'>,
  answer: AnswerFor['MULTIPLE_CHOICE'],
): CheckResult {
  return result(answer.choice === step.check.correct ? 'OK' : 'WRONG_VALUE');
}

export function checkEnterValue(
  step: StepOf<'ENTER_VALUE'>,
  answer: AnswerFor['ENTER_VALUE'],
): CheckResult {
  const { target, expected, tolerance } = step.check;
  if (!sameCell(answer.cell, target)) return result('WRONG_CELL');
  return result(valueMatches(answer.value, expected, tolerance) ? 'OK' : 'WRONG_VALUE');
}

/** Compares a typed value with an expected one; shared with the formula checker. */
export function valueMatches(
  typed: string | number | boolean | null,
  expected: string | number | boolean,
  tolerance?: number,
): boolean {
  if (typeof expected === 'number') {
    const n =
      typeof typed === 'number' ? typed : typeof typed === 'string' ? parseNumber(typed) : null;
    return n !== null && numbersClose(n, expected, tolerance);
  }
  if (typeof expected === 'boolean') {
    const b =
      typeof typed === 'boolean' ? typed : typeof typed === 'string' ? parseBoolean(typed) : null;
    return b === expected;
  }
  if (typeof typed !== 'string') return false;
  return normalizeText(typed) === normalizeText(expected);
}

export function numbersClose(actual: number, expected: number, tolerance?: number): boolean {
  // Without an explicit tolerance, absorb floating-point noise only (0.1+0.2 vs 0.3).
  const allowed = tolerance ?? 1e-9 * Math.max(1, Math.abs(expected));
  return Math.abs(actual - expected) <= allowed;
}

/** "1,250.5", "١٢٥٠٫٥", "5%" and "٥٪" are numbers; "12,50" and "=5" are not. */
export function parseNumber(text: string): number | null {
  let s = normalizeDigits(text).replace(/٬/g, ',').replace(/٪/g, '%').replace(/\s+/g, '');
  let scale = 1;
  if (s.endsWith('%')) {
    scale = 0.01;
    s = s.slice(0, -1);
  }
  if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  return Number(s) * scale;
}

const TRUE_WORDS = new Set(['TRUE', 'صحيح', 'صح']);
const FALSE_WORDS = new Set(['FALSE', 'خطأ', 'خطا']);

function parseBoolean(text: string): boolean | null {
  const word = text.trim().toUpperCase();
  if (TRUE_WORDS.has(word)) return true;
  if (FALSE_WORDS.has(word)) return false;
  return null;
}

/** Case, surrounding and repeated spaces, tashkeel and tatweel do not change a text answer. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[ً-ْٰـ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase();
}

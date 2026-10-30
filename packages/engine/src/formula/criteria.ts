import { FormulaError, compare, isErr, type Scalar } from './values';

/**
 * SUMIF/COUNTIF criteria: "قلم", ">50", "<>x", "a*", 42 or TRUE.
 * Text matching is case-insensitive and supports * and ? wildcards (~ escapes them).
 */
export function makeCriterion(criterion: Scalar): (v: Scalar) => boolean {
  // An error criterion (e.g. unquoted text, which is #NAME?) is the result, not a blank match.
  if (isErr(criterion)) throw new FormulaError(criterion.error);
  if (typeof criterion === 'number' || typeof criterion === 'boolean') {
    return (v) =>
      v === criterion || (typeof v === 'string' && v.trim() !== '' && Number(v) === criterion);
  }
  const text = criterion ?? '';
  const m = /^(<>|<=|>=|=|<|>)?(.*)$/s.exec(text)!;
  const op = m[1] ?? '=';
  const operand = m[2]!;
  const asNumber = operand.trim() !== '' && !Number.isNaN(Number(operand)) ? Number(operand) : null;

  if (asNumber !== null) {
    return (v) => {
      if (typeof v !== 'number') return op === '<>';
      return test(op, v - asNumber);
    };
  }
  if (op === '=' || op === '<>') {
    const pattern = wildcardRegex(operand);
    const matches = (v: Scalar) =>
      operand === '' ? v === null || v === '' : typeof v === 'string' && pattern.test(v);
    return op === '=' ? matches : (v) => !matches(v);
  }
  return (v) => typeof v === 'string' && test(op, compare(v, operand));
}

function test(op: string, diff: number): boolean {
  switch (op) {
    case '=':
      return diff === 0;
    case '<>':
      return diff !== 0;
    case '<':
      return diff < 0;
    case '>':
      return diff > 0;
    case '<=':
      return diff <= 0;
    default:
      return diff >= 0;
  }
}

function wildcardRegex(pattern: string): RegExp {
  let src = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]!;
    if (ch === '~' && i + 1 < pattern.length) {
      src += escape(pattern[++i]!);
    } else if (ch === '*') {
      src += '.*';
    } else if (ch === '?') {
      src += '.';
    } else {
      src += escape(ch);
    }
  }
  return new RegExp(`^${src}$`, 'iu');
}

const escape = (ch: string) => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

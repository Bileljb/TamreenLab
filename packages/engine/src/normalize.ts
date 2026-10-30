import { FormulaSyntaxError, tokenize, type Token } from './formula/tokenizer';

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';

/** Arabic-Indic and Persian digits to ASCII; the Arabic decimal separator "٫" to ".". */
export function normalizeDigits(text: string): string {
  return text.replace(/[٠-٩۰-۹٫]/g, (ch) => {
    if (ch === '٫') return '.';
    const i = ARABIC_INDIC.indexOf(ch);
    return String(i >= 0 ? i : PERSIAN.indexOf(ch));
  });
}

/**
 * Cleans what a learner typed before it reaches the evaluator: trims, adds a missing "=", and
 * outside string literals maps Arabic-keyboard input to Excel's (digits, "؛" and "،" as argument
 * separators, full-width "="). Never fail a learner over their keyboard layout (PLAN T9).
 */
export function prepareFormula(input: string): string {
  const trimmed = input.trim().replace(/^＝/, '=');
  if (trimmed === '') return '';
  const withEquals = trimmed.startsWith('=') ? trimmed : `=${trimmed}`;
  return withEquals.replace(/("(?:[^"]|"")*"?)|[^"]+/g, (part, str: string | undefined) =>
    str !== undefined ? str : normalizeDigits(part).replace(/[؛،]/g, ','),
  );
}

function tokensOf(formula: string): Token[] | null {
  const body = formula.trim().replace(/^=/, '');
  try {
    return tokenize(body);
  } catch (e) {
    if (e instanceof FormulaSyntaxError) return null;
    throw e;
  }
}

function render(token: Token, ignoreAbsolute: boolean): string {
  switch (token.kind) {
    case 'number':
      return String(token.value);
    case 'string':
      return `"${token.value.replace(/"/g, '""')}"`;
    case 'bool':
      return token.value ? 'TRUE' : 'FALSE';
    case 'ref':
      return ignoreAbsolute ? token.value.replace(/\$/g, '') : token.value;
    case 'func':
    case 'name':
    case 'op':
      return token.value;
    case 'lparen':
      return '(';
    case 'rparen':
      return ')';
    case 'sep':
      return ',';
    case 'eof':
      return '';
  }
}

/**
 * One spelling per formula, for comparing formula text: upper case, no whitespace, "," as the
 * separator, numbers re-printed, and optionally no "$". Null if the formula cannot be tokenized.
 */
export function canonicalFormula(
  formula: string,
  { ignoreAbsolute = false }: { ignoreAbsolute?: boolean } = {},
): string | null {
  const tokens = tokensOf(formula);
  if (!tokens) return null;
  return `=${tokens.map((t) => render(t, ignoreAbsolute)).join('')}`;
}

/** True if the formula reads at least one cell. "=450" does not. */
export function hasCellReference(formula: string): boolean {
  return tokensOf(formula)?.some((t) => t.kind === 'ref') ?? false;
}

function refs(formula: string): string[] | null {
  const tokens = tokensOf(formula);
  if (!tokens) return null;
  return tokens.flatMap((t) => (t.kind === 'ref' ? [t.value.toUpperCase()] : []));
}

/**
 * For steps that teach absolute references (`acceptEquivalentRefs: false`): every cell the learner
 * references that the solution also references must carry the same "$" anchoring.
 */
export function anchoringMatches(learner: string, solution: string): boolean {
  const learnerRefs = refs(learner);
  const solutionRefs = refs(solution);
  if (!learnerRefs || !solutionRefs) return false;
  const expected = new Map(solutionRefs.map((r) => [r.replace(/\$/g, ''), r]));
  return learnerRefs.every((r) => {
    const anchored = expected.get(r.replace(/\$/g, ''));
    return anchored === undefined || anchored === r;
  });
}

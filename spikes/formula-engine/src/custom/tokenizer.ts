export type Token =
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'bool'; value: boolean }
  | { kind: 'ref'; value: string }
  | { kind: 'func'; value: string }
  | { kind: 'name'; value: string } // unknown identifier: evaluates to #NAME?
  | { kind: 'op'; value: string }
  | { kind: 'lparen' }
  | { kind: 'rparen' }
  | { kind: 'sep' }
  | { kind: 'eof' };

export class FormulaSyntaxError extends Error {}

const REF = /^\$?[A-Z]{1,3}\$?\d+/i;
const NUMBER = /^(\d+(\.\d*)?|\.\d+)(E[+-]?\d+)?/i;
const NAME = /^[A-Z_][A-Z0-9_.]*/i;
const OPS = ['<>', '<=', '>=', '+', '-', '*', '/', '^', '&', '=', '<', '>', ':', '%'];

/**
 * Tokenises a formula body (without the leading "="). Both "," and ";" are argument separators
 * (PLAN T9), so learners on comma-decimal locales are never failed over a separator.
 */
export function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '"') {
      let value = '';
      i++;
      for (;;) {
        if (i >= src.length) throw new FormulaSyntaxError('Unterminated string');
        if (src[i] === '"') {
          if (src[i + 1] === '"') {
            value += '"';
            i += 2;
            continue;
          }
          i++;
          break;
        }
        value += src[i++];
      }
      tokens.push({ kind: 'string', value });
      continue;
    }
    if (ch === '(') {
      tokens.push({ kind: 'lparen' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ kind: 'rparen' });
      i++;
      continue;
    }
    if (ch === ',' || ch === ';') {
      tokens.push({ kind: 'sep' });
      i++;
      continue;
    }
    const rest = src.slice(i);
    const op = OPS.find((o) => rest.startsWith(o));
    if (op) {
      tokens.push({ kind: 'op', value: op });
      i += op.length;
      continue;
    }
    const num = NUMBER.exec(rest);
    if (num) {
      tokens.push({ kind: 'number', value: Number(num[0]) });
      i += num[0].length;
      continue;
    }
    const name = NAME.exec(rest);
    if (name && rest.slice(name[0].length).trimStart().startsWith('(')) {
      tokens.push({ kind: 'func', value: name[0].toUpperCase() });
      i += name[0].length;
      continue;
    }
    const ref = REF.exec(rest);
    if (ref && !/^[A-Z0-9_.]/i.test(rest.slice(ref[0].length))) {
      tokens.push({ kind: 'ref', value: ref[0].toUpperCase() });
      i += ref[0].length;
      continue;
    }
    if (name) {
      const word = name[0].toUpperCase();
      tokens.push(
        word === 'TRUE' || word === 'FALSE'
          ? { kind: 'bool', value: word === 'TRUE' }
          : { kind: 'name', value: word },
      );
      i += name[0].length;
      continue;
    }
    throw new FormulaSyntaxError(`Unexpected character "${ch}"`);
  }
  tokens.push({ kind: 'eof' });
  return tokens;
}

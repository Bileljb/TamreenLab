import { FormulaSyntaxError, tokenize, type Token } from './tokenizer';

export type Node =
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'bool'; value: boolean }
  | { type: 'ref'; address: string }
  | { type: 'range'; start: string; end: string }
  | { type: 'name'; name: string }
  | { type: 'unary'; op: '-' | '+' | '%'; operand: Node }
  | { type: 'binary'; op: string; left: Node; right: Node }
  | { type: 'call'; name: string; args: Node[] };

// Excel operator precedence, lowest first.
const BINARY: Record<string, number> = {
  '=': 1,
  '<>': 1,
  '<': 1,
  '>': 1,
  '<=': 1,
  '>=': 1,
  '&': 2,
  '+': 3,
  '-': 3,
  '*': 4,
  '/': 4,
  '^': 5,
};
const PREFIX_POWER = 6; // unary minus binds tighter than ^ in Excel: =-2^2 is 4
const POSTFIX_PERCENT = 7;

/** Parses a formula. The leading "=" is optional. Throws FormulaSyntaxError. */
export function parse(formula: string): Node {
  const body = formula.trimStart().startsWith('=') ? formula.trimStart().slice(1) : formula;
  const tokens = tokenize(body);
  let pos = 0;

  const peek = (): Token => tokens[pos]!;
  const next = (): Token => tokens[pos++]!;
  const expect = (kind: Token['kind']) => {
    const t = next();
    if (t.kind !== kind) throw new FormulaSyntaxError(`Expected ${kind}, got ${t.kind}`);
    return t;
  };

  function primary(): Node {
    const t = next();
    switch (t.kind) {
      case 'number':
        return { type: 'number', value: t.value };
      case 'string':
        return { type: 'string', value: t.value };
      case 'bool':
        return { type: 'bool', value: t.value };
      case 'name':
        return { type: 'name', name: t.value };
      case 'ref': {
        const after = peek();
        if (after.kind === 'op' && after.value === ':') {
          next();
          const end = expect('ref');
          return { type: 'range', start: t.value, end: (end as { value: string }).value };
        }
        return { type: 'ref', address: t.value };
      }
      case 'func': {
        expect('lparen');
        const args: Node[] = [];
        if (peek().kind !== 'rparen') {
          for (;;) {
            // An empty argument (e.g. "IF(A1,,2)") is passed as an empty string.
            if (peek().kind === 'sep' || peek().kind === 'rparen') {
              args.push({ type: 'string', value: '' });
            } else {
              args.push(expression(0));
            }
            if (peek().kind === 'sep') {
              next();
              continue;
            }
            break;
          }
        }
        expect('rparen');
        return { type: 'call', name: t.value, args };
      }
      case 'lparen': {
        const inner = expression(0);
        expect('rparen');
        return inner;
      }
      case 'op':
        if (t.value === '-' || t.value === '+') {
          return { type: 'unary', op: t.value, operand: expression(PREFIX_POWER) };
        }
        throw new FormulaSyntaxError(`Unexpected operator ${t.value}`);
      default:
        throw new FormulaSyntaxError(`Unexpected ${t.kind}`);
    }
  }

  function expression(minPower: number): Node {
    let left = primary();
    for (;;) {
      const t = peek();
      if (t.kind !== 'op') break;
      if (t.value === '%') {
        if (POSTFIX_PERCENT < minPower) break;
        next();
        left = { type: 'unary', op: '%', operand: left };
        continue;
      }
      const power = BINARY[t.value];
      if (power === undefined || power <= minPower) break;
      next();
      // ^ is left-associative in Excel, like the others.
      const right = expression(power);
      left = { type: 'binary', op: t.value, left, right };
    }
    return left;
  }

  const ast = expression(0);
  if (peek().kind !== 'eof') throw new FormulaSyntaxError('Unexpected input after formula');
  return ast;
}

/** Upper-case names of all functions called in the formula, in first-use order. */
export function collectFunctions(node: Node, out = new Set<string>()): Set<string> {
  switch (node.type) {
    case 'call':
      out.add(node.name);
      node.args.forEach((a) => collectFunctions(a, out));
      break;
    case 'unary':
      collectFunctions(node.operand, out);
      break;
    case 'binary':
      collectFunctions(node.left, out);
      collectFunctions(node.right, out);
      break;
    default:
      break;
  }
  return out;
}

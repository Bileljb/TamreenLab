import type { ReactNode } from 'react';
import type { Glossary } from '@tamreen/shared';
import { Formula } from '../Formula';

export type PromptToken =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'term'; text: string };

/**
 * Prompt markup (markdown-lite): `**bold**`, `` `=SUM(A1:A3)` `` for formulas and references
 * (always LTR), and `{{خلية}}` for a glossary term.
 */
export function tokenizePrompt(text: string): PromptToken[] {
  const tokens: PromptToken[] = [];
  const pattern = /\*\*(.+?)\*\*|`([^`]+)`|\{\{(.+?)\}\}/g;
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    if (m.index > last) tokens.push({ kind: 'text', text: text.slice(last, m.index) });
    if (m[1] !== undefined) tokens.push({ kind: 'bold', text: m[1] });
    else if (m[2] !== undefined) tokens.push({ kind: 'code', text: m[2] });
    else tokens.push({ kind: 'term', text: m[3]! });
    last = m.index + m[0].length;
  }
  if (last < text.length) tokens.push({ kind: 'text', text: text.slice(last) });
  return tokens;
}

/** Glossary terms each prompt introduces: a term gets its English name on first use per lesson. */
export function firstUses(prompts: string[]): Set<string>[] {
  const seen = new Set<string>();
  return prompts.map((prompt) => {
    const fresh = new Set<string>();
    for (const token of tokenizePrompt(prompt)) {
      if (token.kind === 'term' && !seen.has(token.text)) {
        seen.add(token.text);
        fresh.add(token.text);
      }
    }
    return fresh;
  });
}

type Props = {
  text: string;
  glossary: Glossary;
  /** Terms to show with their English name in brackets. */
  introduce: Set<string>;
};

export function Prompt({ text, glossary, introduce }: Props) {
  const nodes: ReactNode[] = tokenizePrompt(text).map((token, i) => {
    switch (token.kind) {
      case 'text':
        return token.text;
      case 'bold':
        return <strong key={i}>{token.text}</strong>;
      case 'code':
        return (
          <Formula key={i} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em]">
            {token.text}
          </Formula>
        );
      case 'term': {
        const english = glossary[token.text];
        return (
          <span key={i}>
            <dfn className="font-semibold not-italic text-emerald-800" title={english}>
              {token.text}
            </dfn>
            {english && introduce.has(token.text) ? (
              <>
                {' ('}
                <bdi dir="ltr" lang="en">
                  {english}
                </bdi>
                {')'}
              </>
            ) : null}
          </span>
        );
      }
    }
  });
  return <p className="text-lg leading-9">{nodes}</p>;
}

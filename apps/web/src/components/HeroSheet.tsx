'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Row = { name: string; qty: number };

type Props = {
  labels: {
    title: string;
    hint: string;
    item: string;
    qty: string;
    total: string;
    tryThese: string;
    formulaBar: string;
    error: string;
  };
  rows: Row[];
  demoFormula: string;
  /** The demo formula's result, worked out on the server so the first paint is complete. */
  demoResult: string;
  suggestions: string[];
};

const COLS = ['A', 'B'] as const;
const reducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Cells a formula refers to (B2, B2:B4), to light them up like Excel's reference colours. */
function referenced(formula: string): Set<string> {
  const cells = new Set<string>();
  for (const m of formula.toUpperCase().matchAll(/\b([AB])([1-5])(?::([AB])([1-5]))?\b/g)) {
    const from = { col: m[1]!, row: Number(m[2]) };
    const to = { col: m[3] ?? from.col, row: Number(m[4] ?? from.row) };
    const cols = COLS.filter((c) => c >= [from.col, to.col].sort()[0]! && c <= [from.col, to.col].sort()[1]!);
    for (const c of cols) {
      for (let r = Math.min(from.row, to.row); r <= Math.max(from.row, to.row); r++) cells.add(`${c}${r}`);
    }
  }
  return cells;
}

/** A result as the cell shows it; parse errors read as a short hint, Excel errors as their code. */
function display(value: unknown, syntaxError: string): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    const code = (value as { error: string }).error;
    return code.startsWith('#') ? code : syntaxError;
  }
  if (typeof value === 'number') return new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return String(value);
}

/**
 * The home page's live spreadsheet: it types a demo formula, then lets the visitor write their
 * own. The formula engine loads only when it is first needed.
 */
export function HeroSheet({ labels, rows, demoFormula, demoResult, suggestions }: Props) {
  const [formula, setFormula] = useState(demoFormula);
  const [result, setResult] = useState(demoResult);
  const [pulse, setPulse] = useState(0);
  const [typing, setTyping] = useState(false);
  const touched = useRef(false);
  const input = useRef<HTMLInputElement>(null);

  const cells = useMemo(() => {
    const out: Record<string, string | number> = { A1: labels.item, B1: labels.qty, A5: labels.total };
    rows.forEach((r, i) => {
      out[`A${i + 2}`] = r.name;
      out[`B${i + 2}`] = r.qty;
    });
    return out;
  }, [labels, rows]);

  async function run(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return setResult('');
    const { Sheet } = await import('@tamreen/engine');
    const value = new Sheet(cells).evaluate(trimmed.startsWith('=') ? trimmed : `=${trimmed}`);
    setResult(display(value, labels.error));
    setPulse((p) => p + 1);
  }

  // The demo: type the formula character by character, then "press Enter".
  useEffect(() => {
    if (reducedMotion()) return;
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const start = setTimeout(() => {
      setTyping(true);
      setFormula('');
      setResult('');
      const step = () => {
        if (touched.current) return setTyping(false);
        i++;
        setFormula(demoFormula.slice(0, i));
        if (i < demoFormula.length) timer = setTimeout(step, 85);
        else {
          setTyping(false);
          void run(demoFormula);
        }
      };
      timer = setTimeout(step, 300);
    }, 900);
    return () => {
      clearTimeout(start);
      clearTimeout(timer);
    };
    // Runs once on mount; `run` only reads stable props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lit = referenced(formula);

  function choose(text: string) {
    touched.current = true;
    setFormula(text);
    void run(text);
    input.current?.focus();
  }

  return (
    <div className="relative">
      <div aria-hidden className="brand-gradient absolute -inset-4 -z-10 rounded-[2rem] opacity-25 blur-2xl" />
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-raised shadow-lift">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-sunken/60 px-4 py-2.5">
          <div className="flex items-center gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-[#ff5f57]" />
            <span className="size-2.5 rounded-full bg-[#febc2e]" />
            <span className="size-2.5 rounded-full bg-[#28c840]" />
          </div>
          <span className="text-xs font-semibold text-muted">{labels.title}</span>
          <span className="w-10" />
        </div>

        <div dir="ltr" className="flex items-center gap-2 border-b border-line px-3 py-2">
          <span className="rounded-md border border-line bg-sunken px-2 py-1 font-mono text-xs text-muted">B5</span>
          <span className="font-serif text-sm italic text-faint" aria-hidden>
            fx
          </span>
          <input
            ref={input}
            value={formula}
            aria-label={labels.formulaBar}
            spellCheck={false}
            autoComplete="off"
            onFocus={() => (touched.current = true)}
            onChange={(e) => {
              touched.current = true;
              setFormula(e.target.value);
            }}
            onKeyDown={(e) => e.key === 'Enter' && void run(formula)}
            className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-1 font-mono text-sm text-ink outline-none ring-brand/40 focus:ring-2"
          />
          {typing ? <span aria-hidden className="h-4 w-0.5 animate-blink bg-brand" /> : null}
        </div>

        <table dir="ltr" className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-sunken/70 text-xs text-faint">
              <th className="w-10 border-b border-line py-1 font-medium" />
              {COLS.map((c) => (
                <th key={c} className="border-b border-s border-line py-1 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map((r) => (
              <tr key={r}>
                <th className="border-b border-line bg-sunken/70 text-xs font-medium text-faint">{r}</th>
                {COLS.map((c) => {
                  const address = `${c}${r}`;
                  const isTarget = address === 'B5';
                  const value = isTarget ? result : cells[address];
                  return (
                    <td
                      key={c}
                      dir="auto"
                      className={`h-10 border-b border-s border-line px-3 transition-colors ${
                        r === 1 ? 'font-semibold text-ink-soft' : ''
                      } ${typeof value === 'number' || isTarget ? 'text-end tabular-nums' : 'text-start'} ${
                        lit.has(address) ? 'bg-accent-soft outline outline-2 -outline-offset-2 outline-accent/60' : ''
                      } ${isTarget ? 'font-bold text-brand-strong outline outline-2 -outline-offset-2 outline-brand' : ''}`}
                    >
                      <span key={isTarget ? pulse : undefined} className={isTarget && pulse ? 'inline-block animate-pop' : ''}>
                        {value}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <span className="text-xs text-muted">{labels.tryThese}</span>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              dir="ltr"
              onClick={() => choose(s)}
              className="rounded-full border border-line bg-sunken px-2.5 py-1 font-mono text-xs text-ink-soft transition hover:-translate-y-px hover:border-brand hover:text-brand-strong"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted">{labels.hint}</p>
    </div>
  );
}

'use client';

import { useState } from 'react';

type Item = { name: string; summary: string; href: string; category: string; localName?: string };

/** The function guide with a live filter. Rendered on the server too, so every card is indexable. */
export function FunctionSearch({
  items,
  categories,
  labels,
}: {
  items: Item[];
  categories: { key: string; title: string }[];
  labels: { search: string; empty: string };
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const match = (i: Item) =>
    !q || [i.name, i.summary, i.localName ?? ''].some((s) => s.toLowerCase().includes(q));
  const shown = items.filter(match);

  return (
    <div className="flex flex-col gap-10">
      <label className="relative block">
        <span className="sr-only">{labels.search}</span>
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-faint" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM21 21l-5-5" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={labels.search}
          className="w-full rounded-2xl border border-line bg-raised py-3.5 ps-12 pe-4 text-base shadow-soft outline-none transition focus:border-brand focus:shadow-glow"
        />
      </label>
      {shown.length === 0 ? <p className="text-center text-muted">{labels.empty}</p> : null}
      {categories.map(({ key, title }) => {
        const inCategory = shown.filter((f) => f.category === key);
        if (inCategory.length === 0) return null;
        return (
          <section key={key} aria-labelledby={`cat-${key}`} className="flex flex-col gap-4">
            <h2 id={`cat-${key}`} className="text-xl font-bold">
              {title}
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {inCategory.map((fn) => (
                <li key={fn.href}>
                  <a
                    href={fn.href}
                    className="group flex h-full flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-raised p-5 shadow-soft transition hover:-translate-y-1 hover:border-brand/50 hover:shadow-lift"
                  >
                    <span className="flex items-center justify-between gap-2" dir="ltr">
                      <span className="font-mono text-lg font-bold text-brand-strong">
                        {fn.name}
                        <span className="text-faint">()</span>
                      </span>
                      {fn.localName ? (
                        <span className="rounded-full bg-sunken px-2 py-0.5 font-mono text-xs text-muted">{fn.localName}</span>
                      ) : null}
                    </span>
                    <span className="leading-7 text-muted">{fn.summary}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

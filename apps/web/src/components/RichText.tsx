import type { Glossary } from '@tamreen/shared';
import { Prompt } from '@tamreen/ui';

/** Paragraphs of prompt markup (formulas stay LTR, glossary terms get their English name once). */
export function RichText({
  text,
  glossary,
  introduce = new Set<string>(),
}: {
  text: string;
  glossary: Glossary;
  introduce?: Set<string>;
}) {
  return (
    <div className="flex flex-col gap-3 [&_p]:text-base [&_p]:leading-8">
      {text.split(/\n{2,}/).map((paragraph, i) => (
        <Prompt
          key={i}
          text={paragraph}
          glossary={glossary}
          introduce={i === 0 ? introduce : new Set()}
        />
      ))}
    </div>
  );
}

export function Faq({
  items,
  title,
  glossary,
}: {
  items: { qAr: string; aAr: string }[];
  title: string;
  glossary: Glossary;
}) {
  return (
    <section aria-labelledby="faq-title" className="flex flex-col gap-3">
      <h2 id="faq-title" className="mb-1 text-xl font-bold">
        {title}
      </h2>
      {items.map((item, i) => (
        <details
          key={i}
          className="group rounded-2xl border border-line bg-raised px-5 py-4 shadow-soft transition open:border-brand/40"
          open={i === 0}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold [&::-webkit-details-marker]:hidden">
            <span className="inline [&>p]:inline [&>p]:text-base">
              <Prompt text={item.qAr} glossary={glossary} introduce={new Set()} />
            </span>
            <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-sunken text-muted transition group-open:rotate-180 group-open:bg-brand-soft group-open:text-brand-strong">
              <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m5 8 5 5 5-5" /></svg>
            </span>
          </summary>
          <div className="mt-3 text-ink-soft [&>p]:text-base [&>p]:leading-8">
            <Prompt text={item.aAr} glossary={glossary} introduce={new Set()} />
          </div>
        </details>
      ))}
    </section>
  );
}

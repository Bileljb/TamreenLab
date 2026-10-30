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
      <h2 id="faq-title" className="text-xl font-bold">
        {title}
      </h2>
      {items.map((item, i) => (
        <details key={i} className="rounded-lg border border-slate-200 bg-white p-4" open={i === 0}>
          <summary className="cursor-pointer font-semibold">
            <span className="inline [&>p]:inline [&>p]:text-base">
              <Prompt text={item.qAr} glossary={glossary} introduce={new Set()} />
            </span>
          </summary>
          <div className="mt-2 text-slate-700 [&>p]:text-base [&>p]:leading-8">
            <Prompt text={item.aAr} glossary={glossary} introduce={new Set()} />
          </div>
        </details>
      ))}
    </section>
  );
}

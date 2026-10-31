import type { ReactNode } from 'react';

/** The header band of an index or static page: title, intro and optional extras. */
export function PageHero({
  title,
  intro,
  eyebrow,
  children,
}: {
  title: ReactNode;
  intro?: ReactNode;
  eyebrow?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden border-b border-line">
      <div aria-hidden className="sheet-pattern absolute inset-0 -z-10 opacity-60" />
      <div aria-hidden className="brand-gradient absolute -top-32 end-0 -z-10 size-96 rounded-full opacity-15 blur-3xl" />
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-12 sm:py-16">
        {eyebrow ? <div className="text-sm font-semibold text-brand-strong">{eyebrow}</div> : null}
        <h1 className="text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">{title}</h1>
        {intro ? <p className="max-w-2xl text-lg leading-8 text-muted">{intro}</p> : null}
        {children}
      </div>
    </section>
  );
}

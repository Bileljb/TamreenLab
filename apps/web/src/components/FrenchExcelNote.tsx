import { FRENCH_EXCEL_NAMES, type LessonFile } from '@tamreen/shared';

/** Functions used by a lesson's formula answers, in order of first use. */
export function functionsInFormulas(lesson: LessonFile): string[] {
  const names = lesson.steps.flatMap((s) =>
    s.type === 'ENTER_FORMULA' ? [...s.check.solution.matchAll(/([A-Z][A-Z0-9.]*)\(/g)].map((m) => m[1]!) : [],
  );
  return [...new Set(names)];
}

/**
 * French pages only: TamreenLab uses Excel's English function names and commas, so French
 * learners see the names their French Excel uses (ADR 009). Names that are the same are skipped.
 */
export function FrenchExcelNote({ names, text }: { names: string[]; text: string }) {
  const pairs = names
    .map((n) => [n, FRENCH_EXCEL_NAMES[n]] as const)
    .filter((p): p is readonly [string, string] => !!p[1] && p[1] !== p[0]);
  return (
    <aside
      lang="fr"
      className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-info/30 bg-info-soft p-5 text-info"
      data-french-note=""
    >
      <p className="flex gap-2 font-medium">
        <svg viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8h.01M11 12h1v5h1" />
        </svg>
        {text}
      </p>
      {pairs.length ? (
        <ul className="flex flex-wrap gap-2" dir="ltr">
          {pairs.map(([en, fr]) => (
            <li key={en} className="rounded-full bg-raised px-3 py-1 font-mono text-sm text-ink shadow-soft">
              {en} <span className="text-faint">=</span> {fr}
            </li>
          ))}
        </ul>
      ) : null}
    </aside>
  );
}

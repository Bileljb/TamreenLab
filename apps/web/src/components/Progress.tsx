'use client';

import { useEffect, useState } from 'react';
import { api, loadGuestProgress, useSession } from '@tamreen/ui';

/** Per lesson: how many steps are done and whether the lesson is complete. */
type Progress = Map<string, { stepsDone: number; completed: boolean }>;

let cached: { key: string; promise: Promise<Progress> } | null = null;

/** From the account when signed in, else from this browser; one request per page. */
function fetchProgress(signedIn: boolean): Promise<Progress> {
  const key = signedIn ? 'user' : 'guest';
  if (cached?.key === key) return cached.promise;
  const promise = signedIn
    ? api
        .progress()
        .then(
          (rows) =>
            new Map(
              rows.map((r) => [
                r.lessonSlug,
                { stepsDone: r.stepsDone.length, completed: r.completedAt !== null },
              ]),
            ),
        )
        .catch(() => new Map())
    : Promise.resolve(
        new Map(
          Object.entries(loadGuestProgress().lessons).map(([slug, p]) => [
            slug,
            { stepsDone: p.stepsDone.length, completed: Boolean(p.completedAt) },
          ]),
        ),
      );
  cached = { key, promise };
  return promise;
}

function useProgress(): Progress | null {
  const session = useSession();
  const [progress, setProgress] = useState<Progress | null>(null);
  useEffect(() => {
    if (session.status === 'loading') return;
    let live = true;
    void fetchProgress(session.status === 'user').then((p) => live && setProgress(p));
    return () => {
      live = false;
    };
  }, [session.status]);
  return progress;
}

/** A ring that fills with the share of completed lessons in a track. */
export function ProgressRing({ slugs, label }: { slugs: string[]; label: string }) {
  const progress = useProgress();
  const done = progress ? slugs.filter((s) => progress.get(s)?.completed).length : 0;
  const share = slugs.length ? done / slugs.length : 0;
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <span
      className="relative grid size-12 shrink-0 place-items-center"
      role="img"
      aria-label={label.replace('{done}', String(done)).replace('{total}', String(slugs.length))}
    >
      <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="22" cy="22" r={r} fill="none" strokeWidth="4" className="stroke-line" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          className="stroke-brand transition-[stroke-dashoffset] duration-700 ease-out"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - share)}
        />
      </svg>
      <span className="text-[11px] font-bold tabular-nums text-ink-soft" dir="ltr">
        {done}/{slugs.length}
      </span>
    </span>
  );
}

/** A small badge on a lesson card: done, in progress, or nothing yet. */
export function LessonStatus({
  slug,
  steps,
  labels,
}: {
  slug: string;
  steps: number;
  labels: { done: string; inProgress: string };
}) {
  const p = useProgress()?.get(slug);
  if (!p || p.stepsDone === 0) return null;
  if (p.completed) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-good-soft px-2 py-0.5 text-xs font-semibold text-good">
        <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="m3 8.5 3 3 7-7" />
        </svg>
        {labels.done}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">
      {labels.inProgress}
      <span dir="ltr" className="tabular-nums">
        {p.stepsDone}/{steps}
      </span>
    </span>
  );
}

type LessonLink = { slug: string; title: string; href: string };

/** "Continue where you left off": the first unfinished lesson that was started, else the next one. */
export function ContinueBanner({
  lessons,
  labels,
}: {
  lessons: LessonLink[];
  labels: { title: string; cta: string };
}) {
  const progress = useProgress();
  if (!progress || progress.size === 0) return null;
  const started = lessons.find((l) => {
    const p = progress.get(l.slug);
    return p && p.stepsDone > 0 && !p.completed;
  });
  const lastDone = lessons.findLastIndex((l) => progress.get(l.slug)?.completed);
  const next = started ?? lessons[lastDone + 1];
  if (!next) return null;
  return (
    <a
      href={next.href}
      className="group flex animate-fade-up items-center justify-between gap-4 rounded-[var(--radius-card)] border border-brand/30 bg-brand-soft p-4 transition hover:shadow-glow"
    >
      <span className="flex flex-col">
        <span className="text-xs font-semibold uppercase tracking-wide text-brand-strong">{labels.title}</span>
        <span className="font-semibold text-ink">{next.title}</span>
      </span>
      <span className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-ink transition group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5">
        {labels.cta}
      </span>
    </a>
  );
}

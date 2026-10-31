import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { LessonFile, Locale } from '@tamreen/shared';
import { LeaderboardPanel, Prompt, StatsPanel, firstUses } from '@tamreen/ui';
import { Ad } from '@/components/Ad';
import { FrenchExcelNote, functionsInFormulas } from '@/components/FrenchExcelNote';
import { JsonLd } from '@/components/JsonLd';
import { LessonIsland } from '@/components/LessonIsland';
import { Faq, RichText } from '@/components/RichText';
import { TrackIcon } from '@/components/TrackIcon';
import {
  functionHref,
  functionsForLesson,
  getGlossary,
  getLesson,
  lessonHref,
  listLessons,
  listTracks,
} from '@/lib/content';
import { absoluteUrl, breadcrumbJsonLd, faqJsonLd, pageMetadata, plainText } from '@/lib/seo';

type Params = { locale: string; track: string; slug: string };
type Props = { params: Promise<Params> };

export const dynamicParams = false;

export async function generateStaticParams() {
  const lessons = await listLessons('ar');
  return lessons.map((l) => ({ track: l.track, slug: l.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, track, slug } = await params;
  const found = await getLesson(locale as Locale, track, slug);
  if (!found) return {};
  return pageMetadata({
    path: lessonHref(locale, found.lesson),
    title: found.lesson.titleAr,
    description: found.lesson.summaryAr,
    ogType: 'article',
  });
}

const ROW_PX = 36;
const CHROME_PX = 420;

/** The tallest step of the lesson, so the reserved space fits every step (no layout shift). */
function playerHeight(lesson: LessonFile): number {
  const heights = lesson.steps.map((step) => {
    if (!step.sheet) return 480;
    const [a, b] = step.sheet.visible.split(':');
    const rows = Math.abs(Number(b!.replace(/\D/g, '')) - Number(a!.replace(/\D/g, ''))) + 2;
    return CHROME_PX + rows * ROW_PX;
  });
  return Math.max(...heights);
}

export default async function LessonPage({ params }: Props) {
  const { locale, track, slug } = await params;
  setRequestLocale(locale);
  const [found, glossary, tracks, t, tp, tc, home] = await Promise.all([
    getLesson(locale as Locale, track, slug),
    getGlossary(),
    listTracks(locale as Locale),
    getTranslations('lesson'),
    getTranslations('player'),
    getTranslations('curriculum'),
    getTranslations('home'),
  ]);
  if (!found) notFound();
  const { lesson, next } = found;
  const related = await functionsForLesson(locale as Locale, lesson.slug);
  const trackTitle = tracks.find((tr) => tr.slug === lesson.track)?.titleAr ?? '';
  const path = lessonHref(locale, lesson);
  // Glossary terms in the intro get their English name there, before the steps use them.
  const introTerms = firstUses([lesson.introAr ?? ''])[0]!;
  const progress = tp('progress', { current: 1, total: lesson.steps.length });
  const firstPrompt = lesson.steps[0]!.promptAr;

  return (
    <main className="flex flex-col">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'LearningResource',
          name: plainText(lesson.titleAr),
          description: plainText(lesson.summaryAr),
          url: absoluteUrl(path),
          inLanguage: locale,
          learningResourceType: 'interactive exercise',
          educationalLevel: 'beginner',
          isAccessibleForFree: true,
          timeRequired: `PT${lesson.minutes}M`,
          teaches: related.map((f) => f.name),
        }}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: t('home'), path: `/${locale}` },
          { name: t('lessons'), path: `/${locale}/lessons` },
          { name: plainText(lesson.titleAr), path },
        ])}
      />
      {lesson.faq?.length ? <JsonLd data={faqJsonLd(lesson.faq)} /> : null}

      <section className="relative isolate overflow-hidden border-b border-line">
        <div aria-hidden className="sheet-pattern absolute inset-0 -z-10 opacity-60" />
        <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-10">
          <nav aria-label={t('breadcrumb')} className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
            <a href={`/${locale}`} className="hover:text-ink">
              {t('home')}
            </a>
            <span aria-hidden className="rtl:-scale-x-100">›</span>
            <a href={`/${locale}/lessons`} className="hover:text-ink">
              {t('lessons')}
            </a>
            <span aria-hidden className="rtl:-scale-x-100">›</span>
            <span aria-current="page" className="text-ink-soft">
              {lesson.titleAr}
            </span>
          </nav>
          <div className="flex items-start gap-4">
            <TrackIcon track={lesson.track} size="lg" />
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-brand-strong">{trackTitle}</span>
              <h1 className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">{lesson.titleAr}</h1>
            </div>
          </div>
          <p className="max-w-3xl text-lg leading-8 text-muted">{lesson.summaryAr}</p>
          <div className="flex flex-wrap gap-2 text-xs font-semibold text-ink-soft">
            <span className="rounded-full border border-line bg-raised px-3 py-1">{tc(`kind.${lesson.kind}`)}</span>
            <span className="rounded-full border border-line bg-raised px-3 py-1">{home('minutes', { minutes: lesson.minutes })}</span>
            <span className="rounded-full border border-line bg-raised px-3 py-1">{tc('stepCount', { count: lesson.steps.length })}</span>
          </div>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-10">
        {lesson.introAr ? (
          <section
            aria-labelledby="explanation"
            className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-raised p-6 shadow-soft"
          >
            <h2 id="explanation" className="flex items-center gap-2 text-xl font-bold">
              <span aria-hidden className="grid size-8 place-items-center rounded-lg bg-info-soft text-info">
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z" />
                </svg>
              </span>
              {t('explanationTitle')}
            </h2>
            <RichText text={lesson.introAr} glossary={glossary} introduce={introTerms} />
          </section>
        ) : null}

        {locale === 'fr' ? (
          <FrenchExcelNote names={functionsInFormulas(lesson)} text={t.raw('frenchExcelNote') as string} />
        ) : null}

        <section aria-labelledby="practice" className="flex flex-col gap-4" data-player-area="">
          <h2 id="practice" className="flex items-center gap-2 text-xl font-bold">
            <span aria-hidden className="grid size-8 place-items-center rounded-lg bg-brand-soft text-brand-strong">
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16v16H4zM4 10h16M10 4v16" />
              </svg>
            </span>
            {t('practiceTitle')}
          </h2>
          <LessonIsland
            minHeight={playerHeight(lesson)}
            lesson={lesson}
            glossary={glossary}
            lessonsHref={`/${locale}/lessons`}
            nextLessonHref={next ? lessonHref(locale, next) : undefined}
            preview={
              // The player's header and first prompt, painted with the page while the grid loads.
              <>
                <div className="flex flex-col gap-3">
                  <div className="text-sm font-medium text-muted">{progress}</div>
                  <div className="flex gap-1.5">
                    {lesson.steps.map((s) => (
                      <span key={s.slug} className="h-2 flex-1 rounded-full bg-line" />
                    ))}
                  </div>
                </div>
                <Prompt
                  text={firstPrompt}
                  glossary={glossary}
                  introduce={firstUses([firstPrompt])[0]!}
                />
              </>
            }
          />
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <StatsPanel loginHref={`/${locale}/login?next=${encodeURIComponent(path)}`} />
          <LeaderboardPanel />
        </div>

        {lesson.faq?.length ? (
          <Faq items={lesson.faq} title={t('faqTitle')} glossary={glossary} />
        ) : null}

        <Ad name="lesson-after-faq" />

        {related.length ? (
          <section aria-labelledby="related" className="flex flex-col gap-3">
            <h2 id="related" className="text-lg font-bold">
              {t('relatedFunctions')}
            </h2>
            <ul className="flex flex-wrap gap-2" dir="ltr">
              {related.map((f) => (
                <li key={f.slug}>
                  <a
                    href={functionHref(locale, f)}
                    className="inline-block rounded-full border border-line bg-raised px-3.5 py-1.5 font-mono text-sm font-semibold text-ink-soft shadow-soft transition hover:-translate-y-0.5 hover:border-brand hover:text-brand-strong"
                  >
                    {f.name}()
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {next ? (
          <a
            href={lessonHref(locale, next)}
            className="group flex items-center justify-between gap-4 rounded-[var(--radius-card)] border border-line bg-raised p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-lift"
          >
            <span className="font-semibold text-brand-strong">
              {t('nextLesson', { title: plainText(next.titleAr) })}
            </span>
            <svg viewBox="0 0 20 20" className="size-5 shrink-0 text-brand transition group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="M4 10h12m-5-5 5 5-5 5" />
            </svg>
          </a>
        ) : null}
      </div>
    </main>
  );
}

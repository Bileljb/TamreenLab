import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { LessonFile } from '@tamreen/shared';
import { LeaderboardPanel, StatsPanel, firstUses } from '@tamreen/ui';
import { Ad } from '@/components/Ad';
import { JsonLd } from '@/components/JsonLd';
import { LessonIsland } from '@/components/LessonIsland';
import { Faq, RichText } from '@/components/RichText';
import {
  functionHref,
  functionsForLesson,
  getGlossary,
  getLesson,
  lessonHref,
  listLessons,
} from '@/lib/content';
import { absoluteUrl, breadcrumbJsonLd, faqJsonLd, pageMetadata, plainText } from '@/lib/seo';

type Params = { locale: string; track: string; slug: string };
type Props = { params: Promise<Params> };

export const dynamicParams = false;

export async function generateStaticParams() {
  const lessons = await listLessons();
  return lessons.map((l) => ({ track: l.track, slug: l.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, track, slug } = await params;
  const found = await getLesson(track, slug);
  if (!found) return {};
  return pageMetadata({
    path: lessonHref(locale, found.lesson),
    title: found.lesson.titleAr,
    description: found.lesson.summaryAr,
    ogType: 'article',
  });
}

const ROW_PX = 36;
const CHROME_PX = 360;

/** The tallest step of the lesson, so the reserved space fits every step. */
function playerHeight(lesson: LessonFile): number {
  const heights = lesson.steps.map((step) => {
    if (!step.sheet) return 420;
    const [a, b] = step.sheet.visible.split(':');
    const rows = Math.abs(Number(b!.replace(/\D/g, '')) - Number(a!.replace(/\D/g, ''))) + 2;
    return CHROME_PX + rows * ROW_PX;
  });
  return Math.max(...heights);
}

export default async function LessonPage({ params }: Props) {
  const { locale, track, slug } = await params;
  setRequestLocale(locale);
  const [found, glossary, t] = await Promise.all([
    getLesson(track, slug),
    getGlossary(),
    getTranslations('lesson'),
  ]);
  if (!found) notFound();
  const { lesson, next } = found;
  const related = await functionsForLesson(lesson.slug);
  const path = lessonHref(locale, lesson);
  // Glossary terms in the intro get their English name there, before the steps use them.
  const introTerms = firstUses([lesson.introAr ?? ''])[0]!;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'LearningResource',
          name: lesson.titleAr,
          description: lesson.summaryAr,
          url: absoluteUrl(path),
          inLanguage: 'ar',
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
          { name: lesson.titleAr, path },
        ])}
      />
      {lesson.faq?.length ? <JsonLd data={faqJsonLd(lesson.faq)} /> : null}

      <div className="flex flex-col gap-3">
        <nav aria-label={t('breadcrumb')} className="text-sm text-slate-500">
          <a href={`/${locale}`} className="underline-offset-4 hover:underline">
            {t('home')}
          </a>
          <span aria-hidden className="mx-2">
            ‹
          </span>
          <a href={`/${locale}/lessons`} className="underline-offset-4 hover:underline">
            {t('lessons')}
          </a>
          <span aria-hidden className="mx-2">
            ‹
          </span>
          <span aria-current="page">{lesson.titleAr}</span>
        </nav>
        <h1 className="text-2xl font-bold sm:text-3xl">{lesson.titleAr}</h1>
        <p className="text-lg text-slate-600">{lesson.summaryAr}</p>
      </div>

      {lesson.introAr ? (
        <section aria-labelledby="explanation" className="flex flex-col gap-3">
          <h2 id="explanation" className="text-xl font-bold">
            {t('explanationTitle')}
          </h2>
          <RichText text={lesson.introAr} glossary={glossary} introduce={introTerms} />
        </section>
      ) : null}

      <section aria-labelledby="practice" className="flex flex-col gap-3" data-player-area="">
        <h2 id="practice" className="text-xl font-bold">
          {t('practiceTitle')}
        </h2>
        <LessonIsland
          minHeight={playerHeight(lesson)}
          lesson={lesson}
          glossary={glossary}
          lessonsHref={`/${locale}/lessons`}
          nextLessonHref={next ? lessonHref(locale, next) : undefined}
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
        <section aria-labelledby="related" className="flex flex-col gap-2">
          <h2 id="related" className="text-lg font-bold">
            {t('relatedFunctions')}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {related.map((f) => (
              <li key={f.slug}>
                <a
                  href={functionHref(locale, f)}
                  className="inline-block rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono text-sm hover:border-emerald-600"
                  dir="ltr"
                >
                  {f.name}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {next ? (
        <a
          href={lessonHref(locale, next)}
          className="font-medium text-emerald-800 underline underline-offset-4"
        >
          {t('nextLesson', { title: plainText(next.titleAr) })}
        </a>
      ) : null}
    </main>
  );
}

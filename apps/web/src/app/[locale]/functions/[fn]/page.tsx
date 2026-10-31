import type { Locale } from '@tamreen/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { indexToColumn, parseAddress } from '@tamreen/engine';
import type { SheetSpec } from '@tamreen/shared';
import { Formula, Prompt, formatValue } from '@tamreen/ui';
import { Ad } from '@/components/Ad';
import { CopyButton } from '@/components/CopyButton';
import { FrenchExcelNote } from '@/components/FrenchExcelNote';
import { PageHero } from '@/components/PageHero';
import { JsonLd } from '@/components/JsonLd';
import { Faq, RichText } from '@/components/RichText';
import {
  functionHref,
  getFunction,
  getGlossary,
  lessonHref,
  listFunctions,
  listLessons,
} from '@/lib/content';
import { absoluteUrl, breadcrumbJsonLd, faqJsonLd, pageMetadata } from '@/lib/seo';

type Props = { params: Promise<{ locale: string; fn: string }> };

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await listFunctions('ar')).map((f) => ({ fn: f.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, fn } = await params;
  const page = await getFunction(locale as Locale, fn);
  if (!page) return {};
  return pageMetadata({
    path: functionHref(locale, page),
    title: page.titleAr,
    description: page.summaryAr,
    ogType: 'article',
  });
}

/** A small read-only view of an example's data, left to right like the grid. */
function SheetTable({ sheet }: { sheet: SheetSpec }) {
  const [a, b] = sheet.visible.split(':').map((ref) => parseAddress(ref));
  const rows = Array.from({ length: b!.row - a!.row + 1 }, (_, i) => a!.row + i);
  const cols = Array.from({ length: b!.col - a!.col + 1 }, (_, i) => a!.col + i);
  return (
    <div dir="ltr" className="max-w-full overflow-x-auto rounded-xl border border-line">
      <table className="border-collapse text-sm">
        <thead>
          <tr>
            <th className="w-8 border border-line bg-sunken" aria-hidden />
            {cols.map((c) => (
              <th
                key={c}
                scope="col"
                className="min-w-16 border border-line bg-sunken px-2 font-medium text-muted"
              >
                {indexToColumn(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r}>
              <th
                scope="row"
                className="border border-line bg-sunken px-2 font-medium text-muted"
              >
                {r + 1}
              </th>
              {cols.map((c) => {
                const value = sheet.cells[`${indexToColumn(c)}${r + 1}`];
                const text = value === undefined ? '' : formatValue(value);
                return (
                  <td key={c} className="border border-line px-2 py-1">
                    <span dir="auto" className="block">
                      {text}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function FunctionPage({ params }: Props) {
  const { locale, fn } = await params;
  setRequestLocale(locale);
  const [page, glossary, lessons, t, tl] = await Promise.all([
    getFunction(locale as Locale, fn),
    getGlossary(),
    listLessons(locale as Locale),
    getTranslations('functions'),
    getTranslations('lesson'),
  ]);
  if (!page) notFound();
  const path = functionHref(locale, page);
  const practice = page.lessons
    .map((slug) => lessons.find((l) => l.slug === slug))
    .filter((l) => l !== undefined);
  const noPrompt = new Set<string>();
  const section = 'flex flex-col gap-4';
  const heading = 'text-xl font-bold';
  const arrow = 'size-4 shrink-0 text-brand transition group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1';

  return (
    <main className="flex flex-col">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'TechArticle',
          headline: page.titleAr,
          description: page.summaryAr,
          url: absoluteUrl(path),
          inLanguage: locale,
          about: `Excel ${page.name} function`,
        }}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: tl('home'), path: `/${locale}` },
          { name: t('title'), path: `/${locale}/functions` },
          { name: page.name, path },
        ])}
      />
      <JsonLd data={faqJsonLd(page.faq)} />

      <PageHero
        eyebrow={
          <nav aria-label={tl('breadcrumb')} className="flex flex-wrap items-center gap-1.5 font-normal text-muted">
            <a href={`/${locale}`} className="hover:text-ink">
              {tl('home')}
            </a>
            <span aria-hidden className="rtl:-scale-x-100">›</span>
            <a href={`/${locale}/functions`} className="hover:text-ink">
              {t('title')}
            </a>
            <span aria-hidden className="rtl:-scale-x-100">›</span>
            <span aria-current="page" dir="ltr" className="font-mono text-ink-soft">
              {page.name}
            </span>
          </nav>
        }
        title={page.titleAr}
        intro={page.summaryAr}
      />

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-10">
        <div className="rounded-[var(--radius-card)] border border-line bg-raised p-6 shadow-soft">
          <RichText text={page.introAr} glossary={glossary} />
        </div>

        {locale === 'fr' ? (
          <FrenchExcelNote names={[page.name]} text={tl.raw('frenchExcelNote') as string} />
        ) : null}

        <section aria-labelledby="syntax" className={section}>
          <h2 id="syntax" className={heading}>
            {t('syntax')}
          </h2>
          <div className="overflow-hidden rounded-[var(--radius-card)] bg-[#0b1220] shadow-lift">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2">
              <span className="font-mono text-xs text-white/50">fx</span>
              <CopyButton text={`=${page.syntax}`} labels={{ copy: t('copy'), copied: t('copied') }} />
            </div>
            <Formula className="block overflow-x-auto px-5 py-4 font-mono text-lg text-emerald-200">
              {`=${page.syntax}`}
            </Formula>
          </div>
          <h3 className="mt-2 font-semibold">{t('args')}</h3>
          <dl className="grid gap-3 sm:grid-cols-2">
            {page.args.map((arg, i) => (
              <div key={arg.name} className="flex flex-col gap-1 rounded-2xl border border-line bg-raised p-4 shadow-soft">
                  <dt className="flex items-center gap-2 font-mono text-sm font-bold">
                    <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-lg bg-accent-soft font-sans text-xs font-bold text-accent">
                      {i + 1}
                    </span>
                    <bdi dir="ltr">{arg.name}</bdi>
                    {arg.optional ? (
                      <span className="ms-2 rounded-full bg-sunken px-2 py-0.5 font-sans text-xs font-medium text-muted">
                        {t('optional')}
                      </span>
                    ) : null}
                  </dt>
                  <dd className="text-ink-soft [&>p]:text-base [&>p]:leading-7">
                    <Prompt text={arg.descAr} glossary={glossary} introduce={noPrompt} />
                  </dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="examples" className={section}>
          <h2 id="examples" className={heading}>
            {t('examples')}
          </h2>
          {page.examples.map((example, i) => (
            <figure
              key={i}
              className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-raised p-5 shadow-soft"
            >
              {example.sheet ? <SheetTable sheet={example.sheet} /> : null}
              <div className="flex flex-wrap items-center gap-3 text-sm" dir="ltr">
                <Formula className="rounded-lg bg-sunken px-3 py-1.5 font-mono font-semibold">{example.formula}</Formula>
                <svg viewBox="0 0 20 20" className="size-4 text-faint" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M4 10h12m-5-5 5 5-5 5" />
                </svg>
                <bdi className="rounded-lg bg-brand-soft px-3 py-1.5 font-bold text-brand-strong">
                  {formatValue(example.result)}
                </bdi>
              </div>
              <figcaption className="text-ink-soft [&>p]:text-base [&>p]:leading-7">
                <Prompt text={example.explainAr} glossary={glossary} introduce={noPrompt} />
                {example.verified ? null : <span className="text-sm text-muted">{t('unverified')}</span>}
              </figcaption>
            </figure>
          ))}
        </section>

        {page.errors.length ? (
          <section aria-labelledby="errors" className={section}>
            <h2 id="errors" className={heading}>
              {t('errors')}
            </h2>
            <ul className="flex flex-col gap-3">
              {page.errors.map((e) => (
                <li key={e.code} className="flex flex-wrap items-baseline gap-3 rounded-2xl border border-bad/20 bg-bad-soft/50 p-4">
                  <Formula className="rounded-lg bg-bad-soft px-2 py-0.5 font-mono font-bold text-bad">{e.code}</Formula>
                  <span className="flex-1 text-ink-soft [&>p]:inline [&>p]:text-base">
                    <Prompt text={e.causeAr} glossary={glossary} introduce={noPrompt} />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section
          aria-labelledby="practice"
          className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-brand/30 bg-brand-soft p-6"
        >
          <h2 id="practice" className={heading}>
            {t('practice')}
          </h2>
          {practice.length ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {practice.map((l) => (
                <li key={l.slug}>
                  <a
                    href={lessonHref(locale, l)}
                    className="group flex h-full items-center justify-between gap-3 rounded-2xl bg-raised p-4 font-semibold text-ink shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
                  >
                    {l.titleAr}
                    <svg viewBox="0 0 20 20" className={arrow} fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                      <path d="M4 10h12m-5-5 5 5-5 5" />
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-soft">
              {t('practiceSoon')}{' '}
              <a href={`/${locale}/lessons`} className="font-semibold text-brand-strong underline underline-offset-4">
                {tl('lessons')}
              </a>
            </p>
          )}
        </section>

        <Ad name="function-after-practice" />

        <Faq items={page.faq} title={t('faqTitle')} glossary={glossary} />
      </div>
    </main>
  );
}

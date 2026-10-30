import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { indexToColumn, parseAddress } from '@tamreen/engine';
import type { SheetSpec } from '@tamreen/shared';
import { Formula, Prompt, formatValue } from '@tamreen/ui';
import { Ad } from '@/components/Ad';
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
  return (await listFunctions()).map((f) => ({ fn: f.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, fn } = await params;
  const page = await getFunction(fn);
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
    <div dir="ltr" className="max-w-full overflow-x-auto">
      <table className="border-collapse text-sm">
        <thead>
          <tr>
            <th className="w-8 border border-slate-200 bg-slate-100" aria-hidden />
            {cols.map((c) => (
              <th
                key={c}
                scope="col"
                className="min-w-16 border border-slate-200 bg-slate-100 px-2 font-medium text-slate-600"
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
                className="border border-slate-200 bg-slate-100 px-2 font-medium text-slate-600"
              >
                {r + 1}
              </th>
              {cols.map((c) => {
                const value = sheet.cells[`${indexToColumn(c)}${r + 1}`];
                const text = value === undefined ? '' : formatValue(value);
                return (
                  <td key={c} className="border border-slate-200 px-2 py-1">
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
    getFunction(fn),
    getGlossary(),
    listLessons(),
    getTranslations('functions'),
    getTranslations('lesson'),
  ]);
  if (!page) notFound();
  const path = functionHref(locale, page);
  const practice = page.lessons
    .map((slug) => lessons.find((l) => l.slug === slug))
    .filter((l) => l !== undefined);
  const noPrompt = new Set<string>();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'TechArticle',
          headline: page.titleAr,
          description: page.summaryAr,
          url: absoluteUrl(path),
          inLanguage: 'ar',
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

      <div className="flex flex-col gap-3">
        <nav aria-label={tl('breadcrumb')} className="text-sm text-slate-500">
          <a href={`/${locale}`} className="underline-offset-4 hover:underline">
            {tl('home')}
          </a>
          <span aria-hidden className="mx-2">
            ‹
          </span>
          <a href={`/${locale}/functions`} className="underline-offset-4 hover:underline">
            {t('title')}
          </a>
          <span aria-hidden className="mx-2">
            ‹
          </span>
          <span aria-current="page" dir="ltr">
            {page.name}
          </span>
        </nav>
        <h1 className="text-2xl font-bold sm:text-3xl">{page.titleAr}</h1>
        <p className="text-lg text-slate-600">{page.summaryAr}</p>
      </div>

      <RichText text={page.introAr} glossary={glossary} />

      <section aria-labelledby="syntax" className="flex flex-col gap-3">
        <h2 id="syntax" className="text-xl font-bold">
          {t('syntax')}
        </h2>
        <Formula className="block rounded-lg bg-slate-900 px-4 py-3 font-mono text-emerald-100">
          {`=${page.syntax}`}
        </Formula>
        <h3 className="font-semibold">{t('args')}</h3>
        <dl className="flex flex-col gap-2">
          {page.args.map((arg) => (
            <div key={arg.name} className="rounded-lg border border-slate-200 bg-white p-3">
              <dt className="font-mono text-sm font-semibold">
                <bdi dir="ltr">{arg.name}</bdi>
                {arg.optional ? (
                  <span className="ms-2 font-sans text-xs text-slate-500">({t('optional')})</span>
                ) : null}
              </dt>
              <dd className="[&>p]:text-base [&>p]:leading-7">
                <Prompt text={arg.descAr} glossary={glossary} introduce={noPrompt} />
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="examples" className="flex flex-col gap-4">
        <h2 id="examples" className="text-xl font-bold">
          {t('examples')}
        </h2>
        {page.examples.map((example, i) => (
          <figure
            key={i}
            className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4"
          >
            {example.sheet ? <SheetTable sheet={example.sheet} /> : null}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
              <span>
                {t('formula')}:{' '}
                <Formula className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">
                  {example.formula}
                </Formula>
              </span>
              <span>
                {t('result')}: <bdi className="font-semibold">{formatValue(example.result)}</bdi>
              </span>
            </div>
            <figcaption className="[&>p]:text-base [&>p]:leading-7">
              <Prompt text={example.explainAr} glossary={glossary} introduce={noPrompt} />
              {example.verified ? null : (
                <span className="text-sm text-slate-500">{t('unverified')}</span>
              )}
            </figcaption>
          </figure>
        ))}
      </section>

      {page.errors.length ? (
        <section aria-labelledby="errors" className="flex flex-col gap-2">
          <h2 id="errors" className="text-xl font-bold">
            {t('errors')}
          </h2>
          <ul className="flex flex-col gap-2">
            {page.errors.map((e) => (
              <li key={e.code} className="flex flex-wrap items-baseline gap-2">
                <Formula className="rounded bg-rose-50 px-1.5 py-0.5 font-mono text-rose-800">
                  {e.code}
                </Formula>
                <span className="[&>p]:inline [&>p]:text-base">
                  <Prompt text={e.causeAr} glossary={glossary} introduce={noPrompt} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section
        aria-labelledby="practice"
        className="flex flex-col gap-2 rounded-xl bg-emerald-50 p-4"
      >
        <h2 id="practice" className="text-xl font-bold">
          {t('practice')}
        </h2>
        {practice.length ? (
          <ul className="flex flex-col gap-1">
            {practice.map((l) => (
              <li key={l.slug}>
                <a
                  href={lessonHref(locale, l)}
                  className="font-medium text-emerald-800 underline underline-offset-4"
                >
                  {l.titleAr}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-700">
            {t('practiceSoon')}{' '}
            <a
              href={`/${locale}/lessons`}
              className="font-medium text-emerald-800 underline underline-offset-4"
            >
              {tl('lessons')}
            </a>
          </p>
        )}
      </section>

      <Ad name="function-after-practice" />

      <Faq items={page.faq} title={t('faqTitle')} glossary={glossary} />
    </main>
  );
}

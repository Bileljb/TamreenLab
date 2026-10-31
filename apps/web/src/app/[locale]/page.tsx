import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Sheet } from '@tamreen/engine';
import type { Locale } from '@tamreen/shared';
import { HeroSheet } from '@/components/HeroSheet';
import { JsonLd } from '@/components/JsonLd';
import { ProgressRing } from '@/components/Progress';
import { TrackIcon } from '@/components/TrackIcon';
import { functionHref, lessonHref, listFunctions, listLessons, listTracks } from '@/lib/content';
import { SITE_NAME, SITE_URL, pageMetadata } from '@/lib/seo';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  return pageMetadata({ path: `/${locale}`, title: t('title'), description: t('description') });
}

const DEMO = '=SUM(B2:B4)';
const DEMO_ROWS = [140, 65, 90];
const FEATURE_ICONS = {
  practice: 'M4 4h16v16H4zM4 10h16M10 4v16',
  feedback: 'M5 13l4 4L19 7',
  arabic: 'M3 5h12M9 3v2m1.05 9.5A18 18 0 0 1 6.4 9M12.5 18h7M14 21l5-10 5 10',
  mobile: 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2',
} as const;

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, meta, lessons, tracks, functions] = await Promise.all([
    getTranslations('home'),
    getTranslations('meta'),
    listLessons(locale as Locale),
    listTracks(locale as Locale),
    listFunctions(locale as Locale),
  ]);
  const first = lessons[0]!;
  const steps = lessons.reduce((n, l) => n + l.steps.length, 0);
  const features = ['practice', 'feedback', 'arabic', 'mobile'] as const;
  const rows = DEMO_ROWS.map((qty, i) => ({ name: t(`demo.rows.${i}`), qty }));
  const demoCells = Object.fromEntries(rows.flatMap((r, i) => [[`B${i + 2}`, r.qty]]));
  const demoResult = String(new Sheet(demoCells).evaluate(DEMO));
  const cta =
    'inline-flex items-center gap-2 rounded-full px-6 py-3 font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

  return (
    <main className="flex flex-col gap-24 pb-8">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: SITE_NAME,
          url: `${SITE_URL}/${locale}`,
          inLanguage: locale,
          description: meta('description'),
        }}
      />

      <section className="relative isolate overflow-hidden">
        <div aria-hidden className="sheet-pattern absolute inset-0 -z-10 opacity-70" />
        <div aria-hidden className="brand-gradient absolute -top-40 start-1/2 -z-10 size-[36rem] -translate-x-1/2 rounded-full opacity-20 blur-3xl rtl:translate-x-1/2" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-12 pb-4 sm:pt-20 lg:grid-cols-[1.05fr_1fr]">
          <div className="flex flex-col items-start gap-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-raised/80 px-3 py-1 text-xs font-semibold text-ink-soft shadow-soft backdrop-blur">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-brand" />
              </span>
              {t('badge')}
            </span>
            <h1 className="text-4xl leading-tight font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              {t.rich('title', { hl: (chunks) => <span className="text-gradient">{chunks}</span> })}
            </h1>
            <p className="max-w-xl text-lg leading-8 text-muted">{t('tagline')}</p>
            <div className="flex flex-wrap gap-3">
              <a href={lessonHref(locale, first)} className={`${cta} bg-brand text-brand-ink shadow-glow hover:-translate-y-0.5 hover:bg-brand-strong`}>
                {t('start')}
                <svg viewBox="0 0 20 20" className="size-4 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                  <path d="M4 10h12m-5-5 5 5-5 5" />
                </svg>
              </a>
              <a href={`/${locale}/lessons`} className={`${cta} border border-line-strong bg-raised text-ink hover:-translate-y-0.5 hover:border-brand`}>
                {t('browse')}
              </a>
            </div>
            <dl className="mt-2 grid grid-cols-3 gap-6 text-sm">
              {[
                ['lessons', lessons.length],
                ['steps', steps],
                ['functions', functions.length],
              ].map(([key, count]) => (
                <div key={key} className="flex flex-col">
                  <dt className="order-2 text-muted">{t(`stats.${key}`, { count: Number(count) })}</dt>
                  <dd className="text-2xl font-extrabold tabular-nums text-ink">{count}</dd>
                </div>
              ))}
            </dl>
          </div>
          <HeroSheet
            labels={{
              title: t('demo.title'),
              hint: t('demo.hint'),
              item: t('demo.item'),
              qty: t('demo.qty'),
              total: t('demo.total'),
              tryThese: t('demo.tryThese'),
              formulaBar: t('demo.formulaBar'),
              error: t('demo.error'),
            }}
            rows={rows}
            demoFormula={DEMO}
            demoResult={demoResult}
            suggestions={['=AVERAGE(B2:B4)', '=MAX(B2:B4)', '=B2-B3']}
          />
        </div>
      </section>

      <section aria-labelledby="how" className="mx-auto w-full max-w-6xl px-4">
        <h2 id="how" data-reveal className="mb-10 text-center text-3xl font-extrabold tracking-tight">
          {t('how.title')}
        </h2>
        <ol className="grid gap-5 md:grid-cols-3">
          {(['read', 'practise', 'check'] as const).map((step, i) => (
            <li
              key={step}
              data-reveal={i}
              className="relative flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-raised p-6 shadow-soft"
            >
              <span className="brand-gradient grid size-10 place-items-center rounded-xl text-lg font-extrabold text-white shadow-glow">
                {i + 1}
              </span>
              <h3 className="text-lg font-bold">{t(`how.${step}.title`)}</h3>
              <p className="leading-7 text-muted">{t(`how.${step}.text`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="features" className="mx-auto w-full max-w-6xl px-4">
        <h2 id="features" data-reveal className="mb-10 text-center text-3xl font-extrabold tracking-tight">
          {t('featuresTitle')}
        </h2>
        <ul className="grid gap-5 sm:grid-cols-2">
          {features.map((f, i) => (
            <li
              key={f}
              data-reveal={i}
              className="group flex gap-4 rounded-[var(--radius-card)] border border-line bg-raised p-6 shadow-soft transition hover:-translate-y-1 hover:shadow-lift"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand-strong transition group-hover:scale-110">
                <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={FEATURE_ICONS[f]} />
                </svg>
              </span>
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-bold">{t(`features.${f}.title`)}</h3>
                <p className="leading-7 text-muted">{t(`features.${f}.text`)}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="tracks" className="mx-auto w-full max-w-6xl px-4">
        <div data-reveal className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <h2 id="tracks" className="text-3xl font-extrabold tracking-tight">
            {t('tracksTitle')}
          </h2>
          <a href={`/${locale}/lessons`} className="font-semibold text-brand-strong hover:underline">
            {t('browse')}
          </a>
        </div>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tracks.map((track, i) => {
            const inTrack = lessons.filter((l) => l.track === track.slug);
            if (inTrack.length === 0) return null;
            return (
              <li key={track.slug} data-reveal={i % 3}>
                <a
                  href={`/${locale}/lessons#${track.slug}`}
                  className="group flex h-full items-center gap-4 rounded-[var(--radius-card)] border border-line bg-raised p-5 shadow-soft transition hover:-translate-y-1 hover:border-brand/50 hover:shadow-lift"
                >
                  <TrackIcon track={track.slug} />
                  <span className="flex flex-1 flex-col">
                    <span className="font-bold">{track.titleAr}</span>
                    <span className="text-sm text-muted">{t('lessonCount', { count: inTrack.length })}</span>
                  </span>
                  <ProgressRing slugs={inTrack.map((l) => l.slug)} label={t.raw('trackProgress') as string} />
                </a>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4">
        <div data-reveal className="relative overflow-hidden rounded-[2rem] bg-[#0b1220] p-8 text-white shadow-lift sm:p-12">
          <div aria-hidden className="brand-gradient absolute -end-24 -top-24 size-80 rounded-full opacity-30 blur-3xl" />
          <div className="relative grid items-center gap-8 lg:grid-cols-2">
            <div className="flex flex-col gap-4">
              <h2 className="text-3xl font-extrabold tracking-tight">{t('functionsTitle')}</h2>
              <p className="leading-7 text-white/75">{t('functionsText')}</p>
              <a href={`/${locale}/functions`} className={`${cta} w-fit bg-white text-[#0b1220] hover:-translate-y-0.5`}>
                {t('functionsLink')}
              </a>
            </div>
            <ul className="flex flex-wrap gap-2" dir="ltr">
              {functions.map((f) => (
                <li key={f.slug}>
                  <a
                    href={functionHref(locale, f)}
                    className="inline-block rounded-full border border-white/15 bg-white/5 px-3 py-1.5 font-mono text-sm text-emerald-200 transition hover:-translate-y-0.5 hover:border-emerald-300/60 hover:bg-white/10"
                  >
                    {f.name}()
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section data-reveal className="mx-auto flex max-w-2xl flex-col items-center gap-5 px-4 text-center">
        <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t('cta.title')}</h2>
        <p className="text-lg text-muted">{t('cta.text')}</p>
        <a href={lessonHref(locale, first)} className={`${cta} bg-brand text-brand-ink shadow-glow hover:-translate-y-0.5 hover:bg-brand-strong`}>
          {t('start')}
        </a>
      </section>
    </main>
  );
}

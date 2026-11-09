import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ReviewSession } from '@tamreen/ui';
import { PageHero } from '@/components/PageHero';
import { getGlossary } from '@/lib/content';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages.review' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function ReviewPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('pages.review');
  const glossary = await getGlossary();
  return (
    <main className="flex flex-col">
      <PageHero title={t('title')} intro={t('intro')} />
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <ReviewSession
          locale={locale}
          glossary={glossary}
          lessonsHref={`/${locale}/lessons`}
          lessonsBase={`/${locale}/lessons`}
          loginHref={`/${locale}/login?next=${encodeURIComponent(`/${locale}/review`)}`}
        />
      </div>
    </main>
  );
}

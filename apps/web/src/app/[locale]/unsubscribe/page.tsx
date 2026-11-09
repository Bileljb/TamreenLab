import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { UnsubscribeConfirm } from '@tamreen/ui';
import { PageHero } from '@/components/PageHero';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages.unsubscribe' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

/** Opened from the link in a reminder email; the link's token does the work (ADR 011). */
export default async function UnsubscribePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('pages.unsubscribe');
  return (
    <main className="flex flex-col">
      <PageHero title={t('title')} />
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <UnsubscribeConfirm homeHref={`/${locale}`} />
      </div>
    </main>
  );
}

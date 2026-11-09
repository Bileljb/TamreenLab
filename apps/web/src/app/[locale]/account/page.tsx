import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AccountSettings } from '@tamreen/ui';
import { PageHero } from '@/components/PageHero';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages.account' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function AccountPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('pages.account');
  return (
    <main className="flex flex-col">
      <PageHero title={t('title')} intro={t('description')} />
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <AccountSettings
          loginHref={`/${locale}/login?next=${encodeURIComponent(`/${locale}/account`)}`}
        />
      </div>
    </main>
  );
}

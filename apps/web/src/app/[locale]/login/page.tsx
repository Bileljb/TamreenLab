import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthForm } from '@tamreen/ui';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('signInTitle'), robots: { index: false } };
}

export default async function LoginPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('auth');
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold">{t('signInTitle')}</h1>
      <AuthForm mode="signIn" fallbackNext={`/${locale}`} switchHref={`/${locale}/register`} />
    </main>
  );
}

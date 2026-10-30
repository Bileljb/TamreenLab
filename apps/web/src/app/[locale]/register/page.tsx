import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthForm } from '@tamreen/ui';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('signUpTitle'), robots: { index: false } };
}

export default async function RegisterPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('auth');
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">{t('signUpTitle')}</h1>
        <p className="text-slate-600">{t('signUpIntro')}</p>
      </div>
      <AuthForm mode="signUp" fallbackNext={`/${locale}`} switchHref={`/${locale}/login`} />
    </main>
  );
}

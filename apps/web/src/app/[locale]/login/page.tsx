import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthForm } from '@tamreen/ui';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('signInTitle'), robots: { index: false, follow: false } };
}

export default async function LoginPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('auth');
  return (
    <main className="relative isolate flex flex-1 items-start justify-center overflow-hidden px-4 py-14">
      <div aria-hidden className="sheet-pattern absolute inset-0 -z-10 opacity-60" />
      <div aria-hidden className="brand-gradient absolute top-0 start-1/2 -z-10 size-96 -translate-x-1/2 rounded-full opacity-20 blur-3xl rtl:translate-x-1/2" />
      <div className="flex w-full max-w-md animate-fade-up flex-col gap-6 rounded-[var(--radius-card)] border border-line bg-raised p-6 shadow-lift sm:p-8">
        <h1 className="text-3xl font-extrabold tracking-tight">{t('signInTitle')}</h1>
        <AuthForm mode="signIn" fallbackNext={`/${locale}`} switchHref={`/${locale}/register`} />
      </div>
    </main>
  );
}

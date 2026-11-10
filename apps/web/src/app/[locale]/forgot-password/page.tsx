import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ForgotPasswordForm } from '@tamreen/ui';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('forgotTitle'), robots: { index: false, follow: false } };
}

/** Forgotten password (ADR 013). */
export default async function ForgotPasswordPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('auth');
  return (
    <main className="relative isolate flex flex-1 items-start justify-center overflow-hidden px-4 py-14">
      <div aria-hidden className="sheet-pattern absolute inset-0 -z-10 opacity-60" />
      <div className="flex w-full max-w-md animate-fade-up flex-col gap-6 rounded-[var(--radius-card)] border border-line bg-raised p-6 shadow-lift sm:p-8">
        <h1 className="text-3xl font-extrabold tracking-tight">{t('forgotTitle')}</h1>
        <ForgotPasswordForm loginHref={`/${locale}/login`} />
      </div>
    </main>
  );
}

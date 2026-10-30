import type { Metadata } from 'next';
import { StaticPage, staticPageMetadata } from '@/components/StaticPage';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return staticPageMetadata((await params).locale, 'contact');
}

export default async function Page({ params }: Props) {
  return <StaticPage locale={(await params).locale} page="contact" />;
}

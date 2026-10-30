import { OG_SIZE, ogImage } from '@/lib/og';
import { getFunction } from '@/lib/content';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'Excel function';

export default async function Image({ params }: { params: Promise<{ fn: string }> }) {
  const fn = await getFunction((await params).fn);
  return ogImage(`=${fn?.syntax ?? 'SUM()'}`.slice(0, 40), `Excel ${fn?.name ?? ''} function`);
}

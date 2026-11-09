import { OG_SIZE, shareImage } from '@/lib/og';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'TamreenLab: lesson complete';

/** The share card (Phase 7): the stars from the link, drawn without any personal data. */
export default async function Image({ params }: { params: Promise<{ stars: string }> }) {
  const { stars } = await params;
  return shareImage(Math.min(3, Math.max(1, Number(stars) || 1)));
}

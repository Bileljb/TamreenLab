import { OG_SIZE, ogImage } from '@/lib/og';
import { getLesson } from '@/lib/content';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'Excel lesson';

/** The lesson's first formula solution, or its first function, as the image's headline. */
export default async function Image({
  params,
}: {
  params: Promise<{ track: string; slug: string }>;
}) {
  const { track, slug } = await params;
  const lesson = (await getLesson(track, slug))?.lesson;
  const formula = lesson?.steps.find((s) => s.type === 'ENTER_FORMULA');
  const text = formula && formula.type === 'ENTER_FORMULA' ? formula.check.solution : '=A1';
  return ogImage(text.slice(0, 40), `Lesson ${lesson?.order ?? ''}`);
}

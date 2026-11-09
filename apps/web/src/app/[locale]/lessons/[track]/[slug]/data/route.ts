import { LOCALES, type Locale } from '@tamreen/shared';
import { getLesson, listLessons } from '@/lib/content';

type Params = { locale: string; track: string; slug: string };

export const dynamicParams = false;

// A route handler does not inherit the layout's locale params, so it lists them itself.
export async function generateStaticParams() {
  const lessons = await listLessons('ar');
  return LOCALES.flatMap((locale) =>
    lessons.map((l) => ({ locale, track: l.track, slug: l.slug })),
  );
}

/**
 * A lesson in one language as JSON, for the "review mistakes" page, which mixes steps from
 * several lessons in the browser (ADR 011). Public content: the same text as the lesson page.
 */
export async function GET(_req: Request, { params }: { params: Promise<Params> }) {
  const { locale, track, slug } = await params;
  const found = await getLesson(locale as Locale, track, slug);
  if (!found) return new Response('Not found', { status: 404 });
  return Response.json(found.lesson, { headers: { 'X-Robots-Tag': 'noindex' } });
}

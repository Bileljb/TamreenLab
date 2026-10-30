import { z } from 'zod';
import { StepSpecSchema } from './step';

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Expected a kebab-case slug');

export const LESSON_KINDS = ['CONCEPT', 'PRACTICE', 'SUMMARY', 'CASE_STUDY'] as const;
export const PUBLISH_STATUSES = ['DRAFT', 'PUBLISHED'] as const;

/** A lesson file in `content/lessons/<track>/<slug>.json`. `content:lint` adds the rules zod cannot. */
export const LessonFileSchema = z
  .object({
    slug,
    track: slug,
    order: z.number().int().nonnegative(),
    kind: z.enum(LESSON_KINDS),
    /** PUBLISHED only after the native-Arabic review is logged in docs/CONTENT.md. */
    status: z.enum(PUBLISH_STATUSES).default('DRAFT'),
    titleAr: z.string().trim().min(1),
    summaryAr: z.string().trim().min(1),
    minutes: z.number().int().positive(),
    steps: z.array(StepSpecSchema).min(1),
  })
  .superRefine((lesson, ctx) => {
    const seen = new Set<string>();
    lesson.steps.forEach((step, i) => {
      if (seen.has(step.slug)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate step slug "${step.slug}"`,
          path: ['steps', i, 'slug'],
        });
      }
      seen.add(step.slug);
    });
  });

export type LessonFile = z.output<typeof LessonFileSchema>;
export type LessonFileInput = z.input<typeof LessonFileSchema>;

/** `content/glossary.json`: Arabic term -> English Excel term (PLAN §3.8). */
export const GlossarySchema = z.record(z.string().trim().min(1), z.string().trim().min(1));
export type Glossary = z.infer<typeof GlossarySchema>;

/** `content/tracks.json`: the tracks lessons belong to, in curriculum order. */
export const TracksFileSchema = z
  .array(z.object({ slug, titleAr: z.string().trim().min(1), order: z.number().int().nonnegative() }))
  .min(1);
export type TracksFile = z.infer<typeof TracksFileSchema>;

/** `content/style.json`: words to avoid in prompts, each with the glossary term to use instead. */
export const StyleFileSchema = z.object({
  avoid: z.record(z.string().trim().min(1), z.string().trim().min(1)),
});
export type StyleFile = z.infer<typeof StyleFileSchema>;

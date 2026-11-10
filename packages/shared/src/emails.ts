import { z } from 'zod';

const text = z.string().trim().min(1);
/** A line that must keep its `{placeholder}` in every language. */
const withVar = (name: string) =>
  text.refine((s) => s.includes(`{${name}}`), { message: `must contain {${name}}` });

/** `content/emails/<locale>.json`: the text of the emails, one file per language (ADR 011). */
export const EmailCopySchema = z
  .object({
    weekly: z
      .object({
        subject: text,
        greeting: withVar('name'),
        streak: withVar('days'),
        streakNone: text,
        reviews: withVar('count'),
        reviewsNone: text,
        next: withVar('lesson'),
        allDone: text,
        cta: text,
        why: text,
        unsubscribe: text,
      })
      .strict(),
    /** The forgotten-password email (ADR 013). */
    reset: z
      .object({
        subject: text,
        greeting: withVar('name'),
        body: withVar('minutes'),
        cta: text,
        ignore: text,
      })
      .strict(),
  })
  .strict();
export type EmailCopy = z.infer<typeof EmailCopySchema>;

/** Fills `{name}`-style placeholders. */
export function fillTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (all, key: string) =>
    key in values ? String(values[key]) : all,
  );
}

import { z } from 'zod';

/** Languages besides Arabic. Arabic is the source language of every content file (ADR 009). */
export const TRANSLATED_LOCALES = ['en', 'fr'] as const;
export type TranslatedLocale = (typeof TRANSLATED_LOCALES)[number];

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Expected a kebab-case slug');
const text = z.string().trim().min(1);

/**
 * Arabic text that appears in sheets and checks (cell labels, SUMIF criteria, expected text),
 * mapped to the translation. A cell equal to a key is replaced, and so is a quoted literal
 * `"key"` inside a formula, so the translated step stays solvable.
 */
export const TranslatedStringsSchema = z.record(z.string().min(1), z.string().min(1));

export const StepTranslationSchema = z
  .object({
    prompt: text,
    hint: text.optional(),
    explain: text.optional(),
    /** MULTIPLE_CHOICE only: the options, in the same order as the source. */
    options: z.array(text).optional(),
  })
  .strict();

/** `content/i18n/<locale>/lessons/<slug>.json`: the text of one lesson in one language. */
export const LessonTranslationSchema = z
  .object({
    slug,
    title: text,
    summary: text,
    intro: text.optional(),
    faq: z.array(z.object({ q: text, a: text }).strict()).optional(),
    strings: TranslatedStringsSchema.default({}),
    /** Keyed by step slug. */
    steps: z.record(slug, StepTranslationSchema),
  })
  .strict();
export type LessonTranslation = z.output<typeof LessonTranslationSchema>;

/** `content/i18n/<locale>/functions/<slug>.json`: a function page in one language. */
export const FunctionTranslationSchema = z
  .object({
    slug,
    title: text,
    summary: text.max(200),
    intro: text,
    /** The function's name in that language's Excel (French: SOMME), shown in a note. */
    localName: z.string().trim().min(1).optional(),
    /** In the source order: one per argument, example, error and FAQ entry. */
    args: z.array(text),
    examples: z.array(text),
    errors: z.array(text),
    faq: z.array(z.object({ q: text, a: text }).strict()),
    strings: TranslatedStringsSchema.default({}),
  })
  .strict();
export type FunctionTranslation = z.output<typeof FunctionTranslationSchema>;

/** `content/i18n/<locale>/tracks.json`: track titles by slug. */
export const TracksTranslationSchema = z.record(slug, text);
export type TracksTranslation = z.infer<typeof TracksTranslationSchema>;

/** Arabic script, to find text a translation left untranslated. */
export const ARABIC_SCRIPT = /\p{Script=Arabic}/u;

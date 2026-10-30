import { z } from 'zod';
import { FaqItemSchema } from './lesson';
import { CellInputSchema, SheetSpecSchema } from './step';

export const FUNCTION_CATEGORIES = [
  'aggregation',
  'logic',
  'conditional',
  'lookup',
  'text',
  'date',
] as const;

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Expected a kebab-case slug');

export const FunctionExampleSchema = z.object({
  /** The data the formula reads. Omit for formulas on literals. */
  sheet: SheetSpecSchema.optional(),
  formula: z.string().startsWith('='),
  result: CellInputSchema,
  explainAr: z.string().trim().min(1),
  /** false for functions the engine does not evaluate (TODAY); lint skips the check. */
  verified: z.boolean().default(true),
});

/** A function reference page: `content/functions/<slug>.json`. */
export const FunctionFileSchema = z.object({
  name: z.string().regex(/^[A-Z][A-Z0-9.]*$/, 'Function names are upper case, like SUMIF'),
  slug,
  category: z.enum(FUNCTION_CATEGORIES),
  order: z.number().int().nonnegative(),
  titleAr: z.string().trim().min(1),
  /** One or two sentences: the meta description and the index card text. */
  summaryAr: z.string().trim().min(1).max(200),
  introAr: z.string().trim().min(1),
  syntax: z.string().trim().min(1),
  args: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        descAr: z.string().trim().min(1),
        optional: z.boolean().default(false),
      }),
    )
    .min(1),
  examples: z.array(FunctionExampleSchema).min(1),
  errors: z.array(z.object({ code: z.string().trim().min(1), causeAr: z.string().trim().min(1) })),
  /** Lessons that practise this function (the "Practice this" link). */
  lessons: z.array(slug),
  faq: z.array(FaqItemSchema).min(1),
});
export type FunctionFile = z.output<typeof FunctionFileSchema>;
export type FunctionFileInput = z.input<typeof FunctionFileSchema>;

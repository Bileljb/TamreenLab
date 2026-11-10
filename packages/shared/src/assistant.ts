import { z } from 'zod';
import { SlugSchema } from './attempt';
import { CONTENT_LOCALES } from './i18n';
import { CellAddressSchema } from './step';

/** Longest formula the assistant explains; longer ones get the static hint (ADR 012). */
export const ASSISTANT_MAX_FORMULA = 300;

/**
 * `POST /assistant/hint`: explain a wrong formula. The API re-checks the formula itself, so the
 * feedback code is never taken from the client (ADR 012).
 */
export const AssistantHintRequestSchema = z
  .object({
    lessonSlug: SlugSchema,
    stepSlug: SlugSchema,
    answer: z.object({
      cell: CellAddressSchema,
      formula: z.string().min(1).max(ASSISTANT_MAX_FORMULA),
    }),
    locale: z.enum(CONTENT_LOCALES).default('ar'),
  })
  .strict();
export type AssistantHintRequest = z.input<typeof AssistantHintRequestSchema>;

/** Why the static hint is shown instead of an AI explanation. */
export const ASSISTANT_FALLBACK_REASONS = [
  'DISABLED',
  'QUOTA',
  'BUDGET',
  'UNAVAILABLE',
  'UNSAFE',
] as const;
export type AssistantFallbackReason = (typeof ASSISTANT_FALLBACK_REASONS)[number];

export const AssistantHintResponseSchema = z.discriminatedUnion('source', [
  z.object({ source: z.literal('ai'), id: z.string(), text: z.string() }),
  z.object({ source: z.literal('static'), reason: z.enum(ASSISTANT_FALLBACK_REASONS) }),
]);
export type AssistantHintResponse = z.infer<typeof AssistantHintResponseSchema>;

/** `POST /assistant/hints/:id/feedback`: was the explanation helpful? One vote per person. */
export const AssistantFeedbackRequestSchema = z.object({ helpful: z.boolean() }).strict();
export type AssistantFeedbackRequest = z.infer<typeof AssistantFeedbackRequestSchema>;

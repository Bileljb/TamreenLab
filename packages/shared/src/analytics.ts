import { z } from 'zod';
import { CONTENT_LOCALES } from './i18n';

/** Usage events (PLAN Phase 5). Anonymous: a random browser id and a per-tab session id, no user. */
export const ANALYTICS_EVENTS = [
  'lesson_start',
  'step_correct',
  'step_incorrect',
  'lesson_complete',
  'signup',
] as const;
export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

const id = z.string().regex(/^[A-Za-z0-9-]{8,64}$/);
const slug = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .max(80);

export const AnalyticsEventSchema = z
  .object({
    name: z.enum(ANALYTICS_EVENTS),
    anonId: id,
    sessionId: id,
    lessonSlug: slug.optional(),
    stepSlug: slug.optional(),
    locale: z.enum(CONTENT_LOCALES).optional(),
  })
  .strict();
export type AnalyticsEvent = z.infer<typeof AnalyticsEventSchema>;

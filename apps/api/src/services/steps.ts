import { StepSpecSchema, type ContentLocale, type StepSpec } from '@tamreen/shared';
import type { Step } from '../generated/prisma/client';
import type { Ctx } from '../context';
import { HttpError } from '../lib/errors';

/** Steps without a sheet are stored with `{}` (ADR 005). */
function sheetOf(json: unknown) {
  return json && typeof json === 'object' && 'visible' in json ? json : undefined;
}

/** The sheet and check stored for one translated language, if any (ADR 009). */
function translated(row: Step, locale: ContentLocale): { sheet?: unknown; check: unknown } | null {
  if (locale === 'ar') return null;
  const all = row.localesJson as Record<string, { sheet?: unknown; check: unknown }> | null;
  return all?.[locale] ?? null;
}

/**
 * The step as authored, rebuilt from its row and validated again before any check runs. In
 * another language the sheet and check are that language's (translated cell text and criteria);
 * a step without that translation falls back to Arabic.
 */
export function stepFromRow(row: Step, locale: ContentLocale = 'ar'): StepSpec {
  const local = translated(row, locale);
  return StepSpecSchema.parse({
    slug: row.slug,
    type: row.type,
    promptAr: row.promptAr,
    sheet: sheetOf(local ? local.sheet : row.sheetJson),
    check: local ? local.check : row.checkJson,
    hintAr: row.hintAr ?? undefined,
    explainAr: row.explainAr ?? undefined,
    basePoints: row.basePoints,
  });
}

export async function findStep(ctx: Ctx, lessonSlug: string, stepSlug: string) {
  const row = await ctx.db.step.findFirst({
    where: { slug: stepSlug, lesson: { slug: lessonSlug, status: { in: ctx.visibleStatuses } } },
  });
  if (!row) throw new HttpError(404, 'STEP_NOT_FOUND', 'No such step');
  return row;
}

/** The ledger reason for completing a step; unique per user, so a step is paid at most once. */
export const stepReason = (stepId: string) => `step:${stepId}`;

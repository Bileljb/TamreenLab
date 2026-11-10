import type { Ctx } from '../context';
import { keyOfDate } from '../lib/day';

/**
 * Everything stored about a learner, readable and portable (ADR 013): the right of access in the
 * data-protection laws of the target region. Secrets (the password hash, session tokens, reset
 * tokens) are left out; the AI assistant keeps no row that points to the account.
 */
export async function exportUserData(ctx: Ctx, userId: string) {
  const user = await ctx.db.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      streak: true,
      attempts: {
        orderBy: { createdAt: 'asc' },
        include: { step: { select: { slug: true, lesson: { select: { slug: true } } } } },
      },
      points: { orderBy: { createdAt: 'asc' } },
      progress: { include: { lesson: { select: { slug: true } } } },
      reviews: {
        include: { step: { select: { slug: true, lesson: { select: { slug: true } } } } },
      },
      emails: { orderBy: { sentAt: 'asc' } },
    },
  });
  return {
    exportedAt: ctx.config.now().toISOString(),
    account: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      locale: user.locale,
      createdAt: user.createdAt.toISOString(),
      dailyGoal: user.dailyGoal,
      emailOptIn: user.emailOptIn,
      emailOptInAt: user.emailOptInAt?.toISOString() ?? null,
    },
    streak: user.streak && {
      current: user.streak.current,
      longest: user.streak.longest,
      lastDay: user.streak.lastDay ? keyOfDate(user.streak.lastDay) : null,
      freezeEnabled: user.streak.freezeEnabled,
      freezeUsedOn: user.streak.freezeUsedOn ? keyOfDate(user.streak.freezeUsedOn) : null,
    },
    attempts: user.attempts.map((a) => ({
      lesson: a.step.lesson.slug,
      step: a.step.slug,
      correct: a.correct,
      firstTry: a.firstTry,
      timeMs: a.timeMs,
      answer: a.answer,
      at: a.createdAt.toISOString(),
    })),
    points: user.points.map((p) => ({
      points: p.delta,
      reason: p.reason,
      day: keyOfDate(p.day),
      at: p.createdAt.toISOString(),
    })),
    progress: user.progress.map((p) => ({
      lesson: p.lesson.slug,
      stepsDone: p.stepsDone,
      completedAt: p.completedAt?.toISOString() ?? null,
      firstTryRate: p.firstTryRate,
    })),
    reviews: user.reviews.map((r) => ({
      lesson: r.step.lesson.slug,
      step: r.step.slug,
      box: r.box,
      dueDay: keyOfDate(r.dueDay),
    })),
    emails: user.emails.map((e) => ({
      kind: e.kind,
      period: e.periodKey,
      sentAt: e.sentAt.toISOString(),
    })),
  };
}

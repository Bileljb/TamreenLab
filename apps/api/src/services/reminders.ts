import { fillTemplate, type ContentLocale, type EmailCopy } from '@tamreen/shared';
import type { Ctx } from '../context';
import { dayDate, isoWeek } from '../lib/day';
import type { Email, Mailer } from '../lib/mailer';
import { visibleStreak } from '../lib/streak';
import { unsubscribeToken } from '../lib/unsubscribe';
import { nextLesson, streakState } from './progress';

export const WEEKLY_REMINDER = 'weekly-reminder';

export type ReminderContent = {
  /** The email text in each language. */
  copy: Record<ContentLocale, EmailCopy>;
  /** A lesson's title in a language, for "next lesson". */
  lessonTitle: (locale: ContentLocale, slug: string) => string | undefined;
};

const asLocale = (value: string): ContentLocale =>
  value === 'en' || value === 'fr' ? value : 'ar';

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Sends this week's reminder to every learner who opted in and has not had it yet (ADR 011).
 * Only `emailOptIn = true` is ever selected, and the (user, kind, week) row is written before
 * sending, so a second run in the same week sends nothing. A failed send removes the row so the
 * next run retries.
 */
export async function sendWeeklyReminders(ctx: Ctx, mailer: Mailer, content: ReminderContent) {
  const today = ctx.today();
  const periodKey = isoWeek(today);
  const users = await ctx.db.user.findMany({
    where: { emailOptIn: true },
    include: { streak: true },
    orderBy: { createdAt: 'asc' },
  });

  let sent = 0;
  let skipped = 0;
  for (const user of users) {
    const { count } = await ctx.db.emailLog.createMany({
      data: [{ userId: user.id, kind: WEEKLY_REMINDER, periodKey }],
      skipDuplicates: true,
    });
    if (count === 0) {
      skipped++;
      continue;
    }
    const locale = asLocale(user.locale);
    const [reviewsDue, next] = await Promise.all([
      ctx.db.reviewItem.count({ where: { userId: user.id, dueDay: { lte: dayDate(today) } } }),
      nextLesson(ctx, user.id),
    ]);
    const streak = visibleStreak(streakState(user.streak), today, {
      freeze: user.streak?.freezeEnabled,
    });
    const email = weeklyEmail({
      to: user.email,
      name: user.displayName,
      locale,
      streak,
      reviewsDue,
      next: next && {
        title: content.lessonTitle(locale, next.slug) ?? next.slug,
        href: `${ctx.config.siteUrl}/${locale}/lessons/${next.track}/${next.slug}`,
      },
      copy: content.copy[locale],
      siteUrl: ctx.config.siteUrl,
      from: ctx.config.mailFrom,
      token: unsubscribeToken(user.id, ctx.config.jwtSecret),
      userId: user.id,
    });
    try {
      await mailer.send(email);
      sent++;
    } catch (e) {
      await ctx.db.emailLog.deleteMany({
        where: { userId: user.id, kind: WEEKLY_REMINDER, periodKey },
      });
      throw e;
    }
  }
  return { periodKey, sent, skipped };
}

type WeeklyInput = {
  to: string;
  name: string;
  locale: ContentLocale;
  streak: number;
  reviewsDue: number;
  next: { title: string; href: string } | null;
  copy: EmailCopy;
  siteUrl: string;
  from: string;
  userId: string;
  token: string;
};

/** The weekly reminder, as plain text and simple HTML, with one-click unsubscribe headers. */
export function weeklyEmail(input: WeeklyInput): Email {
  const w = input.copy.weekly;
  const query = `u=${encodeURIComponent(input.userId)}&t=${encodeURIComponent(input.token)}`;
  const unsubscribePage = `${input.siteUrl}/${input.locale}/unsubscribe?${query}`;
  const oneClick = `${input.siteUrl}/api/email/unsubscribe?${query}`;
  const reviewHref = `${input.siteUrl}/${input.locale}/review`;
  const ctaHref = input.next?.href ?? reviewHref;

  const lines = [
    fillTemplate(w.greeting, { name: input.name }),
    input.streak > 0 ? fillTemplate(w.streak, { days: input.streak }) : w.streakNone,
    input.reviewsDue > 0 ? fillTemplate(w.reviews, { count: input.reviewsDue }) : w.reviewsNone,
    input.next ? fillTemplate(w.next, { lesson: input.next.title }) : w.allDone,
  ];
  const text = [
    ...lines,
    '',
    `${w.cta}: ${ctaHref}`,
    ...(input.reviewsDue > 0 ? [reviewHref] : []),
    '',
    w.why,
    `${w.unsubscribe}: ${unsubscribePage}`,
  ].join('\n');

  const dir = input.locale === 'ar' ? 'rtl' : 'ltr';
  const html = `<!doctype html>
<html lang="${input.locale}" dir="${dir}">
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2933">
${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('\n')}
<p><a href="${escapeHtml(ctaHref)}" style="display:inline-block;padding:10px 20px;border-radius:999px;background:#0f766e;color:#ffffff;text-decoration:none">${escapeHtml(w.cta)}</a></p>
<p style="font-size:12px;color:#6b7280">${escapeHtml(w.why)}<br><a href="${escapeHtml(unsubscribePage)}">${escapeHtml(w.unsubscribe)}</a></p>
</body>
</html>`;

  return {
    to: input.to,
    from: input.from,
    subject: w.subject,
    text,
    html,
    headers: {
      'List-Unsubscribe': `<${oneClick}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}

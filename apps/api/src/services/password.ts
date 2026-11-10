import { hash } from '@node-rs/argon2';
import { fillTemplate, type ContentLocale, type EmailCopy } from '@tamreen/shared';
import type { Ctx } from '../context';
import { HttpError } from '../lib/errors';
import type { Email } from '../lib/mailer';
import { hashToken, newRefreshToken } from '../lib/tokens';

/** How long a link works, and how many links one account can be sent per hour (ADR 013). */
export const RESET_TTL_MINUTES = 30;
export const RESETS_PER_HOUR = 3;

const asLocale = (value: string): ContentLocale =>
  value === 'en' || value === 'fr' ? value : 'ar';

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function mail(ctx: Ctx) {
  if (!ctx.mail) throw new HttpError(503, 'MAIL_UNAVAILABLE', 'Email is not configured');
  return ctx.mail;
}

/**
 * Emails a reset link to the account with this email, if there is one. The caller answers the
 * same either way. A new link replaces any earlier unused one.
 */
export async function requestPasswordReset(ctx: Ctx, email: string): Promise<void> {
  const { mailer, copy } = mail(ctx);
  const user = await ctx.db.user.findUnique({ where: { email } });
  if (!user) return;
  const now = ctx.config.now();
  const recent = await ctx.db.passwordResetToken.count({
    where: { userId: user.id, createdAt: { gt: new Date(now.getTime() - 60 * 60_000) } },
  });
  if (recent >= RESETS_PER_HOUR) return;

  const token = newRefreshToken();
  await ctx.db.$transaction([
    // Older links stop working but stay counted for the hourly limit; a day later they go.
    ctx.db.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: now },
    }),
    ctx.db.passwordResetToken.deleteMany({
      where: { userId: user.id, createdAt: { lt: new Date(now.getTime() - 86_400_000) } },
    }),
    ctx.db.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(now.getTime() + RESET_TTL_MINUTES * 60_000),
        createdAt: now,
      },
    }),
  ]);
  const locale = asLocale(user.locale);
  await mailer.send(
    resetEmail({
      to: user.email,
      from: ctx.config.mailFrom,
      name: user.displayName,
      href: `${ctx.config.siteUrl}/${locale}/reset-password?token=${token}`,
      copy: copy[locale],
    }),
  );
}

/** Sets a new password from a link's token; every session of the account ends. */
export async function resetPassword(ctx: Ctx, token: string, password: string): Promise<void> {
  const now = ctx.config.now();
  const row = await ctx.db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!row || row.usedAt || row.expiresAt <= now) {
    throw new HttpError(400, 'INVALID_RESET_TOKEN', 'This link is invalid or has expired');
  }
  const passwordHash = await hash(password);
  await ctx.db.$transaction(async (tx) => {
    // Marking it used inside the transaction stops two concurrent uses.
    const { count } = await tx.passwordResetToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: now },
    });
    if (count === 0) {
      throw new HttpError(400, 'INVALID_RESET_TOKEN', 'This link is invalid or has expired');
    }
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash } });
    await tx.refreshToken.updateMany({
      where: { userId: row.userId, revokedAt: null },
      data: { revokedAt: now },
    });
  });
}

type ResetInput = { to: string; from: string; name: string; href: string; copy: EmailCopy };

/** The reset email, as plain text and simple HTML. No tracking, no images. */
export function resetEmail({ to, from, name, href, copy }: ResetInput): Email {
  const r = copy.reset;
  const greeting = fillTemplate(r.greeting, { name });
  const body = fillTemplate(r.body, { minutes: RESET_TTL_MINUTES });
  return {
    to,
    from,
    subject: r.subject,
    headers: {},
    text: [greeting, '', body, '', `${r.cta}: ${href}`, '', r.ignore].join('\n'),
    html: [
      `<p>${escapeHtml(greeting)}</p>`,
      `<p>${escapeHtml(body)}</p>`,
      `<p><a href="${escapeHtml(href)}">${escapeHtml(r.cta)}</a></p>`,
      `<p>${escapeHtml(r.ignore)}</p>`,
    ].join('\n'),
  };
}

# ADR 014 — Email provider: Brevo over SMTP, with a daily sending limit

- **Status:** accepted
- **Date:** 2026-11-10
- **Decider:** the developer chose a free, generous provider and will upgrade when traffic grows. They picked Brevo. Claude Code chose the integration.

## Context

Until now, reminder emails (ADR 011) and password-reset emails (ADR 013) were only written to the logs, because no provider was chosen.

Published 2026 comparisons give these free plans:

| Provider | Free emails         | Daily cap |
| -------- | ------------------- | --------- |
| Brevo    | about 9,000 a month | 300       |
| Mailjet  | 6,000 a month       | 200       |
| Resend   | 3,000 a month       | 100       |

Free plans cap emails per day. The reminder run sends to every opted-in learner at once, so a big run could use up the day's allowance and block password resets.

## Decision

**Brevo, over plain SMTP:**

- `SmtpMailer` in `apps/api/src/lib/mailer.ts` sends through any SMTP server, using nodemailer.
- Brevo is `smtp-relay.brevo.com`, port 587 with STARTTLS (TLS is required). Port 465 uses TLS from the start.
- Moving to a paid plan, or to Mailjet, Resend or Amazon SES, means changing `SMTP_*` and `MAIL_FROM`, not code.
- Brevo's own HTTP API was not used, because it would tie the code to one provider.

**Settings:**

- `MAIL_TRANSPORT` is `log` (the default) or `smtp`.
- With `smtp`, the API refuses to start unless `SMTP_HOST`, `SMTP_USER` and `SMTP_PASS` are set. `SMTP_PORT` defaults to 587.
- An empty `KEY=` in `.env` counts as not set.
- Connection timeouts are 10–20 s, so a slow provider cannot hold a password-reset request for long.

**Daily limit:**

- `MAIL_DAILY_LIMIT` (default 280, under Brevo's 300) counts the emails sent since midnight UTC: reminders from `EmailLog`, and password resets from `PasswordResetToken`.
- The reminder run stops at the limit and reports the remaining learners as `deferred`.
- **Schedule `pnpm reminders:send` daily, not weekly.** Each run sends what today's allowance permits. The (user, week) row still guarantees one reminder per learner per week.
- Password resets are never deferred: a locked-out learner comes first. The margin of 20 under Brevo's cap is kept for them.

**Checking a setup.** `pnpm --filter @tamreen/api mail:test you@example.com` sends one bilingual test email with the current settings.

## Licences

`nodemailer` 10.2.1 is **MIT-0** (MIT No Attribution).

- It is as permissive as MIT, without even the requirement to keep the notice, so it places no obligation on this project.
- It is recorded here because it is not literally MIT, Apache-2.0 or BSD.
- `@types/nodemailer` is MIT.
- Version 10.2.1 was chosen because it had been released for more than two weeks; newer versions came out on the day of this change.

## Consequences

- **Before mail goes out:**
  - The developer verifies a sending domain in Brevo, with SPF, DKIM and DMARC records.
  - They then set `MAIL_TRANSPORT=smtp`, the SMTP login and key, and a `MAIL_FROM` on that domain.
  - Sending from a free mailbox address (such as Gmail) fails the receiving providers' sender checks.
- **Tests:**
  - Unit: the mailer choice, the full message (with headers) handed to the transport, the env rules.
  - Integration: reminders stop at the limit, counting resets, and finish the next day without anyone getting two.
- **Upgrading:**
  - Raise `MAIL_DAILY_LIMIT` to the new plan's allowance.
  - On a plan without a daily cap, set it high (for example 100000).

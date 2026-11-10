# ADR 013 — Hardening: security, operations, accessibility and load

- **Status:** accepted
- **Date:** 2026-11-10
- **Decider:** Claude Code, within PLAN Phase 9. The developer asked for Phase 9 without the hosting work, which stays theirs. The consent model (D5) and the email provider remain the developer's decisions.

## Context

Phase 9 asks for five things:

- a security pass: OWASP basics, a dependency audit, secrets management, a CSRF strategy and a password-reset flow;
- backups with a tested restore, error tracking, uptime checks and structured logs;
- an accessibility pass;
- cookie consent and a privacy policy suited to the target countries;
- a load test of `POST /attempts` and the leaderboard, with indexes as needed.

Acceptance: a restore from backup is demonstrated, and no critical findings remain open. `docs/SECURITY.md` has the full review; this ADR records the decisions.

## Decision

**Client IP:**

- The API used Express's `trust proxy = loopback` behind the Next.js rewrite. Next.js forwards `X-Forwarded-For` as the client sent it, so the "client IP" was whatever the client wrote, or `::1` for everyone.
- Production now requires `TRUST_PROXY_HOPS`: the number of proxies in front of the web server that append the real address.
- The API listens on `127.0.0.1` unless `HOST` says otherwise.
- The rule: never trust a header a client can write, and keep the API private.

**CSRF.** Three layers:

1. `SameSite=Lax` cookies.
2. JSON-only state changes (from Phase 4).
3. New: a state-changing request whose `Origin` is not `PUBLIC_SITE_URL`, or whose `Sec-Fetch-Site` is `cross-site`, is refused with `403 CROSS_SITE`.

Requests without either header come from non-browser clients, which carry no victim's cookies. The one-click unsubscribe stays before the guard, as ADR 011 requires.

**Password reset:**

- `POST /auth/password/forgot` answers 202 whether or not the account exists.
- The token is 256 random bits, stored as a SHA-256 hash, valid for 30 minutes.
- A new link retires the older ones; the retired rows are kept for a day so the 3-an-hour limit can count them.
- `POST /auth/password/reset` marks the token used inside the transaction (so two uses cannot both succeed), sets the argon2id hash and revokes every refresh token.
- The page removes the token from the address bar on load.
- Sending goes through the `Mailer`, so until a provider is chosen the email is only logged.

**Headers.**

- The web app sends a CSP with no third-party origins, `frame-ancestors 'none'`, `object-src 'none'` and `base-uri`/`form-action 'self'`, plus HSTS, nosniff, Referrer-Policy, Permissions-Policy and COOP.
- The CSP allows `'unsafe-inline'` scripts: static pages cannot carry per-request nonces, and Next.js and the theme script are inline.
- An e2e test plays a lesson step and fails on any CSP violation.
- When an ad network is wired (D5), its origins are added in `apps/web/src/lib/securityHeaders.ts`.

**Logs and error tracking:**

- pino keeps writing JSON lines, now with credentials redacted and a request id. The id comes from the proxy's `X-Request-Id` when it looks valid, and goes back in the response header and in 500 bodies.
- Unhandled rejections are logged. An uncaught exception is logged and exits, so the host restarts the process.
- Pages have error boundaries in all three languages. They report to `POST /client-errors`: a strict, size-limited schema, the path with no query string (so reset tokens never reach logs), rate-limited, logged and never stored.
- A hosted error tracker is a host choice; it can read the same events.

**Backups:**

- `pnpm db:backup` exports a snapshot (`pg_export_snapshot`), counts every table inside it, and runs `pg_dump --snapshot` on the same snapshot. The manifest therefore matches the dump exactly, even while learners are writing.
- `pnpm db:restore-drill` restores into a scratch database, compares counts and the latest migration, and drops the scratch database. It never touches the live database.
- Tools come from `PATH`, or from the local Docker database.
- Scheduling, off-site copies and retention are hosting tasks (`docs/OPERATIONS.md`).

**Load:**

- `pnpm --filter @tamreen/api load:test` builds its own database at launch-plus scale (20,000 users, a month of ledger history, 200,000 attempts). It runs the real app in-process with test rate limits, so no production setting can switch rate limits off.
- The leaderboard index became `(day, userId, delta)`, which makes the daily sum an index-only scan: 7.5 ms down to 3.7 ms, and throughput up 35%.
- `POST /attempts` needed no index; its queries already use the unique and composite indexes.

**Accessibility:**

- axe-core checks WCAG 2.1 A and AA on the main page types in all three languages, in light and dark themes, on desktop and mobile, and on the player after a wrong answer, a hint and a reveal.
- The checks run with reduced motion, so fade-ins are measured at their final colours.
- Fixes:
  - brand green `#059669` → `#047857` (white text 3.8:1 → 5.5:1);
  - faint text `#64748b` → `#5b6b82`;
  - grid cells named "B4 200", as in Excel;
  - hints moved out of field labels and linked as descriptions;
  - a skip link as the first Tab stop.
- Keyboard-only lesson play was already covered by e2e tests.

**Privacy:**

- `GET /me/export` and a "Download my data" button give the learner everything stored about them (the right of access in the Saudi and UAE PDPLs and the GDPR), without secrets.
- The policy now states retention and rights.
- The consent model stays opt-out, as decided in ADR 007, until the developer decides D5; changing it is one line.

**Dependencies:**

- `pnpm audit --prod` is clean, and CI now fails on any finding in shipped dependencies.
- Two moderate advisories in development tooling are accepted, with reasons in `docs/SECURITY.md`.
- No secrets in the repository or its history (checked for Groq, Anthropic, AWS and private-key patterns).

## Licences

`@axe-core/playwright` and `axe-core` 4.14.0 are **MPL-2.0**.

- They are development dependencies of `apps/web`, used only by the end-to-end accessibility tests.
- They are never bundled into the site and never shipped to learners.
- MPL-2.0 is file-level copyleft. It only applies if those files are modified and distributed, which this project does not do.

## Consequences

- **Migrations:**
  - `PasswordResetToken`, which cascades on account deletion;
  - the PointEvent leaderboard index replaced by its covering version.
- **New environment settings:**
  - `HOST` (default `127.0.0.1`);
  - `TRUST_PROXY_HOPS` (required in production);
  - `CONTENT_DIR` (optional; the API now reads email text at startup).
- **New tests:**
  - integration: client IP, CSRF, client errors, data export, password reset;
  - unit: logger redaction, security headers, backup helpers, the reset and export UI;
  - e2e: CSP, 404s, forgotten password, accessibility (32 checks).
- **Commands:** `db:backup`, `db:restore-drill`, `load:test`.
- **Docs:** `docs/SECURITY.md` (review) and `docs/OPERATIONS.md` (runbook).

# Security review (PLAN Phase 9)

- **Reviewed:** 2026-11-10
- **Scope:** `apps/api`, `apps/web`, `packages/*`
- **Method:** the OWASP Top 10 (2021) categories, with each claim checked in code or by a test. Decisions are in ADR 013.

**Result: no critical or high findings remain open.** Each open item below is either a decision for the developer or a hosting task.

## Findings fixed in this pass

| #   | Severity | Finding                                                                                                                                                                                                                                                                                                         | Fix                                                                                                                                    | Test                                                                       |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1   | High     | **Client IP spoofing.** The Next.js rewrite forwards `X-Forwarded-For` as sent, and the API trusted it. A client could choose its own IP and get around every per-IP limit (sign-in brute force, AI quota). Clients without the header all shared one bucket, so one abuser could lock everyone out of sign-in. | Production requires `TRUST_PROXY_HOPS`. The API listens on `127.0.0.1` by default.                                                     | `security.int.test.ts`                                                     |
| 2   | Medium   | **No forgotten-password flow.** Locked-out learners could only make a new account.                                                                                                                                                                                                                              | Emailed single-use link: hashed, 30 minutes, 3 an hour, revokes every session.                                                         | `password.int.test.ts`, `PasswordForms.test.tsx`, e2e                      |
| 3   | Medium   | **No browser security headers.** No CSP and no protection against framing.                                                                                                                                                                                                                                      | CSP (no third-party origins, `frame-ancestors 'none'`, `object-src 'none'`), HSTS, nosniff, Referrer-Policy, Permissions-Policy, COOP. | `securityHeaders.test.ts`, e2e plays a step and fails on any CSP violation |
| 4   | Medium   | **CSRF relied on one layer.** The JSON content-type check was the only guard.                                                                                                                                                                                                                                   | State changes with a foreign `Origin` or `Sec-Fetch-Site: cross-site` are refused. Cookies stay `SameSite=Lax`.                        | `security.int.test.ts`                                                     |
| 5   | Medium   | **Credentials could reach logs.** pino-http logs request headers, cookies included.                                                                                                                                                                                                                             | Cookies, the `authorization` header, `set-cookie`, passwords and tokens are redacted.                                                  | `logger.test.ts`                                                           |
| 6   | Low      | **Unbounded memory.** The log mailer kept every email in memory in a long-running process.                                                                                                                                                                                                                      | Keeps the last 50.                                                                                                                     | —                                                                          |
| 7   | Low      | **Unknown paths caused a page error.** `/favicon.ico` and any other unknown locale gave a 500 instead of a 404.                                                                                                                                                                                                 | `dynamicParams = false` on the locale layout, plus a site icon.                                                                        | e2e                                                                        |

## OWASP Top 10 checklist

- **A01 Broken access control**
  - Every `/me/*`, attempt and review route takes the user id from the verified token, never from the request.
  - Account data is only ever queried by that id.
  - Draft lessons are not served in production.
  - The leaderboard is public by design and shows display names only.
- **A02 Cryptographic failures**
  - Passwords are hashed with argon2id.
  - Access tokens are HS256 JWTs (issuer and algorithm pinned) signed with a secret of at least 32 characters, which production requires.
  - Refresh and reset tokens are 256-bit random values stored as SHA-256 hashes.
  - Unsubscribe links and the AI-assistant keys use HMAC-SHA256 with a purpose prefix.
  - Cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` in production.
- **A03 Injection**
  - All database access goes through Prisma's parameterised queries. Raw SQL appears only in operator scripts, with fixed identifiers.
  - The formula engine is a custom parser and evaluator, with no `eval` or `new Function`.
  - React escapes output. The only raw HTML is the fixed theme script and JSON-LD, with `<` escaped. Email HTML escapes every value.
  - The AI prompt quotes the learner's formula as JSON data, and every reply is checked for the answer before it is shown.
- **A04 Insecure design**
  - Rate limits apply to sign-in, sign-up, password reset, attempts, the AI assistant and browser error reports.
  - Points are decided by the server (it re-checks every answer). A reward is unique per reason, so a step can't be paid twice.
  - Quotas and spend caps apply to the paid-API path.
- **A05 Security misconfiguration**
  - `helmet` is on the API; security headers are on the web app.
  - `x-powered-by` is off on both.
  - Errors return a code and a request id, never a stack.
  - Production refuses to start without `JWT_SECRET` and `TRUST_PROXY_HOPS`.
- **A06 Vulnerable components**
  - `pnpm audit --prod` finds no known vulnerabilities, and CI now fails on any.
  - Dependencies are pinned and installed with `--frozen-lockfile`.
- **A07 Identification and authentication**
  - Access tokens last 15 minutes.
  - Refresh tokens rotate, and reusing one revokes its whole family.
  - Logout and password reset revoke sessions.
  - Sign-in takes the same time whether or not the email exists.
- **A08 Integrity**
  - Content files are validated with zod and linted in CI.
  - No third-party scripts are loaded (the CSP enforces it).
- **A09 Logging and monitoring**
  - Structured JSON logs with request ids, and credentials redacted.
  - Browser errors are reported through error boundaries.
  - Unhandled rejections and exceptions are logged.
  - `GET /api/health` checks the database.
- **A10 SSRF:** the server makes one kind of outbound request, to a fixed provider URL (Groq). No user-supplied URL is ever fetched.

## Accepted risks

- **Account enumeration at sign-up.** `POST /auth/register` answers 409 for a taken email. Password reset does not reveal accounts, but sign-up has to say why it failed. Mitigation: the sign-up rate limit.
- **Answers are in the page.** The player checks answers in the browser for instant feedback, so the solutions are in the lesson data. Points still come only from the server's own check. A learner who reads the data only cheats themselves on a free practice site.
- **CSP allows inline scripts.** The pages are static, so per-request nonces are impossible. Every other source is limited to this origin.
- **Two moderate advisories in development tooling** (`glob` under Lighthouse, `minimatch` under typescript-eslint). Neither runs in production or reads untrusted input. They are left until their parents update, rather than forced with overrides.
- **Quotas can overshoot slightly.** Concurrent AI requests can exceed a quota or cap by a request or two.

## Open items (developer or hosting)

- **D5: consent model.** Analytics are opt-out today (ADR 007). Under Saudi PDPL or UAE PDPL readings, or if any EU visitors matter, opt-in is the safer default; it is a one-line change in `packages/ui/src/consent/consent.ts`.
- **Legal review** of the privacy policy and terms (they are marked as drafts).
- **Email provider (ADR 011).** Until there is one, password reset and reminders are logged, not sent.
- **Hosting.** Set `TRUST_PROXY_HOPS` and `HOST` to match the proxy layout, and keep the API port private. Also set up TLS, scheduled backups with an off-site copy, uptime checks and log retention (see `docs/OPERATIONS.md`).

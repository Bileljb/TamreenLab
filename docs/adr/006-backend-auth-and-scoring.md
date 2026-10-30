# ADR 006 — Backend: accounts, server scoring, days and guest merge

- **Status:** accepted
- **Date:** 2026-10-30
- **Decider:** Claude Code (within plan defaults); the day definition is open to change once D2 is decided

## Context

Phase 4 adds accounts and makes the API authoritative for points (PLAN T3, T5, T6). The plan asks for these choices to be recorded:

- how a "day" is defined for streaks and the leaderboard,
- how guest progress is merged,
- how sessions work.

## Decision

### Sessions

**Passwords and tokens**

- Passwords are hashed with argon2id (`@node-rs/argon2`, MIT, prebuilt binaries).
- Access tokens are 15-minute HS256 JWTs (`jose`, MIT), signed with `JWT_SECRET`. The secret is required in production.

**Cookies**

- **`tamreen_at`** holds the access token. It is httpOnly and `SameSite=Lax`, and `Secure` in production.
- **`tamreen_rt`** holds the refresh token: an opaque 30-day token, with the same flags and the path `/api/auth`.
- **`tamreen_session=1`** is a non-secret hint the browser can read. It lets guests skip the refresh call entirely.

**Refresh-token rotation**

- Refresh tokens are stored only as a SHA-256 hash, in `RefreshToken`.
- Every refresh revokes the token and issues a new one in the same family.
- If a revoked token is used again, it has leaked, so the whole family is revoked.
- Revocation is a conditional update, so two concurrent refreshes cannot both succeed.

**CSRF and rate limits**

- **CSRF:** every request with a body must be `application/json`, which a cross-site HTML form cannot send without a preflight the API never allows. A bodiless DELETE cannot come from a form. Phase 9 reviews the full CSRF strategy.
- **Rate limits** (`express-rate-limit`, MIT):
  - login and register: 20 per 15 minutes per IP;
  - attempts: 120 per minute per user;
  - everything else: 300 per minute.
- Token refreshes are deliberately not in the sign-in limit. Otherwise a guest browsing 20 pages locked themselves out of signing in; e2e caught this.

### Server-side scoring

- `POST /api/attempts` addresses steps by `(lessonSlug, stepSlug)`, never by database id, because the player works from content files.
- The body has no "correct" field. A forged one is rejected by the strict schema.
- The server loads the step, validates it again with `StepSpecSchema`, runs `checkAnswer` (the same engine as the browser) and records an `Attempt`.
- On a correct answer, `scoreAttempt` computes the points, and they go into the `PointEvent` ledger with `reason = step:<id>`.
- `@@unique([userId, reason])` plus an insert that skips duplicates means a step is paid at most once, even under concurrent requests. Integration tests prove both resubmission and concurrency.
- The client-reported `hintUsed` and `answerShown` can only lower the points. `timeMs` can raise them through the speed bonus, but that bonus is capped at 50% of base points. This is best-effort, as T3 accepts.

### Progress and streaks are derived

- A step is done when it has been paid. `LessonProgress` is recomputed from the ledger and the attempts after every change, so it cannot drift.
- A streak counts days with at least one paid step.
- The leaderboard is `SUM(delta)` per user for the current day.

### The day

A day is a calendar day at a fixed UTC offset, `DAY_UTC_OFFSET_MINUTES`.

- **Default: 180 (UTC+3).** Midnight then falls at the same moment for most of the Gulf and Levant, and within an hour or two for Egypt and the Maghreb. A per-user timezone would make the shared daily leaderboard ambiguous.
- Revisit when D2 (first target country) is decided. Changing the offset only changes how new events are bucketed into days.

### Guest merge

`POST /api/progress/sync` receives the localStorage progress after sign-up or sign-in. Guest answers were never checked by the server, so:

- each merged step earns its flat `basePoints`, with no bonuses;
- one merge awards at most 3,000 points;
- steps already paid and unknown slugs are skipped.

The merge goes through the same ledger, so repeating it changes nothing. After a successful merge, the browser clears its guest progress.

### Account deletion

`DELETE /api/me` deletes the user. Database cascades remove their attempts, points, progress, streak and sessions.

### API description

`GET /api/docs` serves an OpenAPI 3.1 document generated from the same zod schemas the routes validate with.

### Testing

- Integration tests run against a real Postgres database (`tamreen_test`) seeded with the real curriculum through `syncContent`.
- CI runs them with a Postgres service.
- The e2e job also starts Postgres and the API, so the account flow is tested end to end.

## Consequences

- The lessons API serves drafts while `CONTENT_INCLUDE_DRAFTS` is true. This is the default outside production, because all lessons are drafts until the native-Arabic review.
- Leaderboard names are checked against a short blocked-word list. Reports and moderation tools are out of scope.
- Password reset is not built; it is in Phase 9.

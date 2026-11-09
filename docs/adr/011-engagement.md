# ADR 011 — Engagement: levels, daily goal, streak freeze, review, reminders, sharing

- **Status:** accepted
- **Date:** 2026-11-09
- **Decider:** Claude Code (the approach), within PLAN Phase 7. The developer asked to build Phase 7 without a plan approval. The email provider stays the developer's decision.

## Context

Phase 7 asks for six things:

- levels and a daily goal;
- an optional streak freeze;
- a "review mistakes" mode with simple spacing;
- opt-in email capture with a weekly reminder;
- a share card made with `next/og`.

Acceptance:

- the returning-learner flow works;
- the unsubscribe link works;
- no email is sent without opt-in.

## Decision

**Levels** come from total points (`levelFor` in `packages/engine`), so guests and the API agree. Each level takes 500 more points than the one before: level 2 starts at 500, level 3 at 1,500 and level 4 at 3,000. A first lesson reaches level 2 or 3. Nothing is stored; the level is computed from the ledger.

**Daily goal:**

- The learner chooses 300, 900 (the default) or 1,800 points a day (`User.dailyGoal`).
- Today's points come from the existing `PointEvent` ledger.
- The goal shows as a ring on the home page and next to the lesson.

**Streak freeze:**

- It is off by default (`Streak.freezeEnabled`).
- When it is on, it covers one missed day: if the last active day was the day before yesterday, the streak continues.
- It works at most once in any seven days (`Streak.freezeUsedOn`).
- While it covers yesterday, the stats show the streak with `frozen: true`.
- The logic is pure and tested in `apps/api/src/lib/streak.ts`.

**Review mistakes:**

- **Queueing.** Any wrong answer puts the step in `ReviewItem`, in box 0, due the same day. A step already in the queue starts over.
- **Spacing.** A correct answer played from `/[locale]/review` (`POST /attempts` with `mode: "review"`) moves the step to its next box, due 1, then 3, then 7 days later. A correct review in the last box removes the step from the queue.
- **Points.** A correct review pays 50 points once per scheduled review. The ledger reason is `review:<stepId>:<dueDay>`, which is unique, so a review cannot be farmed. A hint halves the points, and Show Answer pays nothing and does not advance the step. A review also counts for the streak.
- **Lesson answers don't count as reviews.** A correct answer in the normal lesson flow leaves the queue alone, so a learner who corrects a mistake straight away still sees it again later.
- **Where the text comes from.** `GET /me/review` returns only slugs, because the database stores only the Arabic source. The page fetches each lesson in the page language from `/[locale]/lessons/<track>/<slug>/data`, a static JSON route. It then plays the due steps in one `LessonPlayer` in review mode, which sends each attempt with its own lesson slug.

**Weekly reminder email:**

- **Opt-in only:**
  - `User.emailOptIn` defaults to false.
  - The sign-up box is unticked.
  - It can be switched in `/[locale]/account`.
  - `emailOptInAt` records when consent was given and is cleared on opt-out.
  - The privacy page says so in all three languages.
- **Sending:**
  - `pnpm reminders:send` selects only `emailOptIn = true`.
  - It writes an `EmailLog` row keyed by (user, kind, ISO week) before sending, so a second run in the same week sends nothing.
  - A failed send deletes the row so the next run retries.
  - The host schedules the command weekly, which is part of hosting.
- **Content:**
  - The email states the streak, the reviews due and the next lesson, in the learner's language (`User.locale`, set at sign-up and on each settings save).
  - The text lives in `content/emails/<locale>.json`, validated by zod; `content:lint` requires all three languages and their placeholders.
  - The HTML escapes the display name.
- **Unsubscribe:**
  - Every email links to `/[locale]/unsubscribe?u=<id>&t=<token>`.
  - The token is HMAC-SHA256 of `unsubscribe:<id>` with the server secret, so it needs no session and cannot be made for someone else.
  - The email also carries RFC 8058 one-click headers (`List-Unsubscribe`, `List-Unsubscribe-Post`). Mail apps send those as a form post, so `POST /api/email/unsubscribe` is mounted before the JSON-only CSRF guard.
  - That route reads no cookies and can only switch reminders off, so a cross-site post gains nothing.
  - It is rate-limited like sign-in.
- **Provider (open decision):**
  - Sending goes through a `Mailer` interface.
  - Only `LogMailer` exists, which logs and sends nothing, so no email can leave the server until the developer picks a provider.
  - Adding a provider means one class plus its env settings (`MAIL_TRANSPORT`, `MAIL_FROM`, `PUBLIC_SITE_URL`).

**Share card:**

- The completion screen has a share button. It opens the system share sheet where there is one, and otherwise copies the link.
- The link is `/[locale]/share/<track>/<slug>/<stars>`, built statically for every lesson and 1–3 stars.
- Only the stars travel in the link: no name and no points, so a shared link says nothing about the person.
- The page has a `next/og` image with the stars and a link to try the lesson. The image renderer does not shape Arabic, so the image text is Latin, as with the existing OG images.
- Share pages are `noindex` but not blocked in `robots.txt`, because some link-preview crawlers obey robots.txt.

**Returning learner:**

- Signed-in learners see a welcome-back panel at the top of the home page: level, goal ring, streak (with the freeze note), "continue: <lesson>" and "review N mistakes". Guests see the same page as before.
- The account menu links to the settings page.
- `/account`, `/review` and `/unsubscribe` are `noindex` and disallowed in `robots.txt`.

## Consequences

- One migration adds the `User` fields `dailyGoal`, `emailOptIn` and `emailOptInAt`, the `Streak` fields `freezeEnabled` and `freezeUsedOn`, and the tables `ReviewItem` and `EmailLog`. All of them cascade on account deletion.
- **Tests:**
  - Integration tests cover settings validation, the review spacing over several days, the freeze across days, signed and forged unsubscribe links, one-click form posts, reminders going only to opted-in learners once per week, and HTML escaping.
  - E2E covers the returning-learner flow, the unsubscribe link in a fresh browser, and the share page and image.
- **Before reminders go out:**
  - Choose the email provider and set up the sending domain (SPF, DKIM, DMARC).
  - Schedule the weekly command.
  - Both are listed in `docs/LAUNCH.md`.
- Points from reviews make level and daily goal reachable for learners who have finished the available lessons.

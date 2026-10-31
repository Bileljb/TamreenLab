# ADR 008 — Brand, audience and publishing the first lessons

- **Status:** accepted
- **Date:** 2026-10-31
- **Decider:** developer (D1, D2 and the publishing exception); Claude Code recorded and applied them

## Context

The launch checklist (docs/LAUNCH.md) needs decisions D1 (brand) and D2 (first target country). It also flagged that all 20 lessons were still `DRAFT`, waiting on the native-Arabic review PLAN Phase 3 requires.

## Decision

### D1: brand

**TamreenLab**, written in Latin letters, including inside Arabic text. It is defined once as `SITE_NAME` in `apps/web/src/lib/seo.ts`. Arabic copy uses it in `apps/web/messages/ar.json`, under `header.brand` and the about, privacy and terms pages. The domain is not decided yet; `SITE_URL` sets it at deploy time.

### D2: audience

- **No country on the site.** The site is for every Arabic reader and never names a target country, in copy or in metadata.
- **Gulf focus elsewhere.** The developer hopes most of the audience comes from the Gulf countries. That focus applies to promotion, the launch review and the hosting region (D3), not to the site itself.
- **Language.** Writing stays Modern Standard Arabic, with no dialect, currency or national institutions (docs/CONTENT.md).
- **Day boundary.** "Day" for streaks and the leaderboard stays UTC+3 (`DAY_UTC_OFFSET_MINUTES`, ADR 006). That is local midnight in Saudi Arabia, Kuwait, Qatar and Bahrain, and one hour off in the UAE and Oman.
- **Language tags.** Open Graph locale stays `ar_AR` and hreflang stays `ar`, both region-neutral.

### Publishing without native review

The developer chose to publish all 20 lessons now, without the native-Arabic review that PLAN Phase 3 requires before publishing. Each lesson is `PUBLISHED`. The review log in docs/CONTENT.md lists each one as published by developer decision and not yet reviewed, so content lint passes without recording a review that did not happen.

## Consequences

- In production the API scores all 20 lessons; `CONTENT_INCLUDE_DRAFTS` is not needed.
- Arabic errors can reach learners. A later native review should replace each log row with the reviewer and date. Step-level drop-off from `pnpm metrics:report` can show which lessons to review first.
- If the audience turns out to be mostly in the UAE or Oman, revisit the day offset.

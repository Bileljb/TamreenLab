# ADR 007 — Public site: rendering, analytics, consent and ad slots

- **Status:** accepted
- **Date:** 2026-10-31
- **Decider:** Claude Code (within plan defaults); the ad network and final consent approach wait for D5

## Context

Phase 5 makes every lesson and function an indexable Arabic page. It adds ad slots and the launch metrics, and sets a mobile performance budget: LCP under 2.5 s, CLS under 0.1, Lighthouse performance of at least 85 and SEO of at least 95.

## Decision

### Rendering

- **Static pages.** Lesson, function and static pages are generated at build time (`generateStaticParams`, `dynamicParams = false`).
- **The player is a client island.** The explanation and FAQ are in the server HTML. The player (grid and engine) loads in the browser through `dynamic(..., { ssr: false })`.
- **No layout shift.** The island reserves the height of the lesson's tallest step, so loading it never shifts the page.
- **First step painted with the page.** While the player loads, the island shows a server-rendered copy of the player's header and first prompt. On a throttled mobile profile the prompt was the LCP element, and it waited about 800 ms of CPU for the grid chunk. LCP was about 3.1 s. Rendering the prompt on the server brings it to about 0.8 s, and the learner reads the task immediately. A returning guest who resumes later in the lesson sees step 1 for a moment, then their step.
- **Search metadata.** Every page gets a canonical URL, hreflang (`ar` and `x-default`), Open Graph and an OG image from `next/og`.
  - Lessons also get `LearningResource` and `BreadcrumbList` JSON-LD, plus `FAQPage` when they have an FAQ.
  - Sign-in pages are `noindex` and disallowed in `robots.txt`.
  - `SITE_URL` sets the public origin.

### Analytics

- **Events.** The site records five events: `lesson_start`, `step_correct`, `step_incorrect`, `lesson_complete` and `signup`.
- **Endpoint.** Events go to `POST /api/events` on our own API, with no third-party script. The body is validated with zod (`AnalyticsEventSchema`).
- **What is stored.** Each event has a random browser id (localStorage), a per-tab session id (sessionStorage), the lesson and step slugs, and the day.
- **What is not stored.** No user id, no IP address and no user agent. Requests omit credentials.
- **Opt-out.** Analytics run unless the learner turns them off in the consent banner. This is an opt-out model, chosen because the data is first-party and anonymous. D5 must confirm that it is acceptable in the target country (see docs/LAUNCH.md).
- **`pnpm metrics:report`** computes four figures from these events:
  - activation (of visitors who started a lesson, the share who completed the first one);
  - 7-day return;
  - median steps per session;
  - per-lesson step drop-off.

### Consent and ads

- **Consent banner.** It stores `{ analytics, personalisedAds, decidedAt }` under `tamreen.consent.v1`. It offers accept all, a per-purpose choice, and refuse optional.
- **`<AdSlot>` is provider-agnostic.** It has fixed heights (`inline` 280 px, `list` 120 px), so space is reserved before any ad loads.
  - Until D5 it renders a labelled placeholder. `NEXT_PUBLIC_ADS=off` hides every slot.
  - Slots go after the explanation and FAQ, on function pages and between lesson cards.
  - Slots never go inside or beside the player. An e2e test enforces this: no slot inside `[data-player-area]`, and the lesson-page slot sits well below the player.

### Verification

- **`pnpm --filter @tamreen/web lighthouse`** runs against a production build. It checks accessibility ≥ 90, SEO ≥ 95, mobile performance ≥ 85, mobile LCP < 2.5 s and CLS < 0.1 on five pages, on mobile and desktop.
- **`e2e/seo.spec.ts`** checks three things:
  - every sitemap URL returns 200, is indexable and has a canonical URL;
  - `robots.txt` is correct;
  - consent is remembered, and refusing it stops events.

## Consequences

- Wiring an ad network (D5) means replacing the placeholder inside `AdSlot` only. The reserved sizes must match the units chosen.
- If D5 or the target country's law requires opt-in analytics, change the default in `analyticsAllowed` (`packages/ui/src/consent/consent.ts`).
- The first-step preview duplicates the player's header markup. If the header changes, update the preview in the lesson page too.

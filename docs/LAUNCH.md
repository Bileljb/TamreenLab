# Launch checklist

Everything the developer needs to do or decide before the Phase 5 launch gate (PLAN §4): publishing to one country's communities and watching real metrics. The code side is done and verified; these items need an account, a decision or a human reviewer.

## 1. Blocking: do these before going live

- [ ] **Decide D1, D2, D3 and D5** and record each as an ADR in `docs/adr/`: brand and domain, first target country, hosting, and ad network plus consent approach.
- [ ] **Native Arabic review of the 20 lessons.** All lessons are still `DRAFT`. A lesson becomes `PUBLISHED` after review, with an entry in the review log in `docs/CONTENT.md`.
  - **Why it blocks:** in production the API excludes drafts by default (`CONTENT_INCLUDE_DRAFTS` defaults to off). Draft lessons still render on the site, but their attempts are not scored.
  - **If you must launch before review:** set `CONTENT_INCLUDE_DRAFTS=true` on the API, deliberately.
- [ ] **Production environment**
  - Web:
    - `SITE_URL` is the public origin, with no trailing slash. It drives canonical URLs, the sitemap and structured data.
    - `API_URL` points at the API.
    - Set `NEXT_PUBLIC_ADS=off` until D5 is wired, or the slots show labelled placeholders.
  - API:
    - `DATABASE_URL`.
    - `JWT_SECRET`: a long random value. The API refuses to start in production without it.
    - `NODE_ENV=production`. This also makes cookies `Secure`.
    - `DAY_UTC_OFFSET_MINUTES` if the target country is not UTC+3.
  - Database and content: run `pnpm db:migrate`, then `pnpm content:sync` against the production database.
- [ ] **Contact address.** The contact page says the address is "added at launch" (`pages.contact.body` in `apps/web/messages/ar.json`). Add a real address.
- [ ] **Account deletion.** The privacy page promises learners can delete their account. The API supports it (`DELETE /api/me`), but the site has no button for it yet.
  - **Option 1:** ask for a small task to add one.
  - **Option 2:** soften the privacy text until Phase 9.

## 2. Search Console

- [ ] **Verify the domain** in Google Search Console with a DNS TXT record (works for all subdomains).
  - Optional: also verify in Bing Webmaster Tools. It can import the Google property.
- [ ] **Submit `https://<domain>/sitemap.xml`.** It lists 43 URLs: 8 site pages, 20 lessons and 15 function pages. Sign-in pages are excluded and `noindex`.
- [ ] **Inspect a few URLs and request indexing:** one lesson, one function page and the home page.
- [ ] **Check the Enhancements reports after a few days.** Lessons publish `FAQPage` and `BreadcrumbList` structured data.
- [ ] **Track weekly** (PLAN §6, risk 3): indexed pages, plus impressions and clicks by page type (`/ar/lessons/…` vs `/ar/functions/…`).

## 3. Ad account (decision D5)

- [ ] **Choose the network and open the account.** Revenue per 1,000 views is expected to be low in this region (PLAN §5), so the UX rules stay:
  - no ads inside or beside the exercise player;
  - reserved space, so nothing shifts.
- [ ] **Wire it in `packages/ui/src/ads/AdSlot.tsx` only.** Replace the placeholder with the network's tag.
  - Map our placement names to the network's units, for example `lesson-after-faq`.
  - Keep the reserved heights (`inline` 280 px, `list` 120 px), or change `AD_SIZES` to the chosen unit sizes.
  - Load the network script only after the consent choice. Request personalised ads only when `personalisedAds` is true.
- [ ] **Publish `ads.txt`** at the site root if the network requires it.
- [ ] **Re-run the budgets** after wiring (`pnpm --filter @tamreen/web lighthouse`). Ad scripts are the most likely thing to break mobile performance ≥ 85 and CLS < 0.1.

## 4. Analytics

- [ ] **Nothing to sign up for.** Events are first-party: they go to our own API and database, with no third-party script. See ADR 007.
- [ ] **Run `pnpm metrics:report`** against the production database. It reports:
  - activation;
  - 7-day return;
  - median steps per session;
  - per-lesson step drop-off.

  Run it weekly during the launch review and set your own targets. The plan's starting guesses are 30% activation and 15% 7-day return.
- [ ] **Acquisition figures** (clicks, impressions, indexed pages) come from Search Console, not from our events.
- [ ] **Event retention:** decide how long to keep raw `AnalyticsEvent` rows (suggestion: 13 months). The privacy page should state it.

## 5. Consent text

- [ ] **Have the banner and privacy page reviewed for the target country.** The text is in `apps/web/messages/ar.json`, under `consent` and `pages.privacy`.
  - **Current behaviour:** anonymous analytics are on until the learner refuses them (opt-out), and personalised ads are off until they accept (opt-in).
  - If the target country, or the ad network's terms, require opt-in for analytics, change the default in `analyticsAllowed` (`packages/ui/src/consent/consent.ts`). This is a one-line change.
- [ ] **Name the operator** (a person or company) and add a contact for privacy requests on the privacy page.
- [ ] **Check whether the ad network needs a certified consent platform** (CMP). Some do for certain regions. If yours does, the CMP replaces our banner for ads.

## 6. Verified in this phase

On a production build (`pnpm build && pnpm start`, with the API and database running):

- **Lighthouse** (`pnpm --filter @tamreen/web lighthouse`), on five pages, mobile and desktop:
  - accessibility 100 and SEO 100;
  - mobile performance 87–94, with lesson pages at 90;
  - mobile LCP of about 0.77 s;
  - CLS of 0.041 or below, with ad slots on.
- **E2E** (`apps/web/e2e`): 38 passed.
  - Every sitemap URL returns 200, is indexable and has a canonical URL.
  - `robots.txt` is correct.
  - No ad slot appears inside the player area.
  - Refusing consent stops analytics.

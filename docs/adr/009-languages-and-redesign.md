# ADR 009 — English and French, and the redesign

- **Status:** accepted
- **Date:** 2026-10-31
- **Decider:** developer (scope, French formula names, design direction, default language); Claude Code (the approach below)

## Context

The developer asked for two things:

- **A modern, interactive design.** They chose a mix of a clean SaaS look and playful touches.
- **English and French alongside Arabic.** Arab learners may prefer either language.

Their decisions:

- Translate everything: interface, lessons, function pages and static pages.
- Keep Excel's English function names everywhere, with a note on French pages.
- Pick the first visit's language from the browser.

An English UI was listed under PLAN §8 (Deferred), which says to add a new phase when the developer requests it. This is Phase 5b.

## Decision

### Content in three languages

**Translation files**

- Arabic stays the source of every content file.
- Translations live in `content/i18n/<en|fr>/`, as `lessons/<slug>.json`, `functions/<slug>.json` and `tracks.json`. The zod schemas are in `packages/shared/src/i18n.ts`.
- Each file holds text only, keyed by step slug or by position.
- Each file also has a `strings` map that translates the Arabic text inside sheets and checks: headers, names, criteria and expected text.

**Localizing**

- `localizeLesson`, `localizeFunction` and `curriculumIn` (`packages/content/src/localize.ts`) build a lesson in another language.
- A cell equal to a `strings` key is replaced, and so is a quoted literal inside a formula, in sheets, solutions, variants and expected values.
- **Trade-off:** the output keeps the source shape. The player, the engine and lint are unchanged, but the `*Ar` field names now hold the chosen language's text. Renaming them to neutral names is a later refactor.

**Lint**

`content:lint` checks every language:

- each lesson, step, option, FAQ item, function page and track is translated;
- no Arabic script and no `{{…}}` markup is left;
- the French `localName` matches `FRENCH_EXCEL_NAMES`;
- every translated step and example is proved again with the engine. Translating two different Arabic words to the same word could change a SUMIF result, and lint catches it.

**The translations themselves** are Claude Code's. CONTENT.md marks them as not yet reviewed by native speakers.

### Scoring in the learner's language

- **Storage:** `content:sync` stores each language's sheet and check on the step, in `Step.localesJson` (migration `20261031081948_locales`).
- **Attempts:** the client sends the page's `<html lang>` as `locale`. `stepFromRow(row, locale)` checks the answer against that version, falling back to Arabic if a translation were missing.
- **Points:** step identity and the ledger are unchanged, so a step is paid once whatever the language.
- **Analytics:** events record `locale`, and `metrics:report` counts visitors by language.

### Formulas

- Every language uses English function names and commas, because the engine and the lessons are written that way.
- On French pages:
  - lesson intros mention the French name once ("SUM (SOMME dans Excel en français)");
  - lesson and function pages show a note mapping each function to its French Excel name;
  - the names come from `FRENCH_EXCEL_NAMES` in `packages/shared/src/i18n.ts`, which covers every engine function.

### Site language

**Routing**

- `LOCALES = ['ar', 'en', 'fr']`; Arabic is RTL, English and French are LTR.
- `/` redirects by the `NEXT_LOCALE` cookie, then `Accept-Language`, falling back to Arabic.
- The header and footer switcher links to the same page in each language. Following it sets the cookie.

**Interface text**

- The UI strings are in `apps/web/messages/{ar,en,fr}.json`.
- A test checks that all three have the same keys and the same placeholders and tags.

**SEO**

- Every page has hreflang alternates for all three languages, with Arabic as `x-default`.
- Each language has its own Open Graph locale.
- JSON-LD carries `inLanguage`.
- The sitemap lists all 129 URLs.
- Share images use the English formula, because the image renderer cannot shape Arabic.

**Fonts** (both OFL-1.1, through `next/font`, self-hosted)

- Cairo for Arabic pages, including their Latin text.
- Inter for English and French. It is not preloaded, so Arabic pages don't download it.

### Design system

**Tokens**

- Semantic colours are CSS variables in `apps/web/src/app/globals.css`, exposed to Tailwind as `bg-raised`, `text-muted`, `border-line`, `bg-brand` and so on.
- Components never use raw palette colours. The exceptions are the always-dark code and function-guide cards, and the track icon gradients.

**Themes**

- Light and dark come from `[data-theme]` on `<html>`.
- An inline head script applies the stored or system theme before paint, so there is no flash.
- The header toggle cycles system, light and dark, stored in localStorage as a per-browser convenience.

**Motion**

- CSS only: a short set of keyframes, plus a small `Reveal` observer for scroll entrances.
- No animation library.
- Everything respects `prefers-reduced-motion`.
- Content stays visible without JavaScript.

**Interactive pieces**

- **Home hero:** a live mini-sheet that types a demo formula and evaluates the visitor's own formulas. The engine loads only on first use; the server renders the first result.
- **Progress:** rings on tracks and lessons, from guest or account progress, plus a "continue" banner.
- **Player:**
  - step dots instead of a bar;
  - a floating XP chip;
  - pop and shake feedback;
  - a completion screen with stars and a home-made canvas confetti, skipped with reduced motion.
- **Function guide:** a live search filter.
- **Function pages:** a copy button on the syntax card.

**Sticky header**

- `html { scroll-padding-top }` keeps focused cells and anchors clear of it.

## Consequences

**Budgets.** All Lighthouse budgets pass in all three languages. The margin on mobile lesson pages is thin: performance is 85–86, with blocking time mostly from the grid chunk. Any extra JavaScript on lesson pages should be measured with `pnpm --filter @tamreen/web lighthouse`.

**New lessons need translations.** A new lesson needs English and French files before lint passes. Translations should keep distinct source strings distinct.

**Future languages.** Adding a language means:

- adding it to `TRANSLATED_LOCALES`;
- creating `content/i18n/<locale>/` and `messages/<locale>.json`;
- adding its direction, name and OG tag in `packages/shared/src/index.ts`.

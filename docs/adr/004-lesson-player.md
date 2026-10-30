# ADR 004 — Lesson player: scoring, content loading and interaction rules

- **Status:** accepted
- **Date:** 2026-10-30
- **Decider:** Claude Code (within plan defaults)

## Context

Phase 2 makes lessons playable in the browser with no API. The plan leaves open where scoring lives, how lesson files reach the page, how `packages/ui` gets its Arabic copy, and how Enter, Tab and taps behave in a grid that must feel like Excel but stay accessible.

## Decision

### Scoring is one pure function in the engine

`scoreAttempt` (`packages/engine/src/score.ts`) implements PLAN §3.5:

- base points, plus a speed bonus of up to 50% of base (full under 10 s, falling linearly to 0 at 60 s),
- plus a first-try bonus of 25% of base,
- halved after a hint, and 0 after Show Answer.

The player uses it to show points now. Phase 4's `POST /attempts` will call the same function, so the two cannot drift apart. The numbers are starting values; tune them after the launch metrics.

### Show Answer uses the engine

`referenceAnswer(step)` builds an answer that passes the step's own check. The player shows it and applies it to the grid. A revealed formula is not checked as a learner entry and earns nothing. Phase 3's `content:lint` will reuse it.

### Lesson files

- Lessons are JSON in `content/lessons/<track>/<slug>.json`, validated by `LessonFileSchema` (`packages/shared`). Phase 3 extends the schema.
- `apps/web/src/lib/content.ts` reads them with `fs` at build time, so an invalid file fails the build. The lesson route is statically generated.
- A unit test proves every step's reference answer passes, and that every glossary term in a prompt exists in `content/glossary.json`.

### Prompt markup

- `**bold**` renders as bold text.
- `` `=SUM(A1:A3)` `` renders as an LTR formula.
- `{{خلية}}` marks a glossary term. The English term is shown in brackets on its first use in a lesson. `{{الخلية}}` and `{{خلية}}` count as the same term.

### i18n in `packages/ui`

Components call next-intl's `useTranslations`, with next-intl as a peer dependency. All copy lives in `apps/web/messages/ar.json`, and UI tests render with that same file, so a missing key fails a test.

### Grid interaction

The grid is always LTR. Text cells use `dir="auto"`, so Arabic aligns right as in Excel.

**Keyboard**

- **Enter while editing** commits the entry. On ENTER_VALUE and ENTER_FORMULA steps, the commit is checked at once.
- **Enter while not editing** means Check; once the step is settled, it means Continue.
- **Tab** moves right inside the grid, as in Excel. At the grid's edge it leaves the grid, and in an unchanged formula bar it moves focus on. Keyboard users are never trapped (WCAG 2.1.2).

**Point mode**

While a formula is being typed, and the caret is after `=`, `(`, a separator or an operator:

- clicking or tapping a cell inserts its address,
- dragging inserts a range,
- clicking again replaces the reference just inserted.

This is the "tap-to-pick" from PLAN §1.6.

**Helper bar**

The on-screen keys and function chips show on narrow or touch screens. They never take focus, so the caret stays where it was.

### Guest progress

- Guest progress is stored in localStorage under `tamreen.progress.v1`, validated by `GuestProgressSchema`.
- Every read and write is wrapped in try/catch. A step that was already recorded earns no points again.
- The player resumes at the first unfinished step. This shape is the input for `POST /progress/sync` in Phase 4.

### Accessibility check

`pnpm --filter @tamreen/web a11y` runs Lighthouse on a running production build, using Playwright's Chromium. It fails if any page scores under 90. It is a manual step, not part of CI.

## Dependencies added

All are dev or peer dependencies:

- **MIT:** `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`, `jsdom`.
- **Apache-2.0:** `lighthouse` and `chrome-launcher`.

## Consequences

- SHORTCUT steps show a placeholder until Phase 6 adds key capture.
- The lesson page renders the player directly. Phase 5 moves it to a lazy client island for the performance budget.
- Native-Arabic review of the two lessons happens with the Phase 3 batch (PLAN §2.3).

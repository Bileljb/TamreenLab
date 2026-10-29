# PLAN — Arabic-first interactive Excel practice simulator

> This file is addressed to you, Claude Code. Read it fully at the start of every session, together with `CLAUDE.md`.

**What you are building:** a browser-based Excel practice site in Arabic: bite-sized lessons, a real spreadsheet grid, instant feedback, points and streaks.
**Stack:** Next.js (App Router, TypeScript) · Express (TypeScript) · PostgreSQL + Prisma.
**Money, for now:** display ads only. Do not build payments, subscriptions, premium gating, certificates or billing. They come later and are listed in section 8.

---

## 0. How you work with this plan

1. Work on exactly one phase at a time, in order. Do not build ahead, and do not build anything in section 8 (Deferred).
2. At the start of a phase, enter plan mode. Re-read the phase, write a short implementation plan (files to create or change, tests to write) and wait for the developer's approval.
3. During a phase: write tests first for the engine and API, make small conventional commits, and tick the checkboxes in this file in the same commit as the work.
4. A phase is done only when every acceptance criterion passes (typecheck, lint, tests and build, plus the phase's own criteria). Then tag `phase-N` and report to the developer in at most 10 lines: what shipped, what you could not do, decisions needed.
5. Ask the developer only when a decision from section 7 is needed, when this plan conflicts with what you find in the repo, or when an ambiguity would change the architecture. Otherwise choose the simplest option that satisfies the plan and record it in `docs/adr/`.
6. Never invent facts about the reference product. Items marked **[unknown]** in section 1 are unknown.

---

## 1. Reference product analysis (context only)

Another Excel practice site, excelexercises.com, is the reference for this product category. This section is all the context you need about it. You do not need to visit it, and you must never copy its text, data, images, CSS or code.

The findings come from its home and practice pages, search snippets of its certification and SQL pages, and a live run of its first lesson without signing up. Labels: **[seen]** observed directly, **[claim]** stated by the site, **[unknown]** could not be verified.

### 1.1 Positioning
- Message: learn Excel by doing, not by watching videos. Lessons take a few minutes each, practice runs in the browser, nothing to download. [seen]
- Free to start with no sign-up; an account is optional. [claim; the leaderboard text says you must log in to appear on it, seen]
- Founder-led brand with a personal story on the home page. [seen]
- Social proof: "250,000+ registered users", "50+ partner organizations" (company and university logos), three testimonials. [claim]
- Career framing: Excel tests in job applications, finance, accounting, consulting. [claim]
- Related offers: a separate SQL practice product with a browser SQL simulator, and a completion certificate for finishing the whole Excel course. [claim, from page snippets]

### 1.2 Product structure
- Pages: home → lesson dashboard (`lessons.html`) → lesson player (`practice.html?lesson=<id>`), plus login, register, marketing pages and a function-reference blog hub. [seen / from links]
- Curriculum: 85 lessons in one ordered list. [seen] Topics by theme:
  - Basics and selection: intro, cell selection shortcuts, arrow keys, row/column selection, fill right/down, AutoSum, number and text formatting shortcuts, cut/copy/paste, data shortcuts.
  - Aggregation: COUNT, SUM, SUMIF(S), wildcards, sum range, COUNTIF(S), AVERAGE, MIN/MAX/LARGE/SMALL, MEDIAN, MODE.
  - Logic: TRUE/FALSE, IF, AND/OR/XOR, IS functions, IFS, SWITCH, IF combinations.
  - Lookup: VLOOKUP (incl. approximate match), HLOOKUP, XLOOKUP (incl. wildcards), MATCH, INDEX, INDEX+MATCH.
  - Text: LEN/LEFT/RIGHT/MID, FIND, SEARCH, CONCAT, TEXTJOIN, UPPER/LOWER/PROPER, SUBSTITUTE, TEXTBEFORE/TEXTAFTER.
  - Dates: DATE, TODAY, DATEDIF, DAYS.
  - Tables and other: pivot tables, table filters, worksheets, conditional formatting, ODD/EVEN, FLOOR/CEILING, UNIQUE, FILTER, debugging SUM.
  - Two case studies at the end.
- Pedagogy loop: concept lesson → practice lesson → "skill summary" lesson, with later "more practice" lessons. [seen]

### 1.3 Lesson player (study this part most)
- Breadcrumb, lesson title and a progress bar. The first correct step moved the intro lesson to 20%, so about 5 steps per lesson. [seen]
- One instruction per step, key terms in bold, then one interactive task. [seen]
- Task types seen or implied by the page: click a target cell; type a formula or value into the grid (name box, formula bar, fx button); type an answer into a separate text box; keyboard-shortcut drills on the learner's own keyboard, with "may not work on Mac" and "mobile device detected" warnings, each with a "Skip section" button. [seen]
- Controls: Check Answer, Continue (both "or press enter"), Skip Question, Previous, Watch Video, Show Answer / Solution, "Show Correct Answer" after a wrong answer. [seen]
- Feedback bar: green "Correct! +N pts" on success (values seen: +415, +445; how they are computed is [unknown]) and an "Incorrect" alert on failure. [seen]
- "Formula Assistant": AI feedback on a wrong formula with helpful / not-helpful buttons and an "AI may be wrong" disclaimer. [seen]
- A link to download the spreadsheet file if the embedded one fails to load. [seen]
- Side panel: last completed, first-try accuracy, today's high scores, my points today, today's high streaks, my streak today. Leaderboards need an account. [seen]
- Share buttons, dark theme, animated points counter. [seen]

### 1.4 Technology of the reference
- Multi-page site, jQuery and Bootstrap, plain script files for answers, tables, leaderboard and stats. [seen]
- Lesson content loads client-side after the page renders. [seen]
- The spreadsheet is an embedded grid component; which one is [unknown].
- A script named `checkPremium.js` exists, so part of the content is gated. Price and gated lessons are [unknown].
- Whether answers are checked on the client or the server is [unknown].

### 1.5 What it does well (keep these qualities)
1. Zero friction: practice starts without an account.
2. One concept per step, instant feedback, short sessions.
3. A real spreadsheet feel (name box, formula bar, selection) instead of quizzes.
4. Retention mechanics: points, streaks, daily leaderboards.
5. A clear learn → practice → summary → case-study loop.
6. A content surface (function pages) that feeds the practice product.

### 1.6 Where this product should be different
- **Arabic first:** Arabic explanations and terminology, RTL layout.
- **Mobile:** the reference tells mobile users to skip shortcut lessons. Provide a touch-friendly formula entry mode (on-screen `= ( ) , : $` keys, tap-to-pick ranges).
- **SEO per lesson:** every lesson and every function gets its own indexable Arabic page, with explanatory text above the interactive part.
- **Local content:** local currencies, names and job-test style scenarios.

---

## 2. Product definition

**Core promise (Arabic):** "تعلّم إكسل بالتطبيق العملي — خطوات قصيرة، تصحيح فوري، بدون تسجيل".
**Audience (v1):** Arabic speakers (students, junior office workers), one primary country first (decision D2).

### 2.1 v1 scope
- 40–60 step-based lessons: cells and selection, SUM/AVERAGE/MIN/MAX/COUNT, IF/AND/OR, SUMIF(S)/COUNTIF(S), VLOOKUP/XLOOKUP, INDEX+MATCH, text and date basics.
- Step types: select cell, select range, enter value, enter formula, shortcut drill, multiple choice.
- Instant client-side feedback; authoritative server-side scoring.
- Guest mode (progress in localStorage) and accounts (email + password, JWT).
- Points, daily streak, daily leaderboard.
- Indexable Arabic lesson and function pages; display ads on content pages only.

### 2.2 Non-goals for v1
A full Excel clone, VBA, Power Query, charts, real-time multiplayer, and everything in section 8.

### 2.3 Content and IP rules
- All curriculum, wording, exercises, datasets, UI and branding must be original.
- Use the glossary in section 3.8. Content is reviewed by a native Arabic speaker before publishing; record reviewer and date in `docs/CONTENT.md`.

---

## 3. Architecture

### 3.1 Repo layout (pnpm workspaces + Turborepo)
```
/apps
  /web            Next.js App Router, Tailwind, next-intl (ar default, en later)
  /api            Express + TypeScript, Prisma, zod
/packages
  /engine         exercise engine: sheet model, formula adapter, checkers (pure TS, no DOM)
  /shared         zod schemas, DTO types, constants (step spec, API contracts)
  /ui             shared React components (SpreadsheetGrid, LessonPlayer)
/content
  /lessons        lesson files (JSON or YAML), the source of truth, validated and synced to Postgres
  /functions      function reference pages (MDX)
/docs             PLAN.md, CONTENT.md, adr/*.md
docker-compose.yml   (Postgres for local dev)
```

### 3.2 Why this split
- **Next.js** owns everything public and SEO-relevant (SSR/ISR pages, metadata, sitemap) and hosts the interactive lesson as a client island.
- **Express** owns auth, attempts, scoring, progress, leaderboards and (later) the AI assistant proxy. It keeps secrets and verification server-side and reuses the same `engine` package in Node.
- **Same-origin API:** use Next `rewrites` so the browser calls `/api/*` on the web domain, proxied to Express. This avoids CORS and keeps auth cookies first-party.
- **One engine, two runtimes:** the browser runs it for instant feedback; the API re-runs it to award points.

### 3.3 Technical decisions
| # | Decision | Default | Notes |
|---|---|---|---|
| T1 | Formula evaluation | An adapter interface `FormulaEngine`; in Phase 0 compare HyperFormula with a small custom evaluator | HyperFormula is TypeScript with about 400 functions, licensed GPLv3 or under a paid proprietary license. A closed-source commercial site needs the paid license or another engine. Check the license of any alternative before choosing, and record the choice in `docs/adr/001-formula-engine.md`. |
| T2 | Grid component | Build a lightweight React grid (small sheets, up to about 30×12) | Needs: name box, formula bar, single and range selection, arrow-key navigation, cell editing, RTL-safe chrome, touch support. No heavy commercial grid in v1. |
| T3 | Answer checking | Client-side check for instant feedback, server-side re-check for points | The check spec is shipped to the client. Leaderboard integrity is best-effort; server re-verification stops trivial score forging. |
| T4 | Hard-coded answer defence | Variant datasets: evaluate the learner's formula on 2–3 alternate datasets and compare with the recomputed expected values | Stops `=450` when a SUMIF is required. |
| T5 | Auth | Email + password, JWT access token and refresh token in httpOnly cookies, argon2 or bcrypt | Social sign-in is deferred. |
| T6 | Guest progress | localStorage, merged into the account on sign-up or login via `POST /progress/sync` | The leaderboard requires an account. |
| T7 | Content authoring | Files in `/content`, validated with zod, synced to Postgres with `pnpm content:sync` | No admin UI in v1; git is the CMS. |
| T8 | i18n and RTL | `next-intl`, `dir="rtl"`, Tailwind logical utilities (`ms-*`, `me-*`, `ps-*`, `pe-*`), Arabic font via `next/font` (Cairo or Tajawal) | Formulas and cell references are always LTR (`dir="ltr"` or `<bdi>`). The grid is LTR by default. |
| T9 | Argument separators | Accept both `,` and `;` in learner input and normalise before evaluation | Regional settings differ; never fail a learner over a separator. |
| T10 | Hosting | Web on a Next-friendly host; API and Postgres on a managed provider in a region close to MENA (for example EU) | Decision D3. |

### 3.4 Data model (Prisma sketch)
```prisma
enum Role { USER ADMIN }
enum LessonKind { CONCEPT PRACTICE SUMMARY CASE_STUDY }
enum StepType { SELECT_CELL SELECT_RANGE ENTER_VALUE ENTER_FORMULA SHORTCUT MULTIPLE_CHOICE }
enum PublishStatus { DRAFT PUBLISHED }

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  displayName  String
  role         Role     @default(USER)
  locale       String   @default("ar")
  createdAt    DateTime @default(now())
  attempts     Attempt[]
  progress     LessonProgress[]
  points       PointEvent[]
  streak       Streak?
}

model Track {
  id       String  @id @default(cuid())
  slug     String  @unique
  titleAr  String
  order    Int
  lessons  Lesson[]
}

model Lesson {
  id          String        @id @default(cuid())
  trackId     String
  track       Track         @relation(fields: [trackId], references: [id])
  slug        String        @unique
  order       Int
  kind        LessonKind
  titleAr     String
  summaryAr   String
  minutes     Int
  status      PublishStatus @default(DRAFT)
  seoJson     Json?         // title, description, faq for the lesson page
  steps       Step[]
  progress    LessonProgress[]
}

model Step {
  id         String   @id @default(cuid())
  lessonId   String
  lesson     Lesson   @relation(fields: [lessonId], references: [id])
  order      Int
  type       StepType
  promptAr   String   // markdown-lite, glossary terms marked
  sheetJson  Json     // initial cells, visible range, formats
  checkJson  Json     // check spec (see 3.5)
  hintAr     String?
  explainAr  String?
  basePoints Int      @default(300)
  attempts   Attempt[]
  @@unique([lessonId, order])
}

model Attempt {
  id        String   @id @default(cuid())
  userId    String
  stepId    String
  correct   Boolean
  firstTry  Boolean
  timeMs    Int
  answer    Json
  createdAt DateTime @default(now())
  user User @relation(fields: [userId], references: [id])
  step Step @relation(fields: [stepId], references: [id])
  @@index([userId, stepId])
}

model LessonProgress {
  userId       String
  lessonId     String
  stepsDone    Int      @default(0)
  completedAt  DateTime?
  firstTryRate Float?
  @@id([userId, lessonId])
}

model PointEvent {            // ledger: leaderboards are SUM() by day
  id        String   @id @default(cuid())
  userId    String
  delta     Int
  reason    String
  day       DateTime @db.Date
  createdAt DateTime @default(now())
  @@index([day, userId])
}

model Streak {
  userId      String @id
  current     Int    @default(0)
  longest     Int    @default(0)
  lastDay     DateTime? @db.Date
}
```
Do not add subscription, premium or certificate fields now. They are added by later migrations (section 8).

### 3.5 Step and check spec (in `packages/shared`, validated with zod)
```jsonc
{
  "slug": "sumif-basics-03",
  "type": "ENTER_FORMULA",
  "promptAr": "اكتب في الخلية D2 معادلة تجمع مبيعات المنتج «قلم» فقط.",
  "sheet": {
    "visible": "A1:D8",
    "cells": { "A1": "المنتج", "B1": "المبيعات", "A2": "قلم", "B2": 120 /* … */ },
    "formats": { "B2:B8": "number" }
  },
  "check": {
    "target": "D2",
    "expected": { "value": 450 },
    "mustUseFunctions": ["SUMIF"],
    "mustNotUseFunctions": ["SUMPRODUCT"],
    "variants": [ { "cells": { "B2": 10, "B3": 20 } } ],   // learner formula must still match the recomputed answer
    "acceptEquivalentRefs": true                            // A2:A8 equals $A$2:$A$8
  },
  "hintAr": "…",
  "explainAr": "…",
  "basePoints": 300
}
```
Other step types: `SELECT_CELL {target}`, `SELECT_RANGE {target}`, `ENTER_VALUE {expected, tolerance}`, `SHORTCUT {combos: [{win, mac}], blockedInBrowser?: bool}`, `MULTIPLE_CHOICE {options, correct}`.

**Feedback codes** (the engine returns a code; the UI maps it to Arabic copy): `OK`, `WRONG_VALUE`, `WRONG_CELL`, `MISSING_FUNCTION`, `FORBIDDEN_FUNCTION`, `HARDCODED_VALUE`, `SYNTAX_ERROR`, `REF_ERROR`, `NAME_ERROR`, `NA_ERROR`, `DIV0`, `TIMEOUT`.

**Scoring:** base points + capped speed bonus + first-try bonus; reduced after a shown hint; zero if "Show Answer" was used. Keep it in one pure function with tests.

### 3.6 API surface (Express, under `/api`)
```
POST /auth/register  POST /auth/login  POST /auth/refresh  POST /auth/logout   GET /me
GET  /tracks         GET /lessons?track=   GET /lessons/:slug
POST /attempts                    {stepId, answer, timeMs} -> {correct, code, pointsAwarded, firstTry}
POST /progress/sync               {guestProgress[]} -> merged progress
GET  /me/progress    GET /me/stats
GET  /leaderboard/daily?limit=20
POST /assistant/hint              (Phase 8)
```
Cross-cutting: zod validation on every route, `helmet`, rate limits (stricter on auth and attempts), structured logging, one consistent error shape, OpenAPI generated from the zod schemas.

### 3.7 Public routes (Next.js)
```
/[locale]                         landing page
/[locale]/lessons                 curriculum map (public, indexable)
/[locale]/lessons/[track]/[slug]  lesson page: Arabic explanation (SSR/ISR) + interactive player (client island)
/[locale]/functions/[fn]          function reference (syntax, arguments, examples, errors, link to practice)
/[locale]/shortcuts               shortcut cheat sheets
/[locale]/about  /privacy  /terms  /contact
/sitemap.xml  /robots.txt         generated; hreflang and canonical on every page; JSON-LD per page type
```

### 3.8 Arabic glossary (keep in `/content/glossary.json`; enforce in `content:lint`)
cell = خلية · column = عمود · row = صف · range = نطاق · formula = معادلة · function = دالة · argument = وسيط · reference = مرجع · worksheet = ورقة عمل · workbook = مصنف · pivot table = جدول محوري · fill handle = مقبض التعبئة · name box = مربع الاسم.
Show the English term in brackets on first use per lesson, because learners often use the English Excel interface.

---

## 4. Phases

Durations are rough planning estimates, not deadlines. Each phase ends with a commit tagged `phase-N`.

### Phase 0 — Foundations and decisions (2–3 days)
**Goal:** a clean monorepo, working local dev, and the decisions that are expensive to change later.
**Tasks**
- [x] Scaffold the pnpm + Turborepo workspace per 3.1; TypeScript strict; ESLint, Prettier; Vitest; Playwright with an empty smoke test.
- [x] Create `CLAUDE.md` at the repo root from section 9, and copy this file to `docs/PLAN.md`.
- [x] `docker-compose.yml` with Postgres; Prisma initialised with the schema in 3.4; first migration; seed script stub.
- [x] `apps/web`: Next.js + Tailwind + next-intl, `dir="rtl"`, Arabic font, a placeholder RTL home page, and a Next rewrite from `/api/*` to Express.
- [x] `apps/api`: Express + zod + helmet + a health route + error middleware.
- [x] CI (GitHub Actions): install, typecheck, lint, test, build.
- [x] **Spike:** implement the same 15 test formulas (SUM, IF, SUMIF, COUNTIFS, VLOOKUP, XLOOKUP, INDEX/MATCH, LEFT/MID/FIND, DATEDIF) with HyperFormula and with a small custom evaluator; compare function coverage, bundle size, correctness and license; write `docs/adr/001-formula-engine.md`.
**Acceptance**
- [ ] `pnpm dev` starts web, api and db; `pnpm test` and `pnpm build` pass in CI.
- [x] The Arabic RTL home page renders, and a formula inside Arabic text stays LTR.
- [x] ADR 001 exists with a clear recommendation and a license note.
**Stop and ask:** present the spike results to the developer before choosing the formula engine (decision D4).

### Phase 1 — Exercise engine (1–2 weeks) — the riskiest phase
**Goal:** a framework-free package that loads a step spec and decides whether an answer is correct, with useful feedback codes.
**Tasks**
- [ ] `packages/shared`: zod schemas for the step spec and attempt payloads. Write these first.
- [ ] `packages/engine`: `Sheet` model (A1 parsing, ranges, typed cell values), the `FormulaEngine` adapter from ADR 001, and normalisation (leading `=`, whitespace, case, `,` vs `;`, equivalent absolute/relative references when `acceptEquivalentRefs`).
- [ ] Checkers: `SELECT_CELL`, `SELECT_RANGE`, `ENTER_VALUE` (with tolerance), `ENTER_FORMULA` (expected value, must/must-not-use functions, variant datasets), `MULTIPLE_CHOICE`, `SHORTCUT` (key-combo matching only; browser capture is Phase 6).
- [ ] The feedback codes from 3.5, and a function that extracts the functions used in a formula.
- [ ] Table-driven tests, at least 120 cases: correct answers, equivalent answers, hard-coded answers, wrong ranges, syntax errors, `#N/A`, separators, Arabic text in cells.
**Acceptance**
- [ ] All tests pass; coverage on `packages/engine` is at least 90%.
- [ ] The package runs in Node and in a browser bundle with no Node-only imports.
- [ ] A hard-coded `=450` fails a SUMIF step through the variant check.
**Report:** coverage, and any function the engine cannot support.

### Phase 2 — Grid and lesson player (1–2 weeks)
**Goal:** a complete lesson playable in the browser with guest progress, no API calls yet.
**Tasks**
- [ ] `SpreadsheetGrid` in `packages/ui`: column and row headers, name box, formula bar, cell selection, range selection (drag and shift+arrows), arrow/Tab/Enter navigation, edit mode, copy/paste of values, accessible roles, touch support.
- [ ] Mobile formula helper bar: on-screen `=  (  )  ,  :  $  "` keys and quick insert of function names.
- [ ] `LessonPlayer`: progress bar, prompt with glossary highlighting, Check / Continue (Enter), Skip, Previous, hint, Show Answer, feedback bar with points, step transitions, keyboard-first flow.
- [ ] A lesson state reducer; guest progress in localStorage under a versioned key.
- [ ] Two hand-written lessons (cells and selection; SUM) loaded from `/content/lessons`.
- [ ] Playwright e2e: complete both lessons by keyboard; complete one on a mobile viewport.
**Acceptance**
- [ ] Both lessons complete end to end with correct and incorrect feedback, with the API not running.
- [ ] The layout is correct in RTL on desktop and on a 390px-wide phone, with no horizontal scroll.
- [ ] Lighthouse accessibility score is at least 90 on the lesson page.
**Report:** save Playwright screenshots at 390px, 768px and 1280px to `docs/screenshots/phase-2/` for the developer to review.

### Phase 3 — Content pipeline and first curriculum (1–2 weeks; can overlap Phase 4)
**Goal:** author lessons as files, validate them, load them into Postgres.
**Tasks**
- [ ] Content format (JSON or YAML) = the step spec from 3.5 plus lesson metadata. `pnpm content:lint` validates with zod, runs a reference solution for every step through the engine, checks glossary terms, and rejects empty or duplicated step prompts.
- [ ] `pnpm content:sync` upserts tracks, lessons and steps into Postgres, idempotently.
- [ ] `docs/CONTENT.md`: step-writing rules (one idea per step, 5–8 steps per lesson, worked example first), Arabic style (neutral Modern Standard Arabic, short sentences, English term in brackets on first use), dataset rules (original data, local currencies and names).
- [ ] Author the first 20 lessons: cells and selection (3), SUM/AVERAGE/MIN/MAX/COUNT (5), IF/AND/OR (3), SUMIF/COUNTIF (4), VLOOKUP (3), two summary lessons.
**Acceptance**
- [ ] `content:lint` passes with 0 errors and every step has a verified reference solution.
- [ ] Running `content:sync` twice produces no diff.
**Stop and ask:** the developer arranges the native-Arabic review of the 20 lessons. Record reviewer and date in `docs/CONTENT.md` before they are published.

### Phase 4 — Backend: auth, attempts, progress, scoring (1–2 weeks)
**Goal:** accounts, server-verified attempts, points, streaks, a daily leaderboard.
**Tasks**
- [ ] Auth endpoints (T5): hashing, refresh rotation, logout, account deletion.
- [ ] `GET /lessons` and `GET /lessons/:slug`. `POST /attempts` re-verifies with `packages/engine`, records the attempt, writes a `PointEvent`, and updates `LessonProgress` and `Streak`. Decide and document how a "day" is defined for streaks (for example a fixed UTC+3, or the user's timezone) in an ADR.
- [ ] `POST /progress/sync`: idempotent, ignores steps already completed, caps points per merge.
- [ ] `GET /leaderboard/daily` (aggregate over `PointEvent`), display-name rules, basic moderation (length, blocked-word list).
- [ ] Rate limiting, validation, error shape, OpenAPI at `/api/docs`.
- [ ] Wire the web app to the API: login and register pages, progress, stats, leaderboard panel.
- [ ] supertest integration tests for every route, including a test proving a forged "correct" claim from the client earns no points.
**Acceptance**
- [ ] A new user can play as a guest, register, and keep their progress.
- [ ] Resubmitting the same correct step does not award points twice.
- [ ] Integration tests are green.

### Phase 5 — Public site, SEO, ads, metrics (1–2 weeks)
**Goal:** every lesson and function is an indexable Arabic page, the site is fast, ad slots are in place, and usage can be measured.
**Tasks**
- [ ] Landing page, curriculum page, lesson pages (SSR/ISR: Arabic explanation, example, FAQ; the player loads as a client island via `dynamic(..., { ssr: false })`), function pages from `/content/functions` (MDX), shortcut pages, about/privacy/terms/contact.
- [ ] Metadata per page, canonical, hreflang, JSON-LD (`Course` or `LearningResource` for lessons, `FAQPage` where there is an FAQ), `sitemap.xml`, `robots.txt`, OG images via `next/og`.
- [ ] Performance budget on the lesson page, on a mid-range phone profile: LCP under 2.5s and CLS under 0.1. The grid code is lazy-loaded.
- [ ] Analytics with events `lesson_start`, `step_correct`, `step_incorrect`, `lesson_complete`, `signup`.
- [ ] `pnpm metrics:report`: prints activation (visitors who complete the first lesson), 7-day return rate, median steps per session, and per-lesson step drop-off.
- [ ] Ads: a consent banner and a provider-agnostic `<AdSlot>` component with reserved space (no layout shift), used on explanation and summary areas and between lessons. Never place an ad inside or beside the exercise grid. The ad network is chosen later (decision D5).
- [ ] Write 15 function pages (SUM, IF, SUMIF, COUNTIF, VLOOKUP, XLOOKUP, INDEX, MATCH, LEFT, RIGHT, MID, FIND, TODAY, DATEDIF, IFERROR), each with a "Practice this" link.
**Acceptance**
- [ ] All pages return 200 and are indexable (no `noindex`); the sitemap is valid.
- [ ] Lighthouse SEO is at least 95 and mobile performance at least 85 on lesson and function pages.
- [ ] No ad slot appears inside the exercise area, and CLS stays under 0.1 with ad slots enabled.
**Report:** a launch checklist for the developer (Search Console, ad account, analytics, consent text).

> **Launch gate (after Phase 5):** the developer publishes to one country's communities and reviews real metrics for several weeks (section 5) before deciding what to build next. Do not start Phase 6 until the developer says so.

### Phase 6 — Shortcut drills (about 1 week)
**Goal:** keyboard-shortcut practice that fails gracefully.
**Tasks**
- [ ] Capture `keydown` combos with `preventDefault` where the browser allows it. Keep a `blockedInBrowser` list of combos the browser reserves (for example new-tab and close-tab keys); those steps become multiple choice automatically.
- [ ] Windows and Mac variants, with platform auto-detection and a manual switch.
- [ ] On mobile, replace shortcut drills with "pick the right command" steps.
- [ ] 6–8 shortcut lessons: selection, fill, AutoSum, formatting, navigation.
**Acceptance**
- [ ] Every shortcut step is either capturable in Chrome and Firefox on Windows, or automatically downgraded to multiple choice.

### Phase 7 — Engagement (about 1 week)
**Tasks**
- [ ] Levels and a daily goal; optional streak freeze; a "review mistakes" mode that re-queues missed steps with simple spacing; opt-in email capture with a weekly reminder; a share-your-result card via `next/og`.
**Acceptance**
- [ ] The returning-user flow works, the unsubscribe link works, and no email is sent without opt-in.

### Phase 8 — AI formula assistant (about 1 week)
**Goal:** Arabic hints after a wrong formula, with cost controls.
**Tasks**
- [ ] `POST /assistant/hint`: input is the step prompt, the learner's formula and the engine feedback code; call the Claude API; return a short Arabic explanation that does not reveal the exact answer unless "Show Answer" was used.
- [ ] Cache by (stepId, normalised formula); per-user and per-IP daily quotas; timeouts; fall back to the static `hintAr`.
- [ ] Helpful / not-helpful buttons stored for review, and a visible "AI can be wrong" note.
**Acceptance**
- [ ] p95 latency under 4s; a spend cap exists and is tested; with the API unreachable, the static hint appears.

### Phase 9 — Hardening and launch (about 1 week)
**Tasks**
- [ ] Security pass: OWASP basics, dependency audit, secrets management, CSRF strategy, password-reset flow.
- [ ] Backups with a tested restore, error tracking, uptime checks, structured logs.
- [ ] Accessibility pass: keyboard-only use, screen-reader labels for the grid.
- [ ] Cookie consent and privacy policy suitable for the target countries.
- [ ] Load test `POST /attempts` and the leaderboard query; add indexes as needed.
**Acceptance**
- [ ] A restore from backup is demonstrated, and no critical findings remain open.

---

## 5. Metrics (for the developer's launch review)

You instrument and report; the developer sets targets and makes the go/no-go call. Do not decide for them.
- **Activation:** share of visitors who complete the first lesson (starting guess: at least 30%).
- **Retention:** share who return within 7 days (starting guess: at least 15%).
- **Depth:** median steps per session; lessons completed per returning user.
- **Acquisition:** organic clicks and impressions by page type; number of indexed pages.
- **Ads:** revenue per 1,000 page views by country. Expect it to be low in this region, so do not trade user experience for ad revenue.

## 6. Risks

1. The engine may under-support some Excel behaviours (errors, array spills, dates). Restrict the curriculum to what the engine verifies, and expand deliberately.
2. Content volume is the real cost. Ship 20 lessons first and improve from step-level drop-off data.
3. SEO takes months. Ship function pages early and track indexation weekly.
4. Competitors may already offer parts of this in Arabic. Differentiate on depth, feedback quality and the mobile experience.
5. Browsers reserve some shortcuts (Phase 6). Downgrade those steps gracefully.

## 7. Decisions that belong to the developer (record each as an ADR in `docs/adr/`)

- **D1** Brand name and domain.
- **D2** First target country, and a dialect-neutral writing style.
- **D3** Hosting regions and providers.
- **D4** Formula engine and, if HyperFormula, whether to buy its commercial license.
- **D5** Ad network and consent approach.

## 8. Deferred (do not build; the developer will request these later)

- Payments, subscriptions, billing webhooks, plan management, and any payment provider.
- Free vs paid tiers, premium lessons, server-side entitlement checks, an ad-free paid option, and a pricing page.
- Completion certificates and a public certificate verification page.
- Team and B2B accounts.
- Social sign-in, and an English UI.
- Pivot-table and formatting simulations.

When these are requested, add them with new migrations and new phases; do not leave placeholder tables or fields for them now.

---

## 9. `CLAUDE.md` template (create this at the repo root in Phase 0)

```md
# Project: Arabic-first interactive Excel practice simulator

## Stack
pnpm workspaces + Turborepo · Next.js App Router (apps/web) · Express (apps/api) · PostgreSQL + Prisma · TypeScript strict everywhere · Vitest · Playwright · zod

## Rules
- Follow docs/PLAN.md. Work on one phase at a time; do not build ahead. Never build anything listed under "Deferred" in the plan.
- Business logic for exercises lives only in packages/engine. Never duplicate it in the web or api apps.
- The API is authoritative for points. Never trust a client-supplied "correct" flag.
- All user-facing text is Arabic, via next-intl message files. No hard-coded UI strings.
- RTL by default: use Tailwind logical utilities (ms/me/ps/pe), never left/right. Formulas, cell references and code always render with dir="ltr".
- Validate every API input and every content file with zod.
- Write tests first for engine and API changes. A change is done when typecheck, lint, tests and build pass.
- Content must be original. Never copy text, data, images, CSS or code from other sites.
- Do not add dependencies without checking their license; record any license that is not MIT, Apache-2.0 or BSD in docs/adr/.
- Small commits with conventional commit messages. Update the PLAN.md checkboxes in the same commit as the work.
- Ask the developer only for decisions listed in the plan, real conflicts, or architecture-changing ambiguity.

## Commands
pnpm dev · pnpm test · pnpm typecheck · pnpm lint · pnpm build · pnpm content:lint · pnpm content:sync · pnpm db:migrate · pnpm metrics:report
```

---

## 10. Sources (provenance of section 1)

- https://excelexercises.com/
- https://excelexercises.com/excel-practice-online.html
- https://excelexercises.com/certification.html (snippet)
- https://excelexercises.com/sql.html (snippet)
- https://hyperformula.handsontable.com/docs/guide/licensing.md
- https://coddy.tech/playground/ar/excel (an Arabic interactive Excel playground that already exists)
- https://spreadsheetcenter.com/ (an English interactive Excel practice site)

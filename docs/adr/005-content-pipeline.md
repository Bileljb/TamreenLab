# ADR 005 — Content pipeline: lint, sync and step identity

- **Status:** accepted
- **Date:** 2026-10-30
- **Decider:** Claude Code (within plan defaults)

## Context

Phase 3 makes the files in `/content` the curriculum's source of truth (PLAN T7). They are validated by `pnpm content:lint` and loaded into Postgres by `pnpm content:sync`. The plan does not settle:

- where this code lives,
- how tracks get their Arabic titles,
- how steps are identified in the database,
- how "running sync twice produces no diff" is guaranteed,
- how publishing is gated on the native-Arabic review.

## Decision

### One Node-only package, `packages/content`

`packages/content` holds three things:

- the file reader and validated loader,
- the linter,
- `planSync`, which is pure.

The web app's lesson pages and the API's sync script both use the same loader. The package uses `node:fs`, so it is never bundled for the browser.

### Content files

- `content/lessons/<track>/<slug>.json` holds one lesson.
- `content/tracks.json` holds each track's Arabic title and order.
- `content/glossary.json` maps Arabic terms to English ones (PLAN §3.8).
- `content/style.json` lists discouraged words and the glossary term to use instead.

A lesson has `"status": "DRAFT"` by default. Lint rejects `PUBLISHED` unless the lesson's slug is in the review log of `docs/CONTENT.md`.

### Lint rules

All rules are errors and fail CI:

- **Valid files:** every file passes its zod schema; the file path matches the lesson's track and slug; lesson slugs and orders are unique.
- **Solvable:** every step's reference answer passes its own check. Every formula solution verifies, uses only `SUPPORTED_FUNCTIONS`, and contains its `mustUseFunctions`.
- **Hard-coding is catchable:** targets are inside the visible range. Formula steps that read cells have at least one variant that changes the solution's result. Without one, a typed number could not be caught.
- **Wording:** prompts are non-empty and unique across the curriculum; every glossary term resolves; discouraged words are rejected.
- **Length:** each lesson has 5–8 steps.

**Matching Arabic words:**

- **Glossary terms** match through `glossaryTermKey`, shared with the prompt renderer. The article, harakat and the tanween alif are ignored, so `{{مرجعًا}}` finds `مرجع`.
- **Discouraged words** match whole words only, including attached prepositions and the article. `بالصيغة` is caught, but `صيغتها` is not.

### Steps are identified by slug

The migration `step_slug` adds `Step.slug`, unique per lesson. Sync matches steps by `(lesson slug, step slug)`, never by position:

- reordering steps updates rows instead of re-pointing past attempts to different questions;
- Phase 4's `POST /progress/sync` can map the step slugs in guest progress to database ids.

### Sync is a pure plan plus a transaction

- `planSync(desired, current)` compares every field, with JSON compared after sorting keys. It returns create, update and delete operations. When the database already matches, it returns none; this is unit-tested.
- `apps/api/scripts/content-sync.ts` reads the database, applies the plan in one transaction and prints the counts.
- It refuses to delete a step with attempts, or a lesson with learner progress. Removing used content is a manual decision.
- When step orders change, the lesson's existing orders are first moved out of the way, so the `(lessonId, order)` unique index never collides partway through.
- `--dry-run` prints the plan without writing, and `CONTENT_DIR` points the script at another content folder.

The migration was generated with `prisma migrate diff` and applied with `migrate deploy`, because `migrate dev` refuses to run without an interactive terminal.

### Verified on local Postgres

On local Postgres (docker compose):

- Syncing the 20 lessons applied 128 changes; the second run reported 0 changes.
- Reordering, removing and restoring steps also converged to 0 changes on the next run.

## Consequences

- Lessons are written as JSON by hand or with a script. A one-off authoring helper was used for the first 20 lessons and is not kept in the repo; the JSON files are the source.
- The web app still lists DRAFT lessons. Phase 5 decides what the public site shows.
- CI runs `content:lint` but not `content:sync`, because CI has no database.

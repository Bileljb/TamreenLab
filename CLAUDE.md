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

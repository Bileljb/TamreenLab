# ADR 002 — Workspace layout and toolchain pins

- **Status:** accepted
- **Date:** 2026-10-29
- **Decider:** Claude Code (within plan defaults)

## Context

Phase 0 needs a monorepo that builds the same way on a Windows laptop and in CI, with internal packages shared by Next.js and Express. Several tools released new majors recently, and not all of their plugins have caught up.

## Decision

### Internal packages ship as TypeScript source

`packages/*` export `./src/index.ts` directly and have no build step.

- `apps/web` compiles them through `transpilePackages`.
- `apps/api` is bundled with esbuild (`apps/api/build.mjs`). Workspace packages are bundled in, and every other dependency stays external.
- In dev the API runs with `node --watch --import tsx`. `tsx watch` hung under Turborepo on Windows, so it is not used.
- Everything uses `moduleResolution: "Bundler"`, so imports need no `.js` extensions.

### Version pins (exact versions in package.json)

| Tool       | Pinned  | Why not latest                                                                                                                                                                                                                                                 |
| ---------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript | 6.0.3   | typescript-eslint 8.72 supports `<6.1`; TS 7 is not supported yet.                                                                                                                                                                                             |
| ESLint     | 9.39.5  | eslint-plugin-react and eslint-plugin-import (used by eslint-config-next) do not declare ESLint 10 support.                                                                                                                                                    |
| Prisma     | 7.10.1  | npm `latest` points to an 8.0 release candidate. Prisma 7 uses `prisma.config.ts`, the `prisma-client` generator and the `@prisma/adapter-pg` driver adapter.                                                                                                  |
| next-intl  | 4.13.7  | 4.14 depends on `@swc/core` 1.16. Its new native-binding loader copies the addon into `%LOCALAPPDATA%\swc` and Windows refuses to load it there (`LoadLibraryExW failed`). 4.13.7 uses `@swc/core` 1.15.47, which loads normally. Revisit when swc fixes this. |
| Next.js    | 16.4.3  | latest. Locale middleware lives in `src/proxy.ts` (Next 16 naming).                                                                                                                                                                                            |
| pnpm       | 10.34.9 | Pinned via `packageManager`, installed with `npm i -g` because corepack could not write to Program Files.                                                                                                                                                      |

### Licences outside MIT / Apache-2.0 / BSD / ISC (production dependency tree)

| Package                         | Licence                          | Pulled in by                          | Assessment                                                          |
| ------------------------------- | -------------------------------- | ------------------------------------- | ------------------------------------------------------------------- |
| `@img/sharp-*` (libvips)        | Apache-2.0 AND LGPL-3.0-or-later | `next` → `sharp` (image optimisation) | Dynamically linked, unmodified. Standard for every Next.js app. OK. |
| `caniuse-lite`                  | CC-BY-4.0                        | `next` (browserslist data)            | Data only, build time. OK.                                          |
| `elkjs`                         | EPL-2.0                          | `prisma` CLI → `@prisma/studio-core`  | Dev tool (Prisma Studio), not shipped to browsers. OK.              |
| `postgres`, `robust-predicates` | Unlicense                        | `prisma` CLI                          | Public-domain equivalent. OK.                                       |
| `@visx/vendor`                  | MIT and ISC                      | Prisma Studio                         | Permissive. OK.                                                     |

The formula-engine licence is a product decision (D4) and is covered in ADR 001.

## Consequences

- Bumping TypeScript to 7 or ESLint to 10 waits on typescript-eslint and the React/import plugins.
- Upgrading next-intl past 4.13 must be tested on Windows first.
- A new internal package needs no build configuration. Add it to `transpilePackages` if the web app imports it.

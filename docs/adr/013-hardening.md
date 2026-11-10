# ADR 013 — Hardening: security, operations, accessibility and load

- **Status:** accepted
- **Date:** 2026-11-10
- **Decider:** Claude Code, within PLAN Phase 9. The developer asked for Phase 9 without the hosting work, which stays theirs.

## Licences

`@axe-core/playwright` and `axe-core` 4.14.0 are **MPL-2.0**.

- They are development dependencies of `apps/web`, used only by the end-to-end accessibility tests.
- They are never bundled into the site and never shipped to learners.
- MPL-2.0 is file-level copyleft. It only applies if those files are modified and distributed, which this project does not do.

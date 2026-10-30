# ADR 003 — Step spec additions and answer checking rules

- **Status:** accepted
- **Date:** 2026-10-30
- **Decider:** Claude Code (within plan defaults)

## Context

Phase 1 turns the step spec in PLAN §3.5 into zod schemas (`packages/shared`) and builds the checkers (`packages/engine`). A few points are not settled by the plan:

- how variant datasets get their expected values,
- which feedback code wins when an answer is wrong in several ways,
- what counts as "hard-coded",
- what `acceptEquivalentRefs: false` means,
- how a pathological formula is stopped.

## Decision

### `check.solution` on ENTER_FORMULA steps

Each formula step has a reference formula, `solution` (for example `=SUMIF(C2:C9,"قلم",D2:D9)`).

- On the base sheet, `solution` must give `expected.value`. `expected.value` stays in the file so authors can read the answer without running anything.
- On each variant, `solution` is re-run, and its result is that variant's expected value. This is how T4's "recomputed expected values" are computed.
- `verifyReferenceSolution(step)` runs the solution through the step's own checker. `content:lint` (Phase 3) will call it for every step.

### Order of checks and feedback codes (ENTER_FORMULA)

The first rule that fails decides the code:

1. Answer in a cell other than `target` → `WRONG_CELL`.
2. Empty, or does not parse → `SYNTAX_ERROR`.
3. Uses a function from `mustNotUseFunctions` → `FORBIDDEN_FUNCTION`.
4. Reads no cell, while the solution does (`=450`, `=120+200+130`) → `HARDCODED_VALUE`.
5. Missing a function from `mustUseFunctions` → `MISSING_FUNCTION`.
6. Evaluates to an Excel error. `#REF!` → `REF_ERROR`, `#NAME?` → `NAME_ERROR`, `#N/A` → `NA_ERROR`, `#DIV/0!` → `DIV0`, step budget exceeded → `TIMEOUT`. Any other error (`#VALUE!`, `#NUM!`, a cycle) → `WRONG_VALUE`.
7. Value differs from `expected.value` → `WRONG_VALUE`.
8. On any variant, the result differs from the solution's result → `HARDCODED_VALUE`.
9. `acceptEquivalentRefs: false` and the `$` anchoring differs from the solution → `WRONG_VALUE`.
10. Otherwise → `OK`.

Rule 4 comes before rule 5 on purpose. For `=450` on a SUMIF step, "you typed the result" is more useful feedback than "use SUMIF". Rule 8 catches the rest: a formula that reads cells but only fits this data, such as `=450+Z99` or `=SUMIF(C2:C2,"قلم",D2:D2)+330`.

The learner's formula is evaluated _in its target cell_, so a formula that refers to its own cell is a cycle, as in Excel.

### Comparing values

- **Numbers:** within `tolerance` when the step sets one. Otherwise within 1e-9 relative, which absorbs only floating-point noise. An empty result counts as 0.
- **Text:** ignores case, surrounding and repeated spaces, tashkeel and tatweel. `الرّياض` and `الريـاض` both match `الرياض`.
- **Booleans:** must be booleans. The number `1` is not `TRUE`.
- **Typed values (ENTER_VALUE):**
  - Arabic-Indic and Persian digits are accepted, as are `٫` and `.` decimals, `1,250.5` thousands separators, and `5%` or `٥٪` for 0.05.
  - `TRUE`/`FALSE` and `صحيح`/`خطأ` are accepted for booleans.

### `acceptEquivalentRefs: false`

This is for lessons that teach `$`. Every cell that both the learner and the solution reference must have the solution's anchoring. With the solution `=D2*$I$3`:

- `=$I$3*D2` passes.
- `=D2*I3` and `=D2*I$3` fail.

When the flag is `true` (the default), `$` never matters, because only values are compared.

### Keyboard input

The aim is that no learner fails because of their keyboard (T9).

- **Arabic layouts:** outside string literals, Arabic-Indic digits are mapped to ASCII, and `؛` and `،` work as argument separators, as do `;` and `,`.
- **Unquoted text:** a name made of Arabic letters, such as `قلم` typed without quotes, is a name, so it evaluates to `#NAME?` as in Excel, not to a syntax error.
- **Shortcuts:** answers carry `KeyboardEvent.code` as well as `key`. On an Arabic layout, Ctrl+L reports `key: "م"` and `code: "KeyL"`.

### Evaluation budget

Each evaluation may visit at most 50,000 AST nodes and cells (`DEFAULT_BUDGET`).

- A range is charged for its full size before any cell is read, so `=SUM(A1:XFD1048576)` stops at once.
- When the budget runs out, the result is `TIMEOUT`. It is not an Excel error, so `IFERROR` and nested cells cannot turn it into a value.
- Addresses outside Excel's grid give `#REF!`.

### Answers

- `checkAnswer(step, answer)` validates the answer against the step type's schema. An answer of the wrong shape throws `InvalidAnswerError`; the API will turn it into a 400.
- `AttemptRequest` is a strict object, so a client-supplied `correct` flag is rejected.

## Consequences

- Every formula step needs a `solution`. Authors write it once, and lint verifies it.
- Variants only catch hard-coding if they change the cells the answer depends on. Phase 3's `CONTENT.md` should tell authors to vary those cells.
- Function support is unchanged from the spike: 31 functions (`SUPPORTED_FUNCTIONS`). Per ADR 001, a new function is added only when a lesson needs it, with tests first.
- Scoring (base points, bonuses, hint and Show Answer rules) is not part of the engine yet. It is built with `POST /attempts` in Phase 4.

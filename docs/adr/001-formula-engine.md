# ADR 001 — Formula engine

- **Status:** proposed, awaiting the developer's decision **D4**
- **Date:** 2026-10-29
- **Decider:** developer

## Context

The exercise engine (Phase 1) has to evaluate learner formulas in the browser for instant feedback and in Node for scoring (PLAN T1, T3). It also has to re-run them on variant datasets to catch hard-coded answers (T4), list which functions a formula uses (`mustUseFunctions`), and accept both `,` and `;` as separators (T9). The plan asks for a comparison between HyperFormula and a small custom evaluator.

The spike lives in `spikes/formula-engine/` (not shipped). Both candidates implement the same adapter interface (`src/types.ts`). They are run against the same 22 Excel cases on an original Arabic dataset (`src/cases.ts`). Each case covers SUM, IF, IF+AND, SUMIF (text, operator, variant data), COUNTIFS, VLOOKUP exact and approximate, `#N/A`, XLOOKUP (with if-not-found), INDEX/MATCH, LEFT, MID+FIND, LEFT+FIND on Arabic text, DATEDIF, `#DIV/0!`, `#NAME?` or a syntax error.

Reproduce:

```
pnpm --filter @tamreen/formula-engine-spike test      # correctness
pnpm --filter @tamreen/formula-engine-spike measure   # size, speed, coverage
```

## Results

### Correctness (22 shared cases)

| Engine       | Pass  | Notes                                                                                                                                                                                 |
| ------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HyperFormula | 20/22 | `DATEDIF` units are case-sensitive: `"m"` and `"d"` give `#NUM!`, only `"M"`/`"D"` work. Excel accepts any case.                                                                      |
| custom       | 22/22 | Plus 15 extra tests in the spike: precedence, wildcards, cycles, error propagation, DATEDIF y/ym/md, malformed input. These are not a substitute for the Phase 1 suite of 120+ cases. |

Other HyperFormula findings:

- **Bare `TRUE`/`FALSE` are `#NAME?`.** HyperFormula only knows `TRUE()`/`FALSE()`, so `=VLOOKUP("x",A:B,2,FALSE)`, the most common way learners write VLOOKUP, fails. The adapter works around it by registering `TRUE` and `FALSE` as named expressions. With that workaround, the three VLOOKUP cases pass.
- **One argument separator at a time.** `;` is a syntax error unless the whole instance is configured for it. Our own separator normalisation would be needed in front of it.
- **No public API for "functions used".** Its AST is internal, so `mustUseFunctions` / `mustNotUseFunctions` would need our own tokenizer anyway.

### Size, speed, coverage

|                                                       | HyperFormula 3.5.0 | custom (spike) |
| ----------------------------------------------------- | ------------------ | -------------- |
| Bundle, minified                                      | 792.9 KB           | 12.5 KB        |
| Bundle, min + gzip                                    | 176.4 KB           | 4.5 KB         |
| Avg time per evaluation, including sheet build*       | 8.8 ms             | 0.02 ms        |
| Functions implemented                                 | 423                | 31             |
| Curriculum functions covered (56 from PLAN §1.2/§2.1) | 52/56              | 31/56          |

\*HyperFormula builds a full workbook per check. It could be reused between checks, but each step still needs 3–4 evaluations (base plus variants). Either engine is fast enough. The bundle size matters more, because Phase 5 has an LCP budget of under 2.5 s on a mid-range phone.

- HyperFormula is missing `MODE` (it has `MODE.SNGL`), `CONCAT` (it has `CONCATENATE`), `TEXTBEFORE` and `TEXTAFTER`.
- The custom evaluator is missing 25 curriculum functions: XOR, IFS, SWITCH, ISNUMBER, ISTEXT, ISBLANK, AVERAGEIF, LARGE, SMALL, MEDIAN, MODE, HLOOKUP, TEXTJOIN, PROPER, SUBSTITUTE, TEXTBEFORE, TEXTAFTER, TODAY, DAYS, ODD, EVEN, FLOOR, CEILING, UNIQUE and FILTER. UNIQUE and FILTER return arrays (spill), which the custom value model does not handle yet. The rest are small scalar or aggregate functions.

### Licences

| Option                       | Licence                                                           | What it means for this product                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HyperFormula                 | **GPL-3.0-only**, or a paid proprietary licence from Handsontable | The engine runs in the browser, so the JavaScript bundle is _distributed_ to every visitor. Under GPLv3, the code combined with it in that bundle (the lesson player, grid and engine package) would have to be offered under the GPL with source. For a closed-source commercial site, that means buying the proprietary licence. The price is not public and has to be quoted by Handsontable. This is not legal advice; confirm with a lawyer before relying on GPL. |
| custom evaluator             | Ours                                                              | No obligations.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `@formulajs/formulajs` 4.6.1 | MIT, maintained (last release 2026-07)                            | A function library only, with no parser or references. Useful as a reference or as source for statistical/date functions behind our own parser. Check each function against Excel before relying on it.                                                                                                                                                                                                                                                                 |
| `fast-formula-parser` 1.0.19 | MIT, last release 2023-10                                         | A parser plus functions, but unmaintained for 3 years. Not recommended as a base.                                                                                                                                                                                                                                                                                                                                                                                       |
| `hot-formula-parser` 4.0.0   | MIT, last release 2022-06                                         | Unmaintained. Not recommended.                                                                                                                                                                                                                                                                                                                                                                                                                                          |

## Options

**A. Custom evaluator behind the `FormulaEngine` adapter (recommended).**

- Pros:
  - No licence cost or GPL obligations.
  - About 40× smaller bundle.
  - We own exactly the Excel behaviour the curriculum teaches, including separators, booleans and case-insensitive units.
  - Its AST gives `functionsUsed` and better feedback codes for free.
- Cons:
  - We have to write and test every function. The 23 scalar or aggregate gaps are an estimated 2–4 days inside Phase 1. Dynamic arrays (UNIQUE, FILTER) are a separate later task.
  - Risk of subtle Excel differences. This is mitigated by table-driven tests and by PLAN §6.1 (teach only what the engine verifies).

**B. HyperFormula with the commercial licence.**

- Pros: 400+ functions immediately, and a mature, well-tested engine.
- Cons:
  - Licence cost, which is unknown and needs a quote.
  - Adds 176 KB gzip to the lesson page.
  - Still needs our own tokenizer, separator normalisation and the TRUE/FALSE and DATEDIF workarounds.

**C. HyperFormula under GPLv3.** Only viable if the developer is willing to publish the web app's source under the GPL.

## Recommendation

**Option A.** Build the custom evaluator in `packages/engine`, starting from the spike code. Keep it behind the `FormulaEngine` adapter, so switching to HyperFormula later (for example for pivot-table or array-heavy lessons) is a local change. Use HyperFormula's results as a test oracle only in a dev-only test (never bundled) if it helps catch Excel differences. That use also needs the developer's sign-off, because GPL code in the repo's dev tooling is still GPL code.

## Decision

_Pending D4. The developer chooses A, B or C._

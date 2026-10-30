# Writing lessons

This guide is for anyone who writes or reviews lessons. Lessons are JSON files in `content/lessons/<track>/<slug>.json`. Git is the editor: change a file, then run `pnpm content:lint`. When it shows 0 errors, run `pnpm content:sync`.

## Lesson shape

- **5–8 steps per lesson** (lint enforces this). Most lessons should take 3–6 minutes.
- **One idea per step.** If a prompt needs the word "then" twice, split it into two steps.
- **Worked example first.** The first step of a new idea gives the exact formula to type. Later steps ask the learner to write it themselves.
- **Vary the work.** Mix grid steps (select, type a value, write a formula) with at least one multiple-choice question that checks understanding.
- **Practice and summary lessons** reuse ideas from earlier lessons on new data. They do not introduce new functions.
- **Functions:** use only the functions the engine supports (`SUPPORTED_FUNCTIONS` in `packages/engine`). Lint rejects any other. A new function needs a lesson that uses it and engine tests written first (ADR 001).

## Steps

- **`promptAr`:**
  - Says what to do and where, for example "اكتب في الخلية `B7` …".
  - Ends with the action, for example "ثم اضغط Enter".
  - No two prompts in the curriculum may be the same.
- **`hintAr`:** points the way without giving the answer. A hint halves the points, so it must earn that.
- **`explainAr`** (optional): one sentence on why the answer is right.
- **Formula steps:**
  - Need a `solution` and an `expected.value`, and the solution must produce that value.
  - Need at least one `variants` entry. A variant changes cells the answer depends on, so a typed number (`=450`) fails while a real formula passes. Lint checks that some variant changes the solution's result.
  - Use `mustUseFunctions` when the step teaches a function. Without it, `=B2+B3+B4` passes a SUM step.

## Markup inside Arabic text

| Write                      | Shows                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| `**كلمة**`                 | bold                                                                                         |
| `` `=SUM(B2:B6)` ``        | a formula or cell reference, always left to right                                            |
| `{{خلية}}` or `{{الخلية}}` | a glossary term. Its English name is added in brackets the first time it appears in a lesson |

Every `{{term}}` must exist in `content/glossary.json`. Put formulas, cell references and function names in backticks, so they never get reordered inside Arabic text.

## Arabic style

- Use neutral Modern Standard Arabic that readers in any Arab country understand. Avoid dialect words and region-specific month names.
- Keep sentences short, and address the learner directly: "اكتب"، "اختر"، "حدّد".
- Use the glossary terms from PLAN §3.8, such as خلية, عمود, صف, نطاق, معادلة, دالة, وسيط, مرجع, ورقة عمل and مصنف. Lint rejects the alternatives listed in `content/style.json`, for example "صيغة" for a formula or "مدى" for a range.
- Show the English term in brackets on first use, because many learners use the English Excel interface. `{{…}}` does this automatically.
- Write numbers in the grid with Latin digits, as Excel does. Learners may type Arabic-Indic digits; the engine accepts them.

## Data in lessons

- All data must be original. Never copy tables, names or text from other sites or books.
- Use names from across the Arab world (سلمى، يوسف، مريم، كريم، هدى …) and familiar settings: a bakery, a stationery shop, a school, a small office.
- Do not use currency symbols or a specific country's currency until decision D2 is made. Use plain numbers, or units such as quantities and hours.
- Keep sheets small (the visible range is at most about 30 rows by 12 columns) and label every column in row 1.

## Publishing

New lessons are `"status": "DRAFT"`. A lesson becomes `"PUBLISHED"` only after a native Arabic speaker has reviewed it and an entry has been added to the review log below. Lint rejects a published lesson that is not in the log.

## Review log

One row per reviewed lesson. Write the slug in backticks.

| Lesson | Reviewer | Date | Notes |
| ------ | -------- | ---- | ----- |

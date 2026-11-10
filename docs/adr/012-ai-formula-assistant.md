# ADR 012 — AI formula assistant: Groq, quotas, caps and fallbacks

- **Status:** accepted
- **Date:** 2026-11-10
- **Decider:** the developer chose the provider: Groq instead of the Claude API named in the plan, because they don't want to pay for an API for now. Claude Code chose the approach, within PLAN Phase 8.

## Context

Phase 8 asks for three things:

- `POST /assistant/hint`, which explains a wrong formula in Arabic without giving the answer away;
- a cache, daily quotas, timeouts, and a fallback to the static hint;
- helpful / not-helpful votes stored for review, and a visible "AI can be wrong" note.

Acceptance:

- p95 latency under 4 s;
- a spend cap exists and is tested;
- when the provider is unreachable, the static hint shows.

## Decision

**Provider and model:**

- Groq's OpenAI-compatible chat API, called with `fetch` (`GroqModel` in `apps/api/src/lib/hintModel.ts`). There is no SDK, so there is no new dependency or licence to record.
- The model sits behind a `HintModel` interface, so another provider (the Claude API, for example) is one more class.
- The default model is `qwen/qwen3.8-27b`, with reasoning switched off. I tried the three text models the key can use on one wrong-formula case:

  | Model                 | Result                                         | Typical latency |
  | --------------------- | ---------------------------------------------- | --------------- |
  | `qwen/qwen3.8-27b`    | Clear, correct Arabic                          | about 250 ms    |
  | `openai/gpt-oss-120b` | Good, but slower                               | 300–900 ms      |
  | `allam-2-7b`          | Gave the full answer, and the answer was wrong | —               |

- `ASSISTANT_MODEL` switches the model without a code change.

**What the model is given:**

- The Arabic step prompt.
- The solution, marked as hidden.
- The learner's formula, quoted as JSON inside its own block and described as data, not instructions.
- The feedback code.
- The page language. The answer is written in Modern Standard Arabic, English or French.
- No name, email, user id or IP address is sent.

**What the server checks:**

- The request carries the formula and the cell, never a feedback code. The API runs the engine again (the API is authoritative).
- A correct formula is refused with 409. A step that is not a formula step is refused with 400.

**Not revealing the answer:**

- The instructions forbid the correct formula, and also the corrected range, reference or number. A first live trial showed the model naming the fixed range ("make it `B2:B4`"), so the rule was tightened.
- Every reply is checked with `revealsSolution`. If it contains the solution in any spelling the checker accepts (case, spaces, `$`, Arabic digits, `;` separators), the learner gets the static hint instead (`UNSAFE`), and the reply is not cached.
- A solution that is a single reference (`=B2`) makes any mention of that cell count as a reveal. That case therefore falls back to the static hint more often, which is the safe side.
- The plan allows revealing the answer after Show Answer. Once the answer is shown the step is settled and the learner already sees the solution, so the assistant is only offered after a wrong formula.

**Cache:**

- One `AssistantHint` row per (step, language, formula). The formula is stored in the checker's canonical spelling, so `sum( b2 : b5 )` and `=SUM(B2:B5)` share a row.
- A cached reply costs nothing and does not count toward a quota.
- `content:sync` deletes a lesson's cached replies whenever it rewrites that lesson's steps, because the replies quote the old prompt and solution.

**Quotas and caps.** Every request logs an `AssistantCall` row. The checks run in this order:

1. **Quota:** model calls per day. Signed-in learners get `ASSISTANT_USER_DAILY` each (20). Guests share `ASSISTANT_IP_DAILY` per IP address (40). Signed-in learners are not also held to the IP quota, so a school sharing one address still works. Creating accounts to get around the quota is held back by the sign-up rate limit.
2. **Daily token cap:** `ASSISTANT_DAILY_TOKENS` (200,000), which stays under Groq's free-tier daily limit.
3. **Monthly spend cap:** `ASSISTANT_MONTHLY_BUDGET_USD` ($2) per calendar month (UTC). Cost is computed from the token counts at `ASSISTANT_PRICE_*`, which are deliberately high estimates.

- On the free tier the real cost is $0. The cap protects the developer if paid billing is ever switched on.
- A budget of 0 never calls the model.
- A burst limiter allows 10 requests a minute per learner or IP.
- The day for quotas is the same UTC+3 day as streaks (ADR 006).
- Concurrent requests can overshoot a quota by a request or two; that is accepted.

**Privacy:**

- `AssistantCall` and `AssistantFeedback` hold no user id and no IP address, only an HMAC of each made with the server secret.
- Rows have no foreign key to `User`, so deleting an account leaves rows that point to no one.
- The privacy page (all three languages) says the exercise and the formula go to Groq when the learner presses "Explain my mistake".

**Fallbacks.** The static hint, or a plain notice when the step has none, appears in each of these cases:

| Reason        | When                                                                                                              |
| ------------- | ----------------------------------------------------------------------------------------------------------------- |
| `DISABLED`    | No API key is configured                                                                                          |
| `QUOTA`       | The daily quota is used up                                                                                        |
| `BUDGET`      | The daily token cap or the monthly spend cap is reached                                                           |
| `UNAVAILABLE` | Network error, an error status, an unexpected body, an empty reply, or the `ASSISTANT_TIMEOUT_MS` timeout (3.5 s) |
| `UNSAFE`      | The reply gave the answer away                                                                                    |

The browser treats its own network errors the same way.

**UI:**

- "Explain my mistake" appears on a formula step after a wrong formula, once per distinct formula.
- The reply shows in a panel labelled as an AI explanation. Formulas in backticks stay LTR.
- The panel carries the note "AI-written, can be wrong; using it counts as a hint" and helpful / not-helpful buttons. One vote per person; a later vote replaces the earlier one.
- Using the explanation counts as a hint, as the static hint does: half points.

## Consequences

- One migration adds `AssistantHint`, `AssistantCall` and `AssistantFeedback`.
- **Tests:**
  - Unit tests cover building the messages, `revealsSolution`, `cleanHint`, the cache key, the cost and the metrics.
  - Integration tests (with a fake model) cover the explanation, the server-side code, the cache across spellings and languages, refusals, `DISABLED`, an unreachable provider (a real `GroqModel` pointed at a closed port), the timeout, `UNSAFE` replies that are never cached, the user and IP quotas across days, the monthly spend cap across months, a zero budget, the token cap and votes.
  - Player tests cover the panel, the AI note, the vote and the fallback notice.
- **Latency:**
  - `pnpm --filter @tamreen/api assistant:trial` calls the real model on the curriculum's formula steps. On 2026-11-10 it gave p50 312 ms and p95 974 ms over 15 steps, and all 15 replies could be shown. The timeout puts a hard ceiling of 3.5 s on the wait.
  - In production, `pnpm metrics:report` reports the p95 wait, the outcomes, the spend and the helpful rate.
- **Quality:** in the trial, one reply invented a detail (quotation marks that were not in the formula). That is why the "AI can be wrong" note and the votes exist. Review the not-helpful votes in `AssistantFeedback` from time to time.

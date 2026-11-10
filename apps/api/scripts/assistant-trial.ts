// pnpm --filter @tamreen/api assistant:trial — calls the configured model on real formula steps
// with a wrong formula each, and reports latency (p50/p95) and how many replies would be shown.
// Uses the provider key from .env; on a free tier it costs nothing. Flags: --n=30 --locale=ar
import path from 'node:path';
import { loadCurriculum } from '@tamreen/content';
import { checkAnswer } from '@tamreen/engine';
import type { ContentLocale } from '@tamreen/shared';
import { buildHintMessages, cleanHint, revealsSolution } from '../src/lib/assistant';
import { loadEnv } from '../src/lib/env';
import { GroqModel } from '../src/lib/hintModel';

const env = loadEnv();
if (!env.GROQ_API_KEY) throw new Error('Set GROQ_API_KEY in apps/api/.env first');
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const n = Number(arg('n') ?? 30);
const locale = (arg('locale') ?? 'ar') as ContentLocale;
const model = new GroqModel(env.GROQ_API_KEY, env.ASSISTANT_MODEL);

/** A plausible mistake: the last digit of the solution changed, else a typed-in number. */
function wrongVersion(solution: string): string {
  const m = /(\d)(?!.*\d)/.exec(solution);
  if (!m) return '=100';
  const digit = m[1] === '9' ? '8' : String(Number(m[1]) + 1);
  return solution.slice(0, m.index) + digit + solution.slice(m.index + 1);
}

const curriculum = await loadCurriculum(path.resolve(import.meta.dirname, '../../../content'));
const steps = curriculum.lessons
  .flatMap((l) => l.steps)
  .flatMap((s) => (s.type === 'ENTER_FORMULA' ? [s] : []))
  .slice(0, n);

const waits: number[] = [];
let shown = 0;
for (const step of steps) {
  const formula = wrongVersion(step.check.solution);
  const result = checkAnswer(step, { cell: step.check.target, formula });
  if (result.correct) continue;
  const started = performance.now();
  let verdict: string;
  try {
    const reply = await model.complete(
      buildHintMessages({
        promptAr: step.promptAr,
        solution: step.check.solution,
        formula,
        code: result.code,
        locale,
      }),
      AbortSignal.timeout(env.ASSISTANT_TIMEOUT_MS),
    );
    const text = cleanHint(reply.text);
    verdict = !text ? 'EMPTY' : revealsSolution(text, step.check.solution) ? 'UNSAFE' : 'ok';
    if (verdict === 'ok') shown++;
    console.log(`\n[${step.slug}] ${formula} → ${result.code} (${verdict})\n${text}`);
  } catch (e) {
    verdict = 'ERROR';
    console.log(`\n[${step.slug}] ${formula} → ${String(e)}`);
  }
  waits.push(performance.now() - started);
  await new Promise((r) => setTimeout(r, 2500)); // stay under the free tier's requests per minute
}

waits.sort((a, b) => a - b);
const at = (q: number) => Math.round(waits[Math.ceil(q * waits.length) - 1] ?? 0);
console.log(
  `\n${env.ASSISTANT_MODEL}: ${waits.length} calls, p50 ${at(0.5)} ms, p95 ${at(0.95)} ms, shown ${shown}/${waits.length}`,
);

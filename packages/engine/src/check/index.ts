import { AnswerSchemas, type StepOf, type StepSpec } from '@tamreen/shared';
import { checkEnterFormula } from './formula';
import { InvalidAnswerError, type CheckResult } from './result';
import { checkEnterValue, checkMultipleChoice, checkSelectCell, checkSelectRange } from './simple';
import { checkShortcut } from './shortcut';

/**
 * Decides whether an answer to a step is correct. The answer is validated against the step type's
 * schema first, so the API can pass the raw request body; a bad shape throws InvalidAnswerError.
 */
export function checkAnswer(step: StepSpec, answer: unknown): CheckResult {
  const parsed = AnswerSchemas[step.type].safeParse(answer);
  if (!parsed.success) throw new InvalidAnswerError(parsed.error.issues);
  const a = parsed.data as never;
  switch (step.type) {
    case 'SELECT_CELL':
      return checkSelectCell(step, a);
    case 'SELECT_RANGE':
      return checkSelectRange(step, a);
    case 'ENTER_VALUE':
      return checkEnterValue(step, a);
    case 'MULTIPLE_CHOICE':
      return checkMultipleChoice(step, a);
    case 'SHORTCUT':
      return checkShortcut(step, a);
    case 'ENTER_FORMULA':
      return checkEnterFormula(step, a);
  }
}

/**
 * Runs a formula step's reference solution through its own checker: it must give
 * `expected.value` and agree with itself on every variant. `content:lint` (Phase 3) uses this.
 */
export function verifyReferenceSolution(step: StepOf<'ENTER_FORMULA'>): CheckResult {
  return checkEnterFormula(step, { cell: step.check.target, formula: step.check.solution });
}

export { InvalidAnswerError, type CheckResult } from './result';

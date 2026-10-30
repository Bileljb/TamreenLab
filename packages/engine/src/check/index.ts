import { AnswerSchemas, type StepSpec } from '@tamreen/shared';
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
      throw new Error('The ENTER_FORMULA checker is not implemented yet');
  }
}

export { InvalidAnswerError, type CheckResult } from './result';

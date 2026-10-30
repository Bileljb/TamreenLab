import type { FeedbackCode } from '@tamreen/shared';

export type CheckResult = { correct: boolean; code: FeedbackCode };

export const result = (code: FeedbackCode): CheckResult => ({ correct: code === 'OK', code });

/** The answer does not have the shape the step type expects. The API maps this to a 400. */
export class InvalidAnswerError extends Error {
  constructor(readonly issues: unknown) {
    super('Invalid answer for this step type');
  }
}

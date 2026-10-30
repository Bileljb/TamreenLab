/** Codes the engine returns for a checked answer. The UI maps each one to Arabic copy (PLAN §3.5). */
export const FEEDBACK_CODES = [
  'OK',
  'WRONG_VALUE',
  'WRONG_CELL',
  'MISSING_FUNCTION',
  'FORBIDDEN_FUNCTION',
  'HARDCODED_VALUE',
  'SYNTAX_ERROR',
  'REF_ERROR',
  'NAME_ERROR',
  'NA_ERROR',
  'DIV0',
  'TIMEOUT',
] as const;

export type FeedbackCode = (typeof FEEDBACK_CODES)[number];

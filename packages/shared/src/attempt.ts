import { z } from 'zod';
import { FEEDBACK_CODES } from './feedback';
import { CellAddressSchema, RangeRefSchema } from './step';

const MAX_INPUT = 2000;

/** What the learner did, one shape per step type. Answers are validated before any checking. */
export const SelectCellAnswerSchema = z.object({ cell: CellAddressSchema });
export const SelectRangeAnswerSchema = z.object({ range: RangeRefSchema });
export const EnterValueAnswerSchema = z.object({
  cell: CellAddressSchema,
  value: z.string().max(MAX_INPUT),
});
export const EnterFormulaAnswerSchema = z.object({
  cell: CellAddressSchema,
  formula: z.string().max(MAX_INPUT),
});
export const MultipleChoiceAnswerSchema = z.object({ choice: z.number().int().nonnegative() });

export const PLATFORMS = ['win', 'mac'] as const;
export type Platform = (typeof PLATFORMS)[number];

/**
 * A captured key press, mirroring the fields of a browser KeyboardEvent. `code` is the physical
 * key (`KeyL`): on an Arabic layout Ctrl+L reports `key: "م"`, so matching needs it.
 */
export const KeyPressSchema = z.object({
  key: z.string().min(1).max(32),
  code: z.string().max(32).optional(),
  ctrlKey: z.boolean().default(false),
  shiftKey: z.boolean().default(false),
  altKey: z.boolean().default(false),
  metaKey: z.boolean().default(false),
});
export type KeyPress = z.input<typeof KeyPressSchema>;

export const ShortcutAnswerSchema = z.object({
  keys: KeyPressSchema,
  platform: z.enum(PLATFORMS),
});

export const AnswerSchemas = {
  SELECT_CELL: SelectCellAnswerSchema,
  SELECT_RANGE: SelectRangeAnswerSchema,
  ENTER_VALUE: EnterValueAnswerSchema,
  ENTER_FORMULA: EnterFormulaAnswerSchema,
  MULTIPLE_CHOICE: MultipleChoiceAnswerSchema,
  SHORTCUT: ShortcutAnswerSchema,
} as const;

export type AnswerFor = {
  [K in keyof typeof AnswerSchemas]: z.output<(typeof AnswerSchemas)[K]>;
};

/** Any answer. The API narrows it with `AnswerSchemas[step.type]` once it knows the step. */
export const AnswerSchema = z.union([
  SelectCellAnswerSchema,
  SelectRangeAnswerSchema,
  EnterValueAnswerSchema,
  EnterFormulaAnswerSchema,
  MultipleChoiceAnswerSchema,
  ShortcutAnswerSchema,
]);
export type Answer = z.output<typeof AnswerSchema>;

/** `POST /attempts` body. There is deliberately no "correct" field: the API decides. */
export const AttemptRequestSchema = z
  .object({
    stepId: z.string().min(1).max(64),
    answer: AnswerSchema,
    timeMs: z.number().int().nonnegative().max(86_400_000),
  })
  .strict();
export type AttemptRequest = z.infer<typeof AttemptRequestSchema>;

export const AttemptResponseSchema = z.object({
  correct: z.boolean(),
  code: z.enum(FEEDBACK_CODES),
  pointsAwarded: z.number().int().nonnegative(),
  firstTry: z.boolean(),
});
export type AttemptResponse = z.infer<typeof AttemptResponseSchema>;

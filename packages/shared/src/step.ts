import { z } from 'zod';

/** A1-style cell address, optionally absolute: `B2`, `$B$2`. Columns A–XFD, rows from 1. */
export const CELL_ADDRESS = /^\$?[A-Z]{1,3}\$?[1-9]\d*$/i;
/** A range of two cell addresses: `A1:D8`. */
export const RANGE_REF = /^\$?[A-Z]{1,3}\$?[1-9]\d*:\$?[A-Z]{1,3}\$?[1-9]\d*$/i;

export const CellAddressSchema = z.string().regex(CELL_ADDRESS, 'Expected a cell address like B2');
export const RangeRefSchema = z.string().regex(RANGE_REF, 'Expected a range like A1:D8');
/** A single cell or a range, used where either is allowed (formats). */
export const CellOrRangeSchema = z
  .string()
  .refine((s) => CELL_ADDRESS.test(s) || RANGE_REF.test(s), 'Expected a cell or a range');

export const CellInputSchema = z.union([z.number().finite(), z.string(), z.boolean()]);
export type CellInput = z.infer<typeof CellInputSchema>;

export const CellsSchema = z.record(CellAddressSchema, CellInputSchema);
export type Cells = z.infer<typeof CellsSchema>;

export const CELL_FORMATS = ['number', 'percent', 'currency', 'text', 'date'] as const;

export const SheetSpecSchema = z.object({
  visible: RangeRefSchema,
  cells: CellsSchema,
  formats: z.record(CellOrRangeSchema, z.enum(CELL_FORMATS)).optional(),
});
export type SheetSpec = z.infer<typeof SheetSpecSchema>;

const functionName = z
  .string()
  .regex(/^[A-Z][A-Z0-9.]*$/, 'Function names are upper case, like SUMIF');

export const SelectCellCheckSchema = z.object({ target: CellAddressSchema });
export const SelectRangeCheckSchema = z.object({ target: RangeRefSchema });

export const EnterValueCheckSchema = z.object({
  target: CellAddressSchema,
  expected: z.union([z.number().finite(), z.string().min(1), z.boolean()]),
  /** Absolute tolerance for numeric answers. */
  tolerance: z.number().nonnegative().optional(),
});

export const VariantSchema = z.object({ cells: CellsSchema });

export const EnterFormulaCheckSchema = z.object({
  target: CellAddressSchema,
  expected: z.object({ value: z.union([z.number().finite(), z.string(), z.boolean()]) }),
  /**
   * Reference solution (ADR 003). It must produce `expected.value` on the base sheet, and it is
   * re-run on every variant to get the variant's expected value.
   */
  solution: z.string().startsWith('='),
  mustUseFunctions: z.array(functionName).optional(),
  mustNotUseFunctions: z.array(functionName).optional(),
  variants: z.array(VariantSchema).optional(),
  /** When true (default), `A2:A8` and `$A$2:$A$8` are the same answer. */
  acceptEquivalentRefs: z.boolean().default(true),
  /** Absolute tolerance for numeric results. */
  tolerance: z.number().nonnegative().optional(),
});

export const MultipleChoiceCheckSchema = z
  .object({
    options: z.array(z.string().min(1)).min(2),
    /** Zero-based index into `options`. */
    correct: z.number().int().nonnegative(),
  })
  .refine((c) => c.correct < c.options.length, {
    message: 'correct must index into options',
    path: ['correct'],
  });

/** A key combination written as `Ctrl+Shift+L`; modifiers first, the key last (`Ctrl++` is plus). */
export const KeyComboSchema = z
  .string()
  .regex(/^(?:[A-Za-z]+\+)*(?:\+|[^+\s]+)$/, 'Expected a combo like Ctrl+Shift+L');

export const ShortcutCheckSchema = z.object({
  combos: z.array(z.object({ win: KeyComboSchema, mac: KeyComboSchema })).min(1),
  blockedInBrowser: z.boolean().optional(),
});

const stepBase = {
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Expected a kebab-case slug'),
  promptAr: z.string().trim().min(1),
  sheet: SheetSpecSchema.optional(),
  hintAr: z.string().trim().min(1).optional(),
  explainAr: z.string().trim().min(1).optional(),
  basePoints: z.number().int().positive().default(300),
};

export const StepSpecSchema = z.discriminatedUnion('type', [
  z.object({ ...stepBase, type: z.literal('SELECT_CELL'), check: SelectCellCheckSchema }),
  z.object({ ...stepBase, type: z.literal('SELECT_RANGE'), check: SelectRangeCheckSchema }),
  z.object({ ...stepBase, type: z.literal('ENTER_VALUE'), check: EnterValueCheckSchema }),
  z.object({
    ...stepBase,
    type: z.literal('ENTER_FORMULA'),
    sheet: SheetSpecSchema,
    check: EnterFormulaCheckSchema,
  }),
  z.object({ ...stepBase, type: z.literal('MULTIPLE_CHOICE'), check: MultipleChoiceCheckSchema }),
  z.object({ ...stepBase, type: z.literal('SHORTCUT'), check: ShortcutCheckSchema }),
]);

/** A step after parsing: defaults (basePoints, acceptEquivalentRefs) are filled in. */
export type StepSpec = z.output<typeof StepSpecSchema>;
/** A step as written in a content file. */
export type StepSpecInput = z.input<typeof StepSpecSchema>;
export type StepType = StepSpec['type'];
export type StepOf<T extends StepType> = Extract<StepSpec, { type: T }>;

export const STEP_TYPES = [
  'SELECT_CELL',
  'SELECT_RANGE',
  'ENTER_VALUE',
  'ENTER_FORMULA',
  'MULTIPLE_CHOICE',
  'SHORTCUT',
] as const satisfies readonly StepType[];

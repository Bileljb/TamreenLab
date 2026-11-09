import type { Answer, Platform, StepSpec } from '@tamreen/shared';
import { normalizeAddress, normalizeRange } from '../ref';
import { isReserved, parseCombo, shortcutMode } from './shortcut';

/**
 * An answer that passes the step's check: what "Show Answer" reveals and applies.
 * Content lint (Phase 3) also uses it to prove every step is solvable.
 */
export function referenceAnswer(step: StepSpec, platform: Platform = 'win'): Answer {
  switch (step.type) {
    case 'SELECT_CELL':
      return { cell: normalizeAddress(step.check.target) };
    case 'SELECT_RANGE':
      return { range: normalizeRange(step.check.target) };
    case 'ENTER_VALUE': {
      const { expected } = step.check;
      const value =
        typeof expected === 'boolean' ? (expected ? 'TRUE' : 'FALSE') : String(expected);
      return { cell: normalizeAddress(step.check.target), value };
    }
    case 'ENTER_FORMULA':
      return { cell: normalizeAddress(step.check.target), formula: step.check.solution };
    case 'MULTIPLE_CHOICE':
      return { choice: step.check.correct };
    case 'SHORTCUT': {
      const taught = step.check.combos[0]![platform];
      if (shortcutMode(step, platform) === 'choice') return { combo: taught, platform };
      const combo = parseCombo(
        step.check.combos.find((c) => !isReserved(c[platform], platform))![platform],
      );
      return {
        keys: {
          key: combo.key,
          ctrlKey: combo.modifiers.has('ctrl'),
          shiftKey: combo.modifiers.has('shift'),
          altKey: combo.modifiers.has('alt'),
          metaKey: combo.modifiers.has('meta'),
        },
        platform,
      };
    }
  }
}

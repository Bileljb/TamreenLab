// The exercise engine: pure TypeScript, no DOM and no Node-only imports, so it runs in the
// browser (instant feedback) and in the API (authoritative scoring).
export const ENGINE_VERSION = '0.1.0';

export * from './formula';
export * from './check';
export { Sheet } from './sheet';
export { scoreAttempt, type ScoreInput } from './score';
export { expandRange, normalizeAddress, normalizeRange, sameCell, sameRange } from './ref';
export {
  anchoringMatches,
  canonicalFormula,
  hasCellReference,
  normalizeDigits,
  prepareFormula,
} from './normalize';

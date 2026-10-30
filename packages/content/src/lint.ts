import {
  SUPPORTED_FUNCTIONS,
  Sheet,
  checkAnswer,
  customEngine,
  hasCellReference,
  normalizeRange,
  parseAddress,
  referenceAnswer,
  verifyReferenceSolution,
  type CellValue,
} from '@tamreen/engine';
import {
  GlossarySchema,
  LessonFileSchema,
  StyleFileSchema,
  TracksFileSchema,
  type Glossary,
  type LessonFile,
  type StepSpec,
  type StyleFile,
} from '@tamreen/shared';
import { lessonPath, type RawContent, type RawFile } from './load';

export type LintIssue = { file: string; step?: string; message: string };

export const MIN_STEPS = 5;
export const MAX_STEPS = 8;

type Options = {
  /** Text of docs/CONTENT.md; PUBLISHED lessons must appear in its review log. */
  contentGuide?: string;
};

function parse<T>(
  file: RawFile,
  schema: {
    safeParse(
      v: unknown,
    ):
      | { success: true; data: T }
      | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } };
  },
  issues: LintIssue[],
): T | null {
  if ('error' in file) {
    issues.push({ file: file.path, message: `cannot read: ${file.error}` });
    return null;
  }
  const parsed = schema.safeParse(file.json);
  if (parsed.success) return parsed.data;
  for (const issue of parsed.error.issues) {
    issues.push({
      file: file.path,
      message: `${issue.path.join('.') || '(root)'}: ${issue.message}`,
    });
  }
  return null;
}

const same = (a: CellValue, b: CellValue) => JSON.stringify(a) === JSON.stringify(b);

function inRange(range: string, ref: string): boolean {
  const [a, b] = normalizeRange(range).split(':').map(parseAddress);
  const cells = ref.includes(':') ? normalizeRange(ref).split(':') : [ref];
  return cells.every((c) => {
    const p = parseAddress(c.replace(/\$/g, ''));
    return p.row >= a!.row && p.row <= b!.row && p.col >= a!.col && p.col <= b!.col;
  });
}

/** Words of a text, so that a style rule matches "صيغة" but not a longer word containing it. */
function words(text: string): string[] {
  return text.split(/[^\p{L}\p{M}]+/u).filter(Boolean);
}

// What can be attached to the front of a word: conjunctions, prepositions and the article
// (صيغة, بصيغة, الصيغة, بالصيغة, للصيغة, وبالصيغة ...).
const PREFIXES = ['', 'و', 'ف'].flatMap((conj) =>
  ['', 'ب', 'ل', 'ك', 'ال', 'بال', 'كال', 'لل'].map((rest) => conj + rest),
);

function avoidedWords(text: string, style: StyleFile): string[] {
  const found = new Set<string>();
  const tokens = words(text);
  for (const bad of Object.keys(style.avoid)) {
    const parts = words(bad);
    for (let i = 0; i + parts.length <= tokens.length; i++) {
      const first = tokens[i]!;
      const matchesFirst = PREFIXES.some((p) => first === p + parts[0]);
      if (matchesFirst && parts.slice(1).every((w, j) => tokens[i + 1 + j] === w)) found.add(bad);
    }
  }
  return [...found];
}

function glossaryTerms(text: string): string[] {
  return [...text.matchAll(/\{\{(.+?)\}\}/g)].map((m) => m[1]!.trim());
}

/** Texts of a step a learner reads. */
function texts(step: StepSpec): string[] {
  const out = [step.promptAr, step.hintAr ?? '', step.explainAr ?? ''];
  if (step.type === 'MULTIPLE_CHOICE') out.push(...step.check.options);
  return out;
}

function lintStep(step: StepSpec, glossary: Glossary, style: StyleFile): string[] {
  const problems: string[] = [];

  // Solvable: the reference answer passes the step's own check.
  try {
    const result = checkAnswer(step, referenceAnswer(step));
    if (!result.correct) problems.push(`reference answer fails its own check (${result.code})`);
  } catch (e) {
    problems.push(`reference answer cannot be checked: ${e instanceof Error ? e.message : e}`);
  }

  const visible = step.sheet?.visible;
  const target = 'target' in step.check ? step.check.target : null;
  if (visible && target && !inRange(visible, target)) {
    problems.push(`target ${target} is outside the visible range ${visible}`);
  }

  if (step.type === 'ENTER_FORMULA') {
    const { check } = step;
    const verdict = verifyReferenceSolution(step);
    if (!verdict.correct)
      problems.push(`solution ${check.solution} does not verify (${verdict.code})`);
    const used = customEngine.functionsUsed(check.solution) ?? [];
    const unsupported = used.filter((f) => !SUPPORTED_FUNCTIONS.includes(f));
    if (unsupported.length) problems.push(`unsupported functions: ${unsupported.join(', ')}`);
    const missing = (check.mustUseFunctions ?? []).filter((f) => !used.includes(f));
    if (missing.length)
      problems.push(`mustUseFunctions not in the solution: ${missing.join(', ')}`);

    // Variants must be able to catch a hard-coded answer.
    if (hasCellReference(check.solution)) {
      const variants = check.variants ?? [];
      if (variants.length === 0) {
        problems.push('formula step reads cells but has no variant to catch hard-coded answers');
      } else {
        const base = new Sheet(step.sheet.cells);
        const baseValue = base.evaluate(check.solution);
        const changes = variants.some(
          (v) => !same(base.withCells(v.cells).evaluate(check.solution), baseValue),
        );
        if (!changes)
          problems.push('no variant changes the solution result, so none can catch hard-coding');
      }
    }
  }

  for (const text of texts(step)) {
    for (const term of glossaryTerms(text)) {
      if (!(term in glossary) && !(term.replace(/^ال/, '') in glossary)) {
        problems.push(`glossary term {{${term}}} is not in glossary.json`);
      }
    }
    for (const bad of avoidedWords(text, style)) {
      problems.push(`avoid "${bad}"; use "${style.avoid[bad]}"`);
    }
  }
  return problems;
}

/** The slugs listed in the review log section of docs/CONTENT.md, written as `slug`. */
export function reviewedSlugs(contentGuide: string): Set<string> {
  const section = contentGuide.split(/^## /m).find((s) => s.startsWith('Review log')) ?? '';
  return new Set([...section.matchAll(/`([a-z0-9-]+)`/g)].map((m) => m[1]!));
}

export function lintContent(raw: RawContent, options: Options = {}): LintIssue[] {
  const issues: LintIssue[] = [];
  const tracks = parse(raw.tracks, TracksFileSchema, issues);
  const glossary = parse(raw.glossary, GlossarySchema, issues) ?? {};
  const style = parse(raw.style, StyleFileSchema, issues) ?? { avoid: {} };
  const reviewed = reviewedSlugs(options.contentGuide ?? '');

  const lessons: { file: string; lesson: LessonFile }[] = [];
  for (const file of raw.lessons) {
    const lesson = parse(file, LessonFileSchema, issues);
    if (lesson) lessons.push({ file: file.path, lesson });
  }

  const slugs = new Map<string, string>();
  const orders = new Map<number, string>();
  const prompts = new Map<string, string>();
  for (const { file, lesson } of lessons) {
    const add = (message: string, step?: string) => issues.push({ file, step, message });

    if (lessonPath(lesson) !== file) add(`must live at ${lessonPath(lesson)}`);
    if (tracks && !tracks.some((t) => t.slug === lesson.track))
      add(`unknown track "${lesson.track}"`);
    if (slugs.has(lesson.slug))
      add(`lesson slug "${lesson.slug}" also used by ${slugs.get(lesson.slug)}`);
    slugs.set(lesson.slug, file);
    if (orders.has(lesson.order))
      add(`order ${lesson.order} also used by ${orders.get(lesson.order)}`);
    orders.set(lesson.order, file);
    if (lesson.steps.length < MIN_STEPS || lesson.steps.length > MAX_STEPS) {
      add(`has ${lesson.steps.length} steps; lessons have ${MIN_STEPS}–${MAX_STEPS}`);
    }
    if (lesson.status === 'PUBLISHED' && !reviewed.has(lesson.slug)) {
      add('PUBLISHED, but not in the review log of docs/CONTENT.md');
    }
    for (const bad of avoidedWords(`${lesson.titleAr} ${lesson.summaryAr}`, style)) {
      add(`avoid "${bad}"; use "${style.avoid[bad]}"`);
    }

    for (const step of lesson.steps) {
      const key = step.promptAr.replace(/\s+/g, ' ').trim();
      const where = `${file}:${step.slug}`;
      if (prompts.has(key)) add(`prompt duplicates ${prompts.get(key)}`, step.slug);
      else prompts.set(key, where);
      for (const problem of lintStep(step, glossary, style)) add(problem, step.slug);
    }
  }
  return issues;
}

export function formatIssue(issue: LintIssue): string {
  return `${issue.file}${issue.step ? `:${issue.step}` : ''} — ${issue.message}`;
}

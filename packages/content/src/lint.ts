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
  ARABIC_SCRIPT,
  FunctionFileSchema,
  FunctionTranslationSchema,
  GlossarySchema,
  LessonTranslationSchema,
  TracksTranslationSchema,
  type FunctionFile,
  LessonFileSchema,
  StyleFileSchema,
  TracksFileSchema,
  glossaryTermKey,
  type Glossary,
  type LessonFile,
  type StepSpec,
  type StyleFile,
  type TracksFile,
} from '@tamreen/shared';
import {
  functionPath,
  lessonPath,
  translationPath,
  type RawContent,
  type RawFile,
  type RawTranslation,
} from './load';
import { localizeFunction, localizeLesson, localizeTracks } from './localize';

export type LintIssue = { file: string; step?: string; message: string };

export const MIN_STEPS = 5;
export const MAX_STEPS = 8;
export const MIN_FAQ = 2;

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

/** Solvability and sheet rules for one step; text rules are separate (they differ by language). */
function lintStepLogic(step: StepSpec): string[] {
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

  return problems;
}

function lintStep(step: StepSpec, glossary: Glossary, style: StyleFile): string[] {
  const problems = lintStepLogic(step);
  for (const text of texts(step)) problems.push(...textIssues(text, glossary, style));
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
    // The public lesson page needs an explanation and an FAQ (PLAN Phase 5).
    if (!lesson.introAr) add('missing introAr (the explanation shown above the player)');
    if ((lesson.faq?.length ?? 0) < MIN_FAQ) add(`needs at least ${MIN_FAQ} faq entries`);
    const pageTexts = [
      lesson.titleAr,
      lesson.summaryAr,
      lesson.introAr ?? '',
      ...(lesson.faq ?? []).flatMap((f) => [f.qAr, f.aAr]),
    ];
    for (const problem of pageTexts.flatMap((t) => textIssues(t, glossary, style))) add(problem);

    for (const step of lesson.steps) {
      const key = step.promptAr.replace(/\s+/g, ' ').trim();
      const where = `${file}:${step.slug}`;
      if (prompts.has(key)) add(`prompt duplicates ${prompts.get(key)}`, step.slug);
      else prompts.set(key, where);
      for (const problem of lintStep(step, glossary, style)) add(problem, step.slug);
    }
  }

  const functions = lintFunctions(raw.functions ?? [], new Set(slugs.keys()), glossary, style, issues);
  for (const translation of raw.translations ?? []) {
    lintTranslation(
      translation,
      lessons.map((l) => l.lesson),
      functions,
      tracks ?? [],
      issues,
    );
  }
  return issues;
}

/** Text a learner reads in a translated lesson or page must not keep Arabic or glossary markup. */
function translatedTextIssues(texts: string[]): string[] {
  const problems = new Set<string>();
  for (const text of texts) {
    if (ARABIC_SCRIPT.test(text)) problems.add(`Arabic text left: "${text.slice(0, 60)}"`);
    if (/{{.+?}}/.test(text)) problems.add(`{{…}} markup is for Arabic only: "${text.slice(0, 60)}"`);
  }
  return [...problems];
}

/** Every string inside a value (sheet cells, check fields), to look for untranslated text. */
function allStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(allStrings);
  if (value && typeof value === "object") return Object.values(value).flatMap(allStrings);
  return [];
}

/**
 * One language: a complete set of files, nothing left in Arabic, and every translated step and
 * example proved again by the engine, because translated sheet text can change a result.
 */
function lintTranslation(
  raw: RawTranslation,
  lessons: LessonFile[],
  functions: FunctionFile[],
  tracks: TracksFile,
  issues: LintIssue[],
) {
  const { locale } = raw;
  const trackFile = parse(raw.tracks, TracksTranslationSchema, issues);
  if (trackFile) {
    try {
      const out = localizeTracks(tracks, trackFile);
      for (const p of translatedTextIssues(out.map((t) => t.titleAr)))
        issues.push({ file: raw.tracks.path, message: p });
    } catch (e) {
      issues.push({ file: raw.tracks.path, message: e instanceof Error ? e.message : String(e) });
    }
  }

  const bySlug = new Map(lessons.map((l) => [l.slug, l]));
  const translated = new Set<string>();
  for (const file of raw.lessons) {
    const tr = parse(file, LessonTranslationSchema, issues);
    if (!tr) continue;
    const add = (message: string, step?: string) => issues.push({ file: file.path, step, message });
    const lesson = bySlug.get(tr.slug);
    if (!lesson) {
      add(`no lesson "${tr.slug}" to translate`);
      continue;
    }
    if (translationPath(locale, "lessons", tr.slug) !== file.path)
      add(`must live at ${translationPath(locale, "lessons", tr.slug)}`);
    translated.add(tr.slug);
    let out: LessonFile;
    try {
      out = localizeLesson(lesson, tr);
    } catch (e) {
      add(e instanceof Error ? e.message : String(e));
      continue;
    }
    const known = new Set(lesson.steps.map((s) => s.slug));
    for (const slug of Object.keys(tr.steps)) if (!known.has(slug)) add(`unknown step "${slug}"`);
    const pageTexts = [
      out.titleAr,
      out.summaryAr,
      out.introAr ?? "",
      ...(out.faq ?? []).flatMap((f) => [f.qAr, f.aAr]),
    ];
    for (const p of translatedTextIssues(pageTexts)) add(p);
    for (const step of out.steps) {
      const stepTexts = [...texts(step), ...allStrings(step.sheet), ...allStrings(step.check)];
      for (const p of [...lintStepLogic(step), ...translatedTextIssues(stepTexts)]) add(p, step.slug);
    }
  }
  for (const lesson of lessons) {
    if (!translated.has(lesson.slug)) {
      const where = translationPath(locale, "lessons", lesson.slug);
      issues.push({ file: where, message: `no ${locale} translation (${where})` });
    }
  }

  const fnBySlug = new Map(functions.map((f) => [f.slug, f]));
  const fnTranslated = new Set<string>();
  for (const file of raw.functions) {
    const tr = parse(file, FunctionTranslationSchema, issues);
    if (!tr) continue;
    const add = (message: string, step?: string) => issues.push({ file: file.path, step, message });
    const fn = fnBySlug.get(tr.slug);
    if (!fn) {
      add(`no function page "${tr.slug}" to translate`);
      continue;
    }
    fnTranslated.add(tr.slug);
    let out: FunctionFile;
    try {
      out = localizeFunction(fn, tr);
    } catch (e) {
      add(e instanceof Error ? e.message : String(e));
      continue;
    }
    out.examples.forEach((example, i) => {
      const problem = exampleIssue(fn.name, example);
      if (problem) add(problem, `example-${i + 1}`);
    });
    const pageTexts = [
      out.titleAr,
      out.summaryAr,
      out.introAr,
      ...out.args.map((a) => a.descAr),
      ...out.examples.flatMap((e) => [e.explainAr, ...allStrings(e)]),
      ...out.errors.map((e) => e.causeAr),
      ...out.faq.flatMap((f) => [f.qAr, f.aAr]),
    ];
    for (const p of translatedTextIssues(pageTexts)) add(p);
  }
  for (const fn of functions) {
    if (!fnTranslated.has(fn.slug)) {
      const where = translationPath(locale, "functions", fn.slug);
      issues.push({ file: where, message: `no ${locale} translation (${where})` });
    }
  }
}

/** Function reference pages: valid, unique, linked to real lessons, and every example verified. */
function lintFunctions(
  files: RawFile[],
  lessonSlugs: Set<string>,
  glossary: Glossary,
  style: StyleFile,
  issues: LintIssue[],
): FunctionFile[] {
  const seen = new Map<string, string>();
  const parsed: FunctionFile[] = [];
  for (const file of files) {
    const fn = parse(file, FunctionFileSchema, issues);
    if (!fn) continue;
    parsed.push(fn);
    const add = (message: string, step?: string) => issues.push({ file: file.path, step, message });
    if (functionPath(fn) !== file.path) add(`must live at ${functionPath(fn)}`);
    for (const key of [`slug:${fn.slug}`, `name:${fn.name}`, `order:${fn.order}`]) {
      if (seen.has(key)) add(`${key} also used by ${seen.get(key)}`);
      seen.set(key, file.path);
    }
    for (const lesson of fn.lessons) {
      if (!lessonSlugs.has(lesson)) add(`links to unknown lesson "${lesson}"`);
    }
    fn.examples.forEach((example, i) => {
      const problem = exampleIssue(fn.name, example);
      if (problem) add(problem, `example-${i + 1}`);
    });
    const texts = [
      fn.titleAr,
      fn.summaryAr,
      fn.introAr,
      ...fn.args.map((a) => a.descAr),
      ...fn.examples.map((e) => e.explainAr),
      ...fn.errors.map((e) => e.causeAr),
      ...fn.faq.flatMap((f) => [f.qAr, f.aAr]),
    ];
    for (const problem of texts.flatMap((t) => textIssues(t, glossary, style))) add(problem);
  }
  return parsed;
}

/** An example must use its function and, unless marked unverified, give the stated result. */
function exampleIssue(name: string, example: FunctionFile['examples'][number]): string | null {
  const used = customEngine.functionsUsed(example.formula);
  if (!used) return `formula ${example.formula} does not parse`;
  if (!used.includes(name)) return `formula ${example.formula} does not use ${name}`;
  if (!example.verified) return null;
  const actual = new Sheet(example.sheet?.cells ?? {}).evaluate(example.formula);
  const expected = example.result;
  const ok =
    typeof expected === 'number' && typeof actual === 'number'
      ? Math.abs(actual - expected) < 1e-9
      : actual === expected;
  return ok
    ? null
    : `formula ${example.formula} gives ${JSON.stringify(actual)}, not ${JSON.stringify(expected)}`;
}

/** Glossary terms that do not resolve, and discouraged words, in one learner-facing text. */
function textIssues(text: string, glossary: Glossary, style: StyleFile): string[] {
  const problems: string[] = [];
  for (const term of glossaryTerms(text)) {
    if (!(term in glossary) && !(glossaryTermKey(term) in glossary)) {
      problems.push(`glossary term {{${term}}} is not in glossary.json`);
    }
  }
  for (const bad of avoidedWords(text, style)) {
    problems.push(`avoid "${bad}"; use "${style.avoid[bad]}"`);
  }
  return problems;
}

export function formatIssue(issue: LintIssue): string {
  return `${issue.file}${issue.step ? `:${issue.step}` : ''} — ${issue.message}`;
}

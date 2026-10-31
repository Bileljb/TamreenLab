// Builds a lesson, function page or track list in another language from the Arabic source and a
// translation file (ADR 009). The output keeps the source shape, so the player, engine and lint
// work unchanged; after localization the `*Ar` fields hold the text in the chosen language.
import type {
  FunctionFile,
  TranslatedLocale,
  FunctionTranslation,
  LessonFile,
  LessonTranslation,
  StepSpec,
  TracksFile,
  TracksTranslation,
} from '@tamreen/shared';
import type { Curriculum } from './load';

type Strings = Record<string, string>;

/**
 * A cell value or formula in the target language: a value equal to a key is replaced, and inside
 * a formula every quoted literal equal to a key is replaced. Other text is left as it is.
 */
export function translateString(value: string, strings: Strings): string {
  if (value.startsWith('=')) {
    // Excel escapes a quote inside a literal by doubling it.
    return value.replace(/"((?:[^"]|"")*)"/g, (whole, inner: string) => {
      const literal = inner.replace(/""/g, '"');
      const translated = strings[literal];
      return translated === undefined ? whole : `"${translated.replace(/"/g, '""')}"`;
    });
  }
  return strings[value] ?? value;
}

/** Every string inside a sheet or check, translated; numbers, booleans and keys are kept. */
export function translateDeep<T>(value: T, strings: Strings): T {
  if (typeof value === 'string') return translateString(value, strings) as T;
  if (Array.isArray(value)) return value.map((v) => translateDeep(v, strings)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, translateDeep(v, strings)]),
    ) as T;
  }
  return value;
}

function sameLength(what: string, source: unknown[] | undefined, target: unknown[] | undefined) {
  if ((source?.length ?? 0) !== (target?.length ?? 0)) {
    throw new Error(`${what}: the translation has ${target?.length ?? 0}, the source ${source?.length ?? 0}`);
  }
}

function localizeStep(step: StepSpec, tr: LessonTranslation): StepSpec {
  const text = tr.steps[step.slug];
  if (!text) throw new Error(`${tr.slug}: no translation for step "${step.slug}"`);
  const out = {
    ...step,
    promptAr: text.prompt,
    hintAr: step.hintAr === undefined ? undefined : text.hint,
    explainAr: step.explainAr === undefined ? undefined : text.explain,
    sheet: step.sheet && translateDeep(step.sheet, tr.strings),
    check: translateDeep(step.check, tr.strings),
  } as StepSpec;
  if (step.hintAr !== undefined && text.hint === undefined)
    throw new Error(`${tr.slug}: step "${step.slug}" needs a hint`);
  if (step.explainAr !== undefined && text.explain === undefined)
    throw new Error(`${tr.slug}: step "${step.slug}" needs an explain`);
  if (out.type === 'MULTIPLE_CHOICE' && step.type === 'MULTIPLE_CHOICE') {
    sameLength(`${tr.slug}: step "${step.slug}" options`, step.check.options, text.options);
    out.check = { ...out.check, options: text.options! };
  }
  return out;
}

export function localizeLesson(lesson: LessonFile, tr: LessonTranslation): LessonFile {
  if (tr.slug !== lesson.slug) throw new Error(`translation ${tr.slug} is not for ${lesson.slug}`);
  sameLength(`${tr.slug}: faq`, lesson.faq, tr.faq);
  if (lesson.introAr !== undefined && tr.intro === undefined)
    throw new Error(`${tr.slug}: needs an intro`);
  return {
    ...lesson,
    titleAr: tr.title,
    summaryAr: tr.summary,
    introAr: lesson.introAr === undefined ? undefined : tr.intro,
    faq: tr.faq?.map((f) => ({ qAr: f.q, aAr: f.a })),
    steps: lesson.steps.map((step) => localizeStep(step, tr)),
  };
}

export function localizeFunction(fn: FunctionFile, tr: FunctionTranslation): FunctionFile {
  if (tr.slug !== fn.slug) throw new Error(`translation ${tr.slug} is not for ${fn.slug}`);
  sameLength(`${tr.slug}: args`, fn.args, tr.args);
  sameLength(`${tr.slug}: examples`, fn.examples, tr.examples);
  sameLength(`${tr.slug}: errors`, fn.errors, tr.errors);
  sameLength(`${tr.slug}: faq`, fn.faq, tr.faq);
  return {
    ...fn,
    titleAr: tr.title,
    summaryAr: tr.summary,
    introAr: tr.intro,
    args: fn.args.map((a, i) => ({ ...a, descAr: tr.args[i]! })),
    examples: fn.examples.map((e, i) => ({
      ...translateDeep({ sheet: e.sheet, formula: e.formula, result: e.result }, tr.strings),
      verified: e.verified,
      explainAr: tr.examples[i]!,
    })),
    errors: fn.errors.map((e, i) => ({ code: e.code, causeAr: tr.errors[i]! })),
    faq: tr.faq.map((f) => ({ qAr: f.q, aAr: f.a })),
  };
}

export function localizeTracks(tracks: TracksFile, tr: TracksTranslation): TracksFile {
  return tracks.map((t) => {
    const title = tr[t.slug];
    if (!title) throw new Error(`no translation for track "${t.slug}"`);
    return { ...t, titleAr: title };
  });
}

/** The curriculum in one language; Arabic is the source and returns as it is. */
export function curriculumIn(curriculum: Curriculum, locale: 'ar' | TranslatedLocale): Curriculum {
  if (locale === 'ar') return curriculum;
  const tr = curriculum.translations[locale];
  if (!tr) throw new Error(`no ${locale} translation in content/i18n/${locale}`);
  const need = <T>(map: Map<string, T>, slug: string): T => {
    const found = map.get(slug);
    if (!found) throw new Error(`no ${locale} translation for "${slug}"`);
    return found;
  };
  return {
    ...curriculum,
    tracks: localizeTracks(curriculum.tracks, tr.tracks),
    lessons: curriculum.lessons.map((l) => localizeLesson(l, need(tr.lessons, l.slug))),
    functions: curriculum.functions.map((f) => localizeFunction(f, need(tr.functions, f.slug))),
  };
}

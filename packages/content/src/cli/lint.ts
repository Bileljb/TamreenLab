// pnpm content:lint — validates every content file and proves every step is solvable.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { LessonFileSchema } from '@tamreen/shared';
import { formatIssue, lintContent, shortcutFallbacks } from '../lint';
import { readContent } from '../load';

const root = path.resolve(import.meta.dirname, '../../../..');
const contentDir = process.env.CONTENT_DIR ?? path.join(root, 'content');
const guide = await readFile(path.join(root, 'docs/CONTENT.md'), 'utf8').catch(() => '');

const raw = await readContent(contentDir);
const issues = lintContent(raw, { contentGuide: guide });
const steps = raw.lessons.reduce(
  (n, f) => n + ('json' in f ? ((f.json as { steps?: unknown[] }).steps?.length ?? 0) : 0),
  0,
);

for (const issue of issues) console.error(formatIssue(issue));

// Fallbacks to multiple choice should be deliberate: list them so an author sees each one.
const lessons = raw.lessons.flatMap((f) => {
  const parsed = 'json' in f ? LessonFileSchema.safeParse(f.json) : null;
  return parsed?.success ? [parsed.data] : [];
});
const fallbacks = shortcutFallbacks(lessons);
for (const platform of ['win', 'mac'] as const) {
  if (fallbacks[platform].length) {
    console.log(
      `shortcut steps shown as choices on ${platform}: ${fallbacks[platform].join(', ')}`,
    );
  }
}
console.log(
  `content:lint: ${raw.lessons.length} lessons, ${steps} steps, ${raw.functions?.length ?? 0} functions, languages ar${(raw.translations ?? []).map((t) => `, ${t.locale}`).join('')}, ${issues.length} errors`,
);
process.exit(issues.length ? 1 : 0);

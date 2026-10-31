// pnpm content:lint — validates every content file and proves every step is solvable.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { formatIssue, lintContent } from '../lint';
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
console.log(
  `content:lint: ${raw.lessons.length} lessons, ${steps} steps, ${raw.functions?.length ?? 0} functions, languages ar${(raw.translations ?? []).map((t) => `, ${t.locale}`).join('')}, ${issues.length} errors`,
);
process.exit(issues.length ? 1 : 0);

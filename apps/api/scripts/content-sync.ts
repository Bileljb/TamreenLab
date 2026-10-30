// pnpm content:sync — makes Postgres match the content files. Idempotent: a second run changes nothing.
// Flags: --dry-run prints the plan without writing. CONTENT_DIR points at another content folder.
import path from 'node:path';
import { createPrisma } from '../src/lib/prisma';
import { syncContent } from '../src/services/content-sync';

const dryRun = process.argv.includes('--dry-run');
const contentDir = process.env.CONTENT_DIR ?? path.resolve(import.meta.dirname, '../../../content');
const db = createPrisma();
try {
  const { plan, counts, applied } = await syncContent(db, contentDir, { dryRun });
  for (const error of plan.errors) console.error(`error: ${error}`);
  if (plan.errors.length) {
    process.exitCode = 1;
  } else if (counts.length === 0) {
    console.log('content:sync: 0 changes (database matches content)');
  } else {
    console.log(`content:sync: ${counts.map(([k, n]) => `${k} ${n}`).join(', ')}`);
    console.log(
      applied ? `content:sync: applied ${plan.ops.length} changes` : 'dry run: nothing written',
    );
  }
} finally {
  await db.$disconnect();
}

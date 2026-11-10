/** The pure parts of the backup scripts (ADR 013); scripts/db-backup.ts does the I/O. */

/** What a backup recorded about the database it came from. */
export type BackupManifest = {
  createdAt: string;
  /** The newest applied Prisma migration. */
  migration: string | null;
  /** Rows per table at backup time. */
  tables: Record<string, number>;
};

/** `tamreen-2026-11-10T08-05-09Z.dump`: sorts by time, no characters a file system rejects. */
export function backupFileName(at: Date): string {
  return `tamreen-${at.toISOString().slice(0, 19).replace(/:/g, '-')}Z.dump`;
}

/** The same server and credentials, another database; Prisma's `?schema=` is not for pg tools. */
export function databaseUrlFor(url: string, database: string): string {
  const u = new URL(url);
  u.pathname = `/${database}`;
  u.search = '';
  return u.toString();
}

/** The URL as seen from inside the database's own container (local Docker setups). */
export function insideContainer(url: string): string {
  const u = new URL(url);
  u.hostname = 'localhost';
  u.port = '5432';
  u.search = '';
  return u.toString();
}

/** Differences between a restored database and its backup's manifest; empty means it matches. */
export function compareManifest(
  manifest: BackupManifest,
  restored: Record<string, number>,
  restoredMigration: string | null,
): string[] {
  const problems: string[] = [];
  for (const [table, rows] of Object.entries(manifest.tables)) {
    const got = restored[table] ?? 0;
    if (got !== rows) problems.push(`${table}: ${got} rows restored, ${rows} backed up`);
  }
  for (const table of Object.keys(restored)) {
    if (!(table in manifest.tables))
      problems.push(`${table}: in the restore but not in the backup`);
  }
  if (restoredMigration !== manifest.migration) {
    problems.push(`migration: ${restoredMigration} restored, ${manifest.migration} backed up`);
  }
  return problems;
}

import { describe, expect, it } from 'vitest';
import { backupFileName, compareManifest, databaseUrlFor, insideContainer } from './backup';

const URL = 'postgresql://tamreen:tamreen@localhost:5432/tamreen?schema=public';

describe('backupFileName', () => {
  it('sorts by time and is safe on every file system', () => {
    expect(backupFileName(new Date('2026-11-10T08:05:09.123Z'))).toBe(
      'tamreen-2026-11-10T08-05-09Z.dump',
    );
  });
});

describe('databaseUrlFor', () => {
  it('points the same server at another database, without the Prisma schema parameter', () => {
    expect(databaseUrlFor(URL, 'tamreen_restore_drill')).toBe(
      'postgresql://tamreen:tamreen@localhost:5432/tamreen_restore_drill',
    );
  });
});

describe('insideContainer', () => {
  it('reaches the database from inside its own container', () => {
    expect(
      insideContainer('postgresql://tamreen:tamreen@127.0.0.1:5433/tamreen?schema=public'),
    ).toBe('postgresql://tamreen:tamreen@localhost:5432/tamreen');
  });
});

describe('compareManifest', () => {
  const manifest = {
    createdAt: '2026-11-10T08:00:00.000Z',
    migration: '20261110081537_password_reset',
    tables: { User: 3, Attempt: 40 },
  };

  it('passes when every table and the migration match', () => {
    expect(compareManifest(manifest, { ...manifest.tables }, manifest.migration)).toEqual([]);
  });

  it('lists every difference', () => {
    expect(
      compareManifest(manifest, { User: 2, Attempt: 40, Extra: 1 }, '20261109080205_engagement'),
    ).toEqual([
      'User: 2 rows restored, 3 backed up',
      'Extra: in the restore but not in the backup',
      'migration: 20261109080205_engagement restored, 20261110081537_password_reset backed up',
    ]);
    expect(compareManifest(manifest, { User: 3 }, manifest.migration)).toEqual([
      'Attempt: 0 rows restored, 40 backed up',
    ]);
  });
});

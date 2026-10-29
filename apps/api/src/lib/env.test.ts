import { describe, expect, it } from 'vitest';
import { loadEnv } from './env';

describe('loadEnv', () => {
  it('applies defaults', () => {
    const env = loadEnv({ DATABASE_URL: 'postgresql://u:p@localhost:5432/db' });
    expect(env.PORT).toBe(4000);
    expect(env.NODE_ENV).toBe('development');
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
  });
});

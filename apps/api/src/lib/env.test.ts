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

describe('loadEnv in production', () => {
  const prod = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    NODE_ENV: 'production',
    JWT_SECRET: 'x'.repeat(40),
  };

  it('requires the number of proxies in front of the site', () => {
    expect(() => loadEnv(prod)).toThrow(/TRUST_PROXY_HOPS/);
    expect(loadEnv({ ...prod, TRUST_PROXY_HOPS: '1' }).TRUST_PROXY_HOPS).toBe(1);
  });

  it('listens on localhost unless told otherwise', () => {
    expect(loadEnv({ ...prod, TRUST_PROXY_HOPS: '1' }).HOST).toBe('127.0.0.1');
  });
});

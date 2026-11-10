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

describe('loadEnv for email', () => {
  const base = { DATABASE_URL: 'postgresql://u:p@localhost:5432/db' };

  it('logs instead of sending by default, with a daily limit under the free plan', () => {
    const env = loadEnv(base);
    expect(env.MAIL_TRANSPORT).toBe('log');
    expect(env.MAIL_DAILY_LIMIT).toBe(280);
  });

  it('needs the SMTP host, user and password to send', () => {
    expect(() => loadEnv({ ...base, MAIL_TRANSPORT: 'smtp' })).toThrow(/SMTP_USER/);
    const env = loadEnv({
      ...base,
      MAIL_TRANSPORT: 'smtp',
      SMTP_HOST: 'smtp-relay.brevo.com',
      SMTP_USER: 'user@example.com',
      SMTP_PASS: 'secret',
    });
    expect(env.SMTP_PORT).toBe(587);
  });
});

describe('loadEnv with empty values', () => {
  it('treats KEY= as not set, as .env files often leave it', () => {
    const env = loadEnv({
      DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
      SMTP_USER: '',
      SMTP_PASS: '',
      GROQ_API_KEY: '',
    });
    expect(env.SMTP_USER).toBeUndefined();
    expect(env.GROQ_API_KEY).toBeUndefined();
  });
});

describe('loadEnv behind a web proxy on another host', () => {
  it('accepts PROXY_SECRET instead of a proxy hop count', () => {
    const env = loadEnv({
      DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
      NODE_ENV: 'production',
      JWT_SECRET: 'x'.repeat(40),
      PROXY_SECRET: 'y'.repeat(32),
    });
    expect(env.PROXY_SECRET).toHaveLength(32);
    expect(() =>
      loadEnv({ DATABASE_URL: 'postgresql://u:p@localhost:5432/db', PROXY_SECRET: 'short' }),
    ).toThrow(/PROXY_SECRET/);
  });
});

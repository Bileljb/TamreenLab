import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createLogger, requestId } from './logger';

function capture() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, done) {
      lines.push(String(chunk));
      done();
    },
  });
  return { lines, logger: createLogger('info', stream) };
}

describe('createLogger', () => {
  it('never writes cookies, tokens or passwords', () => {
    const { lines, logger } = capture();
    logger.info(
      {
        req: { headers: { cookie: 'tamreen_at=secret', authorization: 'Bearer secret' } },
        res: { headers: { 'set-cookie': ['tamreen_rt=secret'] } },
        body: { password: 'hunter22', token: 'reset-secret' },
      },
      'request',
    );
    expect(lines.join('')).not.toContain('secret');
    expect(lines.join('')).not.toContain('hunter22');
  });
});

describe('requestId', () => {
  it('keeps a sane incoming id and makes one otherwise', () => {
    expect(requestId('abc-123_DEF')).toBe('abc-123_DEF');
    expect(requestId('bad id with spaces')).toMatch(/^[0-9a-f-]{36}$/);
    expect(requestId('x'.repeat(200))).toMatch(/^[0-9a-f-]{36}$/);
    expect(requestId(undefined)).toMatch(/^[0-9a-f-]{36}$/);
  });
});

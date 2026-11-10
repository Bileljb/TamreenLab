import { describe, expect, it } from 'vitest';
import { apiProxyHeaders, clientIp } from './apiProxy';

describe('clientIp', () => {
  it("prefers the host's own client headers, which visitors cannot set", () => {
    expect(clientIp(new Headers({ 'x-real-ip': '198.51.100.7' }))).toBe('198.51.100.7');
    expect(clientIp(new Headers({ 'cf-connecting-ip': '2001:db8::1' }))).toBe('2001:db8::1');
    expect(clientIp(new Headers({ 'x-forwarded-for': '198.51.100.9, 10.0.0.1' }))).toBe(
      '198.51.100.9',
    );
    expect(clientIp(new Headers())).toBe('');
  });
});

describe('apiProxyHeaders', () => {
  it('adds the secret and the client IP, replacing anything the visitor sent', () => {
    const incoming = new Headers({
      cookie: 'tamreen_at=abc',
      'x-real-ip': '198.51.100.7',
      'x-tamreen-proxy': 'forged',
      'x-tamreen-client-ip': '1.1.1.1',
    });
    const out = apiProxyHeaders(incoming, 'the-secret');
    expect(out.get('x-tamreen-proxy')).toBe('the-secret');
    expect(out.get('x-tamreen-client-ip')).toBe('198.51.100.7');
    expect(out.get('cookie')).toBe('tamreen_at=abc');
  });
});

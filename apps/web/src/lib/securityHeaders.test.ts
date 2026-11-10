import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, securityHeaders } from './securityHeaders';

describe('contentSecurityPolicy', () => {
  it('keeps everything on this origin and forbids framing and plugins', () => {
    const csp = contentSecurityPolicy(false);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).not.toMatch(/https?:|\*/);
  });

  it('allows eval and the reload socket only in development', () => {
    expect(contentSecurityPolicy(false)).not.toContain('unsafe-eval');
    expect(contentSecurityPolicy(false)).not.toContain('ws:');
    expect(contentSecurityPolicy(true)).toContain("'unsafe-eval'");
    expect(contentSecurityPolicy(true)).toContain('ws:');
  });
});

describe('securityHeaders', () => {
  it('sets the usual hardening headers once each', () => {
    const keys = securityHeaders(false).map((h) => h.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(
      expect.arrayContaining([
        'Content-Security-Policy',
        'Strict-Transport-Security',
        'X-Content-Type-Options',
        'X-Frame-Options',
        'Referrer-Policy',
        'Permissions-Policy',
      ]),
    );
  });
});

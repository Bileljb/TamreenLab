/**
 * Response headers for every page (PLAN Phase 9, ADR 013).
 *
 * The pages are static, so the CSP cannot use per-request nonces: Next's inline bootstrap scripts
 * and the theme script need 'unsafe-inline'. What the policy still guarantees: nothing loads from
 * another origin, the site cannot be framed, no plugins, and forms and <base> stay on this origin.
 * When an ad network is wired (D5), its origins are added here.
 */
export function contentSecurityPolicy(dev: boolean): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    // React's dev overlay evaluates code; production never needs eval.
    'script-src': ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'"],
    'connect-src': ["'self'", ...(dev ? ['ws:'] : [])],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'object-src': ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ');
}

export function securityHeaders(dev: boolean): { key: string; value: string }[] {
  return [
    { key: 'Content-Security-Policy', value: contentSecurityPolicy(dev) },
    // Browsers ignore it over plain http, so local production runs are unaffected.
    { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
    },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ];
}

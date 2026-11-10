/**
 * Forwarding `/api/*` to an API with a public address (ADR 015). The web host (Vercel, Cloudflare)
 * sets the visitor's IP in its own headers and overwrites any copy a visitor sends, so it is
 * trustworthy here; the API cannot see it otherwise. The secret proves the request came this way.
 */
export const PROXY_HEADER = 'x-tamreen-proxy';
export const CLIENT_IP_HEADER = 'x-tamreen-client-ip';

export function clientIp(headers: Headers): string {
  return (
    headers.get('x-real-ip') ??
    headers.get('cf-connecting-ip') ??
    headers.get('x-forwarded-for')?.split(',')[0] ??
    ''
  ).trim();
}

export function apiProxyHeaders(incoming: Headers, secret: string): Headers {
  const headers = new Headers(incoming);
  headers.set(PROXY_HEADER, secret);
  headers.set(CLIENT_IP_HEADER, clientIp(incoming));
  return headers;
}

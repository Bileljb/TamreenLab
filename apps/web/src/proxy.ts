import { NextResponse, type NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { apiProxyHeaders } from './lib/apiProxy';

const intl = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    // With a public API (ADR 015), forward with the secret and the visitor's IP. Without
    // PROXY_SECRET (local development, one server), next.config's rewrite forwards as it is.
    const secret = process.env.PROXY_SECRET;
    const apiUrl = process.env.API_URL;
    if (!secret || !apiUrl) return NextResponse.next();
    const target = new URL(request.nextUrl.pathname + request.nextUrl.search, apiUrl);
    return NextResponse.rewrite(target, {
      request: { headers: apiProxyHeaders(request.headers, secret) },
    });
  }
  return intl(request);
}

export const config = {
  // The API, and every page except Next internals and files with an extension.
  matcher: ['/api/:path*', '/((?!api|_next|_vercel|.*\\..*).*)'],
};

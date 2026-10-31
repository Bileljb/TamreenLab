import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const apiUrl = process.env.API_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@tamreen/shared', '@tamreen/engine', '@tamreen/content', '@tamreen/ui'],
  // Pages import single helpers from these barrels; only what they use should ship.
  experimental: { optimizePackageImports: ['@tamreen/ui', '@tamreen/shared', '@tamreen/engine'] },
  // Same-origin API (PLAN §3.2): the browser calls /api/* here and Next proxies it to Express.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
};

export default createNextIntlPlugin('./src/i18n/request.ts')(nextConfig);

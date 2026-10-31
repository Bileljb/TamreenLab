import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    // Consent already decided, so the fixed banner never covers buttons; e2e/seo.spec.ts tests it.
    storageState: 'e2e/consent-decided.json',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  // CI runs against production builds; locally running servers are reused. The API needs Postgres
  // with the curriculum synced (docker compose up -d db, pnpm db:migrate, pnpm content:sync).
  webServer: [
    {
      command: isCI ? 'pnpm start' : 'pnpm dev',
      url: 'http://localhost:3000/ar',
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
    {
      command: isCI ? 'pnpm --filter @tamreen/api start' : 'pnpm --filter @tamreen/api dev',
      url: 'http://localhost:4000/api/health',
      reuseExistingServer: !isCI,
      timeout: 60_000,
    },
  ],
});

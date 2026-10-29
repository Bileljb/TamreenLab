import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    // CI runs against the production build; locally the dev server is reused if already running.
    command: isCI ? 'pnpm start' : 'pnpm dev',
    url: 'http://localhost:3000/ar',
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});

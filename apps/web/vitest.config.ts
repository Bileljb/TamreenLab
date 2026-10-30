import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Unit tests only; e2e/*.spec.ts belong to Playwright.
    include: ['src/**/*.test.ts'],
  },
});

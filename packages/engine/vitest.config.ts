import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/fixtures/**'],
      reporter: ['text-summary', 'text'],
      // PLAN Phase 1 acceptance: at least 90% on packages/engine.
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
    },
  },
});

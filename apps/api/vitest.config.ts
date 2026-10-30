import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Integration tests need Postgres; they run with `pnpm test:int` (vitest.int.config.ts).
    exclude: ['**/node_modules/**', '**/*.int.test.ts'],
  },
});

// Shared flat config for the non-Next packages. apps/web extends it with Next's rules.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export const base = tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/generated/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // The engine and shared schemas run in the browser too (PLAN Phase 1): no Node-only code.
    files: ['packages/engine/src/**/*.ts', 'packages/shared/src/**/*.ts'],
    ignores: ['**/*.test.ts'],
    languageOptions: { globals: { ...globals['shared-node-browser'] } },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [{ group: ['node:*'], message: 'Engine code must run in the browser.' }],
          paths: ['fs', 'path', 'os', 'crypto', 'util', 'stream', 'buffer', 'child_process'].map(
            (name) => ({ name, message: 'Engine code must run in the browser.' }),
          ),
        },
      ],
      'no-restricted-globals': ['error', 'process', 'Buffer', '__dirname', '__filename', 'require'],
    },
  },
);

export default base;

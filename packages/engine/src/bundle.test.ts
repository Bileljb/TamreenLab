import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';
import type * as Engine from './index';

// PLAN Phase 1 acceptance: the engine runs in a browser bundle with no Node-only imports.
// esbuild's browser platform cannot resolve Node built-ins, so any such import fails the build.
describe('browser bundle', () => {
  it('bundles for the browser and runs a check', async () => {
    const out = await build({
      entryPoints: ['src/index.ts'],
      bundle: true,
      platform: 'browser',
      format: 'iife',
      globalName: 'engine',
      write: false,
      logLevel: 'silent',
    });
    expect(out.errors).toEqual([]);
    const code = out.outputFiles[0]!.text;
    expect(code).not.toMatch(/\brequire\(["'](node:|fs|path|os|crypto)/);

    // Run the bundle with no Node globals in scope, as a browser would.
    const engine = new Function('process', 'require', 'Buffer', `${code}; return engine;`)(
      undefined,
      undefined,
      undefined,
    ) as typeof Engine;
    expect(engine.customEngine.evaluate({ A1: 2, A2: 3 }, '=SUM(A1:A2)')).toBe(5);
  });
});

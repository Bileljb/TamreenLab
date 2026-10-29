// Bundles the API with esbuild. Workspace packages (@tamreen/*) ship as TypeScript source,
// so they are bundled in; every other dependency stays external and is loaded from node_modules.
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));
const external = Object.keys(pkg.dependencies ?? {}).filter(
  (name) => !name.startsWith('@tamreen/'),
);

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  sourcemap: true,
  external: [...external, ...external.map((name) => `${name}/*`)],
});

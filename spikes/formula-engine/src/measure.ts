// Prints the numbers used in docs/adr/001-formula-engine.md: bundle size, speed, function coverage.
// Run with: pnpm --filter @tamreen/formula-engine-spike measure
import { build } from 'esbuild';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { HyperFormula } from 'hyperformula';
import { cases, cellsFor } from './cases';
import { SUPPORTED_FUNCTIONS, customEngine } from './custom';
import { hyperFormulaEngine } from './hyperformula-engine';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

async function bundleSize(entry: string) {
  const result = await build({
    entryPoints: [here(entry)],
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    write: false,
  });
  const code = result.outputFiles[0]!.contents;
  return { minKb: code.length / 1024, gzipKb: gzipSync(code).length / 1024 };
}

function timePerEval(engine: typeof customEngine, rounds = 200) {
  const start = performance.now();
  for (let r = 0; r < rounds; r++) {
    for (const c of cases) engine.evaluate(cellsFor(c), c.formula);
  }
  return (performance.now() - start) / (rounds * cases.length);
}

// Functions named in PLAN §1.2 / §2.1 that a v1–v2 curriculum is likely to need.
const CURRICULUM = `SUM AVERAGE MIN MAX COUNT COUNTA ROUND IF AND OR XOR NOT IFS SWITCH IFERROR
ISNUMBER ISTEXT ISBLANK SUMIF SUMIFS COUNTIF COUNTIFS AVERAGEIF LARGE SMALL MEDIAN MODE
VLOOKUP HLOOKUP XLOOKUP MATCH INDEX LEN LEFT RIGHT MID FIND SEARCH CONCAT TEXTJOIN UPPER
LOWER PROPER SUBSTITUTE TEXTBEFORE TEXTAFTER DATE TODAY DATEDIF DAYS ODD EVEN FLOOR CEILING
UNIQUE FILTER`.split(/\s+/);

const fmt = (n: number) => n.toFixed(1);

const [hfSize, customSize] = await Promise.all([
  bundleSize('./entry-hyperformula.ts'),
  bundleSize('./entry-custom.ts'),
]);
const hfNames = new Set(HyperFormula.getRegisteredFunctionNames('enGB'));
const customNames = new Set(SUPPORTED_FUNCTIONS);
const hfMissing = CURRICULUM.filter((f) => !hfNames.has(f));
const customMissing = CURRICULUM.filter((f) => !customNames.has(f));

console.log('| | HyperFormula | custom |');
console.log('|---|---|---|');
console.log(`| Bundle, minified | ${fmt(hfSize.minKb)} KB | ${fmt(customSize.minKb)} KB |`);
console.log(`| Bundle, min + gzip | ${fmt(hfSize.gzipKb)} KB | ${fmt(customSize.gzipKb)} KB |`);
console.log(
  `| Avg time per evaluation (incl. sheet build) | ${timePerEval(hyperFormulaEngine).toFixed(3)} ms | ${timePerEval(customEngine).toFixed(3)} ms |`,
);
console.log(`| Functions implemented | ${hfNames.size} | ${customNames.size} |`);
console.log(
  `| Curriculum functions covered | ${CURRICULUM.length - hfMissing.length}/${CURRICULUM.length} | ${CURRICULUM.length - customMissing.length}/${CURRICULUM.length} |`,
);
console.log(`\nHyperFormula missing: ${hfMissing.join(', ') || 'none'}`);
console.log(`custom missing: ${customMissing.join(', ') || 'none'}`);

// Lighthouse budgets (PLAN Phases 2 and 5) on a running production build:
//   accessibility >= 90, SEO >= 95, mobile performance >= 85, mobile LCP < 2.5 s, CLS < 0.1.
// Run: pnpm build && pnpm start (and the API), then `pnpm lighthouse`.
import { chromium } from '@playwright/test';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const PAGES = [
  '/ar',
  '/ar/lessons',
  '/ar/lessons/basics/cells-and-selection',
  '/ar/lessons/aggregation/sum-basics',
  '/ar/functions/vlookup',
  '/en',
  '/en/lessons/conditional/sumif-basics',
  '/fr/lessons/aggregation/sum-basics',
  '/fr/functions/vlookup',
];
const BUDGET = { accessibility: 90, seo: 95, performance: 85, lcpMs: 2500, cls: 0.1 };

const chrome = await chromeLauncher.launch({
  chromePath: chromium.executablePath(),
  chromeFlags: ['--headless=new', '--no-sandbox'],
});

const failures = [];
try {
  for (const page of PAGES) {
    for (const formFactor of ['mobile', 'desktop']) {
      const { lhr } = await lighthouse(`${BASE_URL}${page}`, {
        port: chrome.port,
        onlyCategories: ['accessibility', 'seo', 'performance'],
        formFactor,
        screenEmulation:
          formFactor === 'desktop'
            ? { mobile: false, width: 1280, height: 800, deviceScaleFactor: 1, disabled: false }
            : undefined,
        throttling:
          formFactor === 'desktop'
            ? { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1 }
            : undefined,
        logLevel: 'error',
      });
      const score = (c) => Math.round((lhr.categories[c].score ?? 0) * 100);
      const lcp = lhr.audits['largest-contentful-paint'].numericValue ?? 0;
      const cls = lhr.audits['cumulative-layout-shift'].numericValue ?? 0;
      const row = {
        a11y: score('accessibility'),
        seo: score('seo'),
        perf: score('performance'),
        lcp: Math.round(lcp),
        cls: Number(cls.toFixed(3)),
      };
      const problems = [];
      if (row.a11y < BUDGET.accessibility) problems.push(`a11y ${row.a11y}`);
      if (row.seo < BUDGET.seo) problems.push(`seo ${row.seo}`);
      if (row.cls >= BUDGET.cls) problems.push(`cls ${row.cls}`);
      if (formFactor === 'mobile') {
        if (row.perf < BUDGET.performance) problems.push(`perf ${row.perf}`);
        if (row.lcp >= BUDGET.lcpMs) problems.push(`lcp ${row.lcp}ms`);
      }
      console.log(
        `${problems.length ? 'LOW' : 'ok '} ${formFactor.padEnd(7)} a11y ${row.a11y}  seo ${row.seo}  perf ${row.perf}  lcp ${row.lcp}ms  cls ${row.cls}  ${page}`,
      );
      if (problems.length) {
        failures.push(`${page} (${formFactor}): ${problems.join(', ')}`);
        const failing = Object.values(lhr.audits)
          .filter((a) => a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== 'informative')
          .map((a) => a.id);
        console.log(`    weak audits: ${failing.slice(0, 12).join(', ')}`);
      }
    }
  }
} finally {
  await chrome.kill();
}

if (failures.length) {
  console.error(`\nOver budget:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}

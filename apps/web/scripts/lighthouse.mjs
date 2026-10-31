// Lighthouse accessibility check (PLAN Phase 2: score >= 90 on the lesson pages).
// Needs the web app running: `pnpm build && pnpm start`, then `pnpm a11y`.
import { chromium } from '@playwright/test';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const MIN_SCORE = 90;
const PAGES = [
  '/ar',
  '/ar/lessons/basics/cells-and-selection',
  '/ar/lessons/aggregation/sum-basics',
];

const chrome = await chromeLauncher.launch({
  chromePath: chromium.executablePath(),
  chromeFlags: ['--headless=new', '--no-sandbox'],
});

let failed = false;
try {
  for (const page of PAGES) {
    const url = `${BASE_URL}${page}`;
    for (const formFactor of ['mobile', 'desktop']) {
      const result = await lighthouse(url, {
        port: chrome.port,
        onlyCategories: ['accessibility'],
        formFactor,
        screenEmulation:
          formFactor === 'desktop'
            ? { mobile: false, width: 1280, height: 800, deviceScaleFactor: 1, disabled: false }
            : undefined,
        logLevel: 'error',
      });
      const lhr = result.lhr;
      const score = Math.round((lhr.categories.accessibility.score ?? 0) * 100);
      const failing = Object.values(lhr.audits)
        .filter((a) => a.score === 0 && a.scoreDisplayMode === 'binary')
        .map((a) => a.id);
      console.log(`${score >= MIN_SCORE ? 'ok ' : 'LOW'} ${score} ${formFactor.padEnd(7)} ${page}`);
      if (failing.length) console.log(`    failing audits: ${failing.join(', ')}`);
      if (score < MIN_SCORE) failed = true;
    }
  }
} finally {
  await chrome.kill();
}

process.exit(failed ? 1 : 0);

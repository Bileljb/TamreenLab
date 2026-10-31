import { expect, test } from '@playwright/test';

test.skip(({ isMobile }) => isMobile, 'page checks need one viewport');

test('every sitemap URL returns 200, is indexable and has a canonical URL', async ({ request }) => {
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]!).pathname);
  // 8 static pages, 20 lessons and 15 function pages.
  expect(urls.length).toBeGreaterThanOrEqual(43);
  expect(urls).toContain('/ar/lessons/basics/cells-and-selection');
  expect(urls).toContain('/ar/functions/vlookup');
  expect(urls).not.toContain('/ar/login');

  for (const path of urls) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(200);
    expect(res.headers()['x-robots-tag'] ?? '', path).not.toContain('noindex');
    const html = await res.text();
    expect(html, path).not.toMatch(/<meta name="robots" content="[^"]*noindex/);
    expect(html, path).toContain(`<link rel="canonical" href="http://localhost:3000${path}"`);
    expect(html, path).toMatch(/<html lang="ar" dir="rtl"/);
  }
});

test('robots.txt points at the sitemap and keeps sign-in pages out', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Sitemap: http://localhost:3000/sitemap.xml');
  expect(robots).toContain('Disallow: /ar/login');
  const login = await (await request.get('/ar/login')).text();
  expect(login).toMatch(/<meta name="robots" content="noindex, nofollow"/);
});

test('a lesson page is readable without JavaScript and carries structured data', async ({
  request,
}) => {
  const html = await (await request.get('/ar/lessons/aggregation/sum-basics')).text();
  // The explanation and FAQ are in the server HTML; the player loads later in the browser.
  expect(html).toContain('الجمع بالدالة SUM');
  expect(html).toContain('تبدأ كل');
  expect(html).toContain('"@type":"LearningResource"');
  expect(html).toContain('"@type":"FAQPage"');
  expect(html).toContain('"@type":"BreadcrumbList"');
  expect(html).toContain('og:image');
});

test('no ad slot inside or beside the exercise player', async ({ page }) => {
  for (const path of [
    '/ar/lessons/basics/cells-and-selection',
    '/ar/functions/sumif',
    '/ar/lessons',
  ]) {
    await page.goto(path);
    await expect(page.locator('[data-ad-slot]').first()).toBeVisible();
    expect(await page.locator('[data-player-area] [data-ad-slot]').count(), path).toBe(0);
  }
  // On the lesson page the ad sits after the FAQ, well below the player.
  await page.goto('/ar/lessons/basics/cells-and-selection');
  await expect(page.locator('[data-active="true"]')).toBeVisible();
  const player = (await page.locator('[data-player-area]').boundingBox())!;
  const ad = (await page.locator('[data-ad-slot]').first().boundingBox())!;
  expect(ad.y).toBeGreaterThan(player.y + player.height + 200);
});

test.describe('consent', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('asks once, remembers the choice, and stops analytics when refused', async ({ page }) => {
    const events: string[] = [];
    page.on('request', (r) => {
      if (r.url().endsWith('/api/events')) events.push(r.postData() ?? '');
    });
    await page.goto('/ar/lessons/basics/cells-and-selection');
    const banner = page.getByRole('region', { name: 'خيارات الخصوصية' });
    await expect(banner).toBeVisible();
    await banner.getByRole('button', { name: 'رفض الاختياري' }).click();
    await expect(banner).toBeHidden();
    const stored = await page.evaluate(() => localStorage.getItem('tamreen.consent.v1'));
    expect(JSON.parse(stored!)).toMatchObject({ analytics: false, personalisedAds: false });

    events.length = 0;
    await page.reload();
    await expect(page.locator('[data-active="true"]')).toBeVisible();
    await expect(banner).toBeHidden();
    await page.waitForTimeout(500);
    expect(events).toEqual([]);
  });
});

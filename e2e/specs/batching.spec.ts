import { expect, test } from '@playwright/test';
import { fixtureLevel, gotoLevel, solveLevel } from './helpers';

test('exactly one batch request on entry; exactly two after the prefetch window', async ({
  page,
}) => {
  const batchRequests: string[] = [];
  page.on('request', (req) => {
    if (/\/data\/batch-\d+\./.test(req.url())) batchRequests.push(req.url());
  });

  await page.goto('./');
  await expect(page.getByTestId('grid')).toBeVisible();

  // Play a few moves on level 1, then hop around the front of the batch.
  const level = fixtureLevel(1);
  const revealed = new Set(level.revealed.map(([num]) => num));
  const i = level.cipher.findIndex((num) => num !== -1 && !revealed.has(num));
  await page.getByTestId(`cell-${i}`).click();
  await page.getByTestId(`key-${level.solution[i]}`).click();
  await gotoLevel(page, 3);
  await expect(page.getByTestId('level-input')).toHaveValue('3');
  await expect(page.getByTestId('grid')).toBeVisible();

  expect(batchRequests.filter((u) => u.includes('batch-000'))).toHaveLength(1);
  expect(batchRequests).toHaveLength(1);

  // Level 45 is within the last 10 levels of batch 0 (fixture batches are
  // 1-50 and 51-60): the next batch is prefetched, and only that one.
  await gotoLevel(page, 45);
  await expect(page.getByTestId('level-input')).toHaveValue('45');
  await expect(page.getByTestId('grid')).toBeVisible();
  await expect.poll(() => batchRequests.length).toBe(2);
  expect(batchRequests.filter((u) => u.includes('batch-001'))).toHaveLength(1);

  // Moving deeper into the window must not fetch anything more.
  await gotoLevel(page, 48);
  await expect(page.getByTestId('grid')).toBeVisible();
  await page.waitForTimeout(300);
  expect(batchRequests).toHaveLength(2);
});

test('entering the prefetched batch does not refetch it over the network', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'service worker cache assertions are chromium-only');
  await page.goto('./');
  await expect(page.getByTestId('grid')).toBeVisible();
  await gotoLevel(page, 45);
  await expect(page.getByTestId('grid')).toBeVisible();
  // Wait for the prefetch to land in Cache Storage.
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const cache = await caches.open('runtime-v1');
        const keys = await cache.keys();
        return keys.filter((k) => /batch-001/.test(k.url)).length;
      }),
    )
    .toBe(1);
  await gotoLevel(page, 51);
  await expect(page.getByTestId('tier')).toBeVisible();
});

test('a solved level within the prefetch window still counts one fetch of its own batch', async ({
  page,
}) => {
  // Regression guard for double-fetching under StrictMode double effects.
  const batchRequests: string[] = [];
  page.on('request', (req) => {
    if (/\/data\/batch-000\./.test(req.url())) batchRequests.push(req.url());
  });
  await page.goto('./');
  await expect(page.getByTestId('grid')).toBeVisible();
  await solveLevel(page, fixtureLevel(1));
  await expect(page.getByTestId('attribution')).toBeVisible();
  expect(batchRequests).toHaveLength(1);
});

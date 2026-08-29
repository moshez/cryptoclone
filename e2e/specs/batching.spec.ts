import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, Server } from 'node:http';
import { expect, test } from '@playwright/test';
import { makeServer } from '../serve.mjs';
import { firstFillableCell, fixtureLevel, gotoLevel, solveLevel } from './helpers';

const here = dirname(fileURLToPath(import.meta.url));

/** Batch-fetch counting runs against a dedicated per-worker server and
 * counts requests as the server sees them. Counting `page.on('request')`
 * events is unreliable once the service worker controls the page: WebKit
 * reports a SW-intercepted load twice (the page's request and the worker's
 * pass-through fetch), while the network is only hit once. The invariant
 * these tests protect is network economy, so count on the network side. */
async function startCountingServer(): Promise<{
  server: Server;
  origin: string;
  batchHits: string[];
}> {
  const batchHits: string[] = [];
  const server = makeServer(join(here, '../.serve/build-a'), '/cryptoclone/');
  server.on('request', (req: IncomingMessage) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (/\/data\/batch-\d+\./.test(path)) batchHits.push(path);
  });
  const port = 4300 + test.info().workerIndex;
  await new Promise<void>((ok) => server.listen(port, ok));
  return { server, origin: `http://localhost:${port}/cryptoclone/`, batchHits };
}

test('exactly one batch request on entry; exactly two after the prefetch window', async ({
  page,
}) => {
  const { server, origin, batchHits } = await startCountingServer();
  try {
    await page.goto(origin);
    await expect(page.getByTestId('grid')).toBeVisible();

    // Play a few moves on level 1, then hop around the front of the batch.
    const level = fixtureLevel(1);
    const i = firstFillableCell(level);
    await page.getByTestId(`cell-${i}`).click();
    await page.getByTestId(`key-${level.solution[i]}`).click();
    await gotoLevel(page, 3);
    await expect(page.getByTestId('level-input')).toHaveValue('3');
    await expect(page.getByTestId('grid')).toBeVisible();

    expect(batchHits.filter((u) => u.includes('batch-000'))).toHaveLength(1);
    expect(batchHits).toHaveLength(1);

    // Level 45 is within the last 10 levels of batch 0 (fixture batches are
    // 1-50 and 51-60): the next batch is prefetched, and only that one.
    await gotoLevel(page, 45);
    await expect(page.getByTestId('level-input')).toHaveValue('45');
    await expect(page.getByTestId('grid')).toBeVisible();
    await expect.poll(() => batchHits.length).toBe(2);
    expect(batchHits.filter((u) => u.includes('batch-001'))).toHaveLength(1);

    // Moving deeper into the window must not fetch anything more.
    await gotoLevel(page, 48);
    await expect(page.getByTestId('grid')).toBeVisible();
    await page.waitForTimeout(300);
    expect(batchHits).toHaveLength(2);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((ok) => server.close(() => ok()));
  }
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
  const { server, origin, batchHits } = await startCountingServer();
  try {
    await page.goto(origin);
    await expect(page.getByTestId('grid')).toBeVisible();
    await solveLevel(page, fixtureLevel(1));
    await expect(page.getByTestId('attribution')).toBeVisible();
    expect(batchHits.filter((u) => u.includes('batch-000'))).toHaveLength(1);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((ok) => server.close(() => ok()));
  }
});

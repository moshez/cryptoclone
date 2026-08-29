/* The test that protects "a reload always gives you the current deployed
 * version": serve build A, load it, swap the served directory to build B,
 * reload, and require the displayed build id to be B's within one reload. */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { symlinkSync, unlinkSync } from 'node:fs';
import type { Server } from 'node:http';
import { expect, test } from '@playwright/test';
import { makeServer } from '../serve.mjs';
import { waitForServiceWorker } from './helpers';

const here = dirname(fileURLToPath(import.meta.url));
const serveDir = join(here, '../.serve');

// Parallel workers (other viewport projects) must not collide on ports or
// symlinks, so both are derived from the worker index.
const port = () => 4180 + test.info().workerIndex;
const linkName = () => `stale-current-${test.info().workerIndex}`;

function pointServerAt(build: string) {
  const link = join(serveDir, linkName());
  try {
    unlinkSync(link);
  } catch {
    /* first call */
  }
  symlinkSync(build, link);
}

async function startServer(): Promise<Server> {
  const server = makeServer(join(serveDir, linkName()), '/cryptoclone/');
  await new Promise<void>((ok) => server.listen(port(), ok));
  return server;
}

test.describe.configure({ mode: 'serial' });

test('a reload after a deploy shows the new build id within one reload', async ({
  browser,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'service worker update flow is chromium-only here');

  pointServerAt('build-a');
  const server = await startServer();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`http://localhost:${port()}/cryptoclone/`);
    await expect(page.getByTestId('build-id')).toHaveText('build e2e-build-a');
    await waitForServiceWorker(page);

    // "Deploy" build B.
    pointServerAt('build-b');
    await page.reload();
    // Network-first navigation serves B's HTML immediately; the SW update
    // (SKIP_WAITING + guarded reload) must not bounce us back to A.
    await expect(page.getByTestId('build-id')).toHaveText('build e2e-build-b', {
      timeout: 15_000,
    });

    // And the page must settle: still B after the SW settles, no loop.
    await page.waitForTimeout(1_500);
    await expect(page.getByTestId('build-id')).toHaveText('build e2e-build-b');
    await context.close();
  } finally {
    await new Promise((ok) => server.close(ok));
  }
});

test('offline reload after the update still works from the new precache', async ({
  browser,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'service worker update flow is chromium-only here');

  pointServerAt('build-b');
  const server = await startServer();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`http://localhost:${port()}/cryptoclone/`);
    await waitForServiceWorker(page);
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const cache = await caches.open('runtime-v1');
          return (await cache.keys()).length >= 2;
        }),
      )
      .toBe(true);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByTestId('grid')).toBeVisible();
    await expect(page.getByTestId('build-id')).toHaveText('build e2e-build-b');
    await context.close();
  } finally {
    await new Promise((ok) => server.close(ok));
  }
});

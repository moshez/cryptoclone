import { expect, test } from '@playwright/test';
import { fixtureLevel, waitForServiceWorker } from './helpers';

test('the current level stays playable offline after one visit', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'setOffline + service workers are chromium-only here');

  await page.goto('./');
  await expect(page.getByTestId('grid')).toBeVisible();
  await waitForServiceWorker(page);
  // The page writes manifest and batch responses into Cache Storage itself,
  // so one visit is enough; wait until both are cached.
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const cache = await caches.open('runtime-v1');
        const keys = await cache.keys();
        return {
          manifest: keys.some((k) => k.url.includes('manifest.json')),
          batch: keys.some((k) => /batch-000/.test(k.url)),
        };
      }),
    )
    .toEqual({ manifest: true, batch: true });

  await context.setOffline(true);
  await page.reload();

  await expect(page.getByTestId('grid')).toBeVisible();
  const level = fixtureLevel(1);
  const revealed = new Set(level.revealed.map(([num]) => num));
  const i = level.cipher.findIndex((num) => num !== -1 && !revealed.has(num));
  await page.getByTestId(`cell-${i}`).click();
  await page.getByTestId(`key-${level.solution[i]}`).click();
  await expect(page.getByTestId(`cell-${i}`).locator('.cell-letter')).toHaveText(
    level.solution[i],
  );
  await context.setOffline(false);
});

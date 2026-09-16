import { expect, test } from '@playwright/test';
import { fixtureManifest } from './helpers';

const SUBSCRIBE_URL = 'https://moshe-zadka.kit.com/4673940f8b';
const SUBSCRIBE_TEXT = 'Subscribe to hear about more games or updates to games';

test('the level list opens from the top bar and jumps to a level', async ({ page }) => {
  const total = fixtureManifest().totalLevels as number;
  await page.goto('./');
  await expect(page.getByTestId('grid')).toBeVisible();

  await page.getByTestId('open-levels').click();
  await expect(page.getByTestId('level-list')).toBeVisible();
  // The puzzle and its keyboard leave the page entirely while the map is up.
  await expect(page.getByTestId('grid')).toHaveCount(0);
  await expect(page.getByTestId('keyboard')).toHaveCount(0);
  await expect(page.getByTestId('level-tile-1')).toHaveAttribute('aria-current', 'true');
  await expect(page.getByTestId(`level-tile-${total}`)).toBeVisible();
  await expect(page.getByTestId(`level-tile-${total + 1}`)).toHaveCount(0);

  await page.getByTestId('level-tile-7').click();
  await expect(page.getByTestId('level-list')).toHaveCount(0);
  await expect(page.getByTestId('grid')).toBeVisible();
  await expect(page.getByTestId('level-input')).toHaveValue('7');

  // Reopening the map marks the level just picked as current.
  await page.getByTestId('open-levels').click();
  await expect(page.getByTestId('level-tile-7')).toHaveAttribute('aria-current', 'true');
  await expect(page.getByTestId('level-tile-1')).not.toHaveAttribute('aria-current', 'true');
  await page.getByTestId('close-levels').click();
  await expect(page.getByTestId('grid')).toBeVisible();
  await expect(page.getByTestId('level-input')).toHaveValue('7');
});

test('subscribe link lives on the level list, not the puzzle', async ({ page, context }) => {
  await page.goto('./');
  await expect(page.getByTestId('grid')).toBeVisible();
  await expect(page.getByTestId('subscribe-link')).toHaveCount(0);

  await page.getByTestId('open-levels').click();
  const link = page.getByTestId('subscribe-link');
  await expect(link).toBeVisible();
  // Above the fold: the whole call to action is on screen the moment the
  // map opens, without scrolling, on every configured viewport.
  await expect(link).toBeInViewport({ ratio: 1 });
  await expect(link).toHaveText(SUBSCRIBE_TEXT);
  await expect(link).toHaveAttribute('href', SUBSCRIBE_URL);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');

  // The click must open a new tab at the destination. Stub the destination
  // itself: this proves the anchor works, not that kit.com is reachable.
  await context.route(`${SUBSCRIBE_URL}*`, (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<title>stub</title>' }),
  );
  const [popup] = await Promise.all([context.waitForEvent('page'), link.click()]);
  await popup.waitForURL(SUBSCRIBE_URL);
  expect(popup.url()).toBe(SUBSCRIBE_URL);
  await popup.close();

  // Back on the puzzle the link is gone again.
  await page.getByTestId('close-levels').click();
  await expect(page.getByTestId('grid')).toBeVisible();
  await expect(page.getByTestId('subscribe-link')).toHaveCount(0);
});

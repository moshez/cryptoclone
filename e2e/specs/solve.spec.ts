import { expect, test } from '@playwright/test';
import { fixtureLevel, solveLevel } from './helpers';

test('level 1 solves end-to-end via the on-screen keyboard', async ({ page }) => {
  const level = fixtureLevel(1);
  await page.goto('./');
  await expect(page.getByTestId('grid')).toBeVisible();

  await solveLevel(page, level);

  const card = page.getByTestId('attribution');
  await expect(card).toBeVisible();
  await expect(page.getByTestId('attribution-author')).toHaveText(level.attribution.author);
  await expect(page.getByTestId('attribution-work')).toHaveText(level.attribution.work);
  await expect(page.getByTestId('attribution-essay')).toContainText(level.attribution.essay);
  // Every cell shows its solved letter.
  for (let i = 0; i < level.cipher.length; i++) {
    if (level.cipher[i] === -1) continue;
    await expect(page.getByTestId(`cell-${i}`).locator('.cell-letter')).toHaveText(
      level.solution[i],
    );
  }
});

test('completion persists across reload and next navigates on', async ({ page }) => {
  const level = fixtureLevel(1);
  await page.goto('./');
  await expect(page.getByTestId('grid')).toBeVisible();
  await solveLevel(page, level);
  await expect(page.getByTestId('attribution')).toBeVisible();

  await page.reload();
  await expect(page.getByTestId('attribution')).toBeVisible();

  await page.getByTestId('next-after-solve').click();
  await expect(page.getByTestId('level-input')).toHaveValue('2');
  await expect(page.getByTestId('attribution')).toHaveCount(0);
});

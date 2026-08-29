import { expect, test } from '@playwright/test';
import { fixtureLevel } from './helpers';

test('assigning a letter fills every cell with that cipher symbol', async ({ page }) => {
  const level = fixtureLevel(1);
  await page.goto('./');
  await expect(page.getByTestId('grid')).toBeVisible();

  // Pick an unrevealed symbol that occurs at least twice.
  const revealed = new Set(level.revealed.map(([num]) => num));
  const counts = new Map<number, number[]>();
  level.cipher.forEach((num, i) => {
    if (num !== -1 && !revealed.has(num)) {
      counts.set(num, [...(counts.get(num) ?? []), i]);
    }
  });
  const [num, indices] = [...counts.entries()].find(([, idx]) => idx.length >= 2)!;
  const letter = level.solution[indices[0]];

  await page.getByTestId(`cell-${indices[0]}`).click();
  await page.getByTestId(`key-${letter}`).click();
  for (const i of indices) {
    await expect(page.getByTestId(`cell-${i}`).locator('.cell-letter')).toHaveText(letter);
  }
  // The keyboard marks the letter as used.
  await expect(page.getByTestId(`key-${letter}`)).toHaveClass(/key-used/);
});

test('clearing a cell clears its symbol everywhere; reset restores the start', async ({
  page,
}) => {
  const level = fixtureLevel(1);
  await page.goto('./');
  await expect(page.getByTestId('grid')).toBeVisible();

  const revealed = new Set(level.revealed.map(([num]) => num));
  const i = level.cipher.findIndex((num) => num !== -1 && !revealed.has(num));
  const letter = level.solution[i];

  await page.getByTestId(`cell-${i}`).click();
  await page.getByTestId(`key-${letter}`).click();
  await expect(page.getByTestId(`cell-${i}`).locator('.cell-letter')).toHaveText(letter);

  await page.getByTestId(`cell-${i}`).click();
  await page.getByTestId('key-clear').click();
  await expect(page.getByTestId(`cell-${i}`).locator('.cell-letter')).toHaveText('');

  await page.getByTestId(`key-${letter}`).click();
  await page.getByTestId('key-reset').click();
  await expect(page.getByTestId(`cell-${i}`).locator('.cell-letter')).toHaveText('');
});

test('three wrong letters reset the puzzle', async ({ page }) => {
  const level = fixtureLevel(1);
  await page.goto('./');
  await expect(page.getByTestId('grid')).toBeVisible();

  const revealed = new Set(level.revealed.map(([num]) => num));
  const revealedLetters = new Set(level.revealed.map(([, l]) => l));
  const i = level.cipher.findIndex((num) => num !== -1 && !revealed.has(num));
  const correct = level.solution[i];
  const wrongs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    .split('')
    .filter((l) => l !== correct && !revealedLetters.has(l))
    .slice(0, 3);

  for (const [n, wrong] of wrongs.entries()) {
    await page.getByTestId(`cell-${i}`).click();
    await page.getByTestId(`key-${wrong}`).click();
    const pips = page.getByTestId('errors').locator('.pip-hit');
    // After the third error the puzzle resets and the pips go back to 0.
    await expect(pips).toHaveCount(n < 2 ? n + 1 : 0);
  }
  await expect(page.getByTestId(`cell-${i}`).locator('.cell-letter')).toHaveText('');
});

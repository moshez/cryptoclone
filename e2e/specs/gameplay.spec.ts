import { expect, test } from '@playwright/test';
import { fixtureLevel } from './helpers';

test('a letter fills only the selected cell, never its whole symbol', async ({ page }) => {
  const level = fixtureLevel(1);
  await page.goto('./');
  await expect(page.getByTestId('grid')).toBeVisible();

  // Pick a symbol with at least two empty (unrevealed) cells.
  const revealed = new Set(level.revealedIndices);
  const counts = new Map<number, number[]>();
  level.cipher.forEach((num, i) => {
    if (num !== -1 && !revealed.has(i)) {
      counts.set(num, [...(counts.get(num) ?? []), i]);
    }
  });
  const [, indices] = [...counts.entries()].find(([, idx]) => idx.length >= 2)!;
  const letter = level.solution[indices[0]];

  await page.getByTestId(`cell-${indices[0]}`).click();
  await page.getByTestId(`key-${letter}`).click();
  await expect(page.getByTestId(`cell-${indices[0]}`).locator('.cell-letter')).toHaveText(
    letter,
  );
  // The other cells of the same symbol stay empty: the player fills them.
  for (const i of indices.slice(1)) {
    await expect(page.getByTestId(`cell-${i}`).locator('.cell-letter')).toHaveText('');
  }

  // Once every cell of the letter is filled, the keyboard marks it done.
  await expect(page.getByTestId(`key-${letter}`)).not.toHaveClass(/key-used/);
  for (const i of indices.slice(1)) {
    await page.getByTestId(`cell-${i}`).click();
    await page.getByTestId(`key-${letter}`).click();
  }
  await expect(page.getByTestId(`key-${letter}`)).toHaveClass(/key-used/);
});

test('a revealed cell hints the mapping but leaves its other cells open', async ({
  page,
}) => {
  const level = fixtureLevel(1);
  await page.goto('./');
  await expect(page.getByTestId('grid')).toBeVisible();

  // Find a revealed cell whose symbol occurs elsewhere.
  const revealed = new Set(level.revealedIndices);
  const hint = level.revealedIndices.find((r) =>
    level.cipher.some((num, i) => i !== r && num === level.cipher[r] && !revealed.has(i)),
  )!;
  const other = level.cipher.findIndex(
    (num, i) => i !== hint && num === level.cipher[hint] && !revealed.has(i),
  );

  await expect(page.getByTestId(`cell-${hint}`).locator('.cell-letter')).toHaveText(
    level.solution[hint],
  );
  await expect(page.getByTestId(`cell-${other}`).locator('.cell-letter')).toHaveText('');

  // The player fills the sibling cell themselves with the hinted letter.
  await page.getByTestId(`cell-${other}`).click();
  await page.getByTestId(`key-${level.solution[other]}`).click();
  await expect(page.getByTestId(`cell-${other}`).locator('.cell-letter')).toHaveText(
    level.solution[other],
  );
  await expect(page.getByTestId('errors').locator('.pip-hit')).toHaveCount(0);
});

test('a filled cell is final; only reset restores the start', async ({ page }) => {
  const level = fixtureLevel(1);
  await page.goto('./');
  await expect(page.getByTestId('grid')).toBeVisible();

  const revealed = new Set(level.revealedIndices);
  const a = level.cipher.findIndex((num, i) => num !== -1 && !revealed.has(i));
  const letter = level.solution[a];
  const other = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find((l) => l !== letter)!;

  await page.getByTestId(`cell-${a}`).click();
  await page.getByTestId(`key-${letter}`).click();
  await expect(page.getByTestId(`cell-${a}`).locator('.cell-letter')).toHaveText(letter);

  // Re-selecting the filled cell disables the keyboard: no changing it.
  await page.getByTestId(`cell-${a}`).click();
  await expect(page.getByTestId(`key-${other}`)).toBeDisabled();
  // Typing on the physical keyboard is rejected too.
  await page.keyboard.press(other);
  await expect(page.getByTestId(`cell-${a}`).locator('.cell-letter')).toHaveText(letter);
  await expect(page.getByTestId('errors').locator('.pip-hit')).toHaveCount(0);

  await page.getByTestId('key-reset').click();
  await expect(page.getByTestId(`cell-${a}`).locator('.cell-letter')).toHaveText('');
  // Revealed cells survive the reset.
  const r = level.revealedIndices[0];
  await expect(page.getByTestId(`cell-${r}`).locator('.cell-letter')).toHaveText(
    level.solution[r],
  );
});

test('three wrong letters reset the puzzle', async ({ page }) => {
  const level = fixtureLevel(1);
  await page.goto('./');
  await expect(page.getByTestId('grid')).toBeVisible();

  const revealed = new Set(level.revealedIndices);
  const i = level.cipher.findIndex((num, idx) => num !== -1 && !revealed.has(idx));
  const correct = level.solution[i];
  const wrongs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    .split('')
    .filter((l) => l !== correct)
    .slice(0, 3);

  for (const [n, wrong] of wrongs.entries()) {
    await page.getByTestId(`cell-${i}`).click();
    await page.getByTestId(`key-${wrong}`).click();
    const pips = page.getByTestId('errors').locator('.pip-hit');
    // After the third error the puzzle resets and the pips go back to 0.
    await expect(pips).toHaveCount(n < 2 ? n + 1 : 0);
    // The wrong letter never sticks: once the flash fades the cell is empty.
    await expect(page.getByTestId(`cell-${i}`).locator('.cell-letter')).toHaveText('');
    await expect(page.getByTestId(`cell-${i}`)).not.toHaveClass(/cell-error/);
  }
});

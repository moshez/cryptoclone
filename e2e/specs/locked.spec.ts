import { expect, test } from '@playwright/test';
import { fixtureLevels, gotoLevel, type FixtureLevel } from './helpers';

function findLockedFixture(): { level: FixtureLevel; locked: number; neighbour: number } {
  for (const level of fixtureLevels()) {
    const revealed = new Set(level.revealedIndices);
    for (const locked of level.lockedIndices) {
      const dir = level.halfLocked?.[String(locked)] ?? 'both';
      const allowed =
        dir === 'left' ? [locked - 1] : dir === 'right' ? [locked + 1] : [locked - 1, locked + 1];
      // A revealed cell on an allowed side is correct from the start and
      // would auto-unlock the cell; skip those.
      if (allowed.some((j) => revealed.has(j))) continue;
      for (const neighbour of allowed) {
        if (
          level.cipher[neighbour] !== undefined &&
          level.cipher[neighbour] !== -1 &&
          !level.lockedIndices.includes(neighbour) &&
          !revealed.has(neighbour)
        ) {
          return { level, locked, neighbour };
        }
      }
    }
  }
  throw new Error('no suitable locked fixture level');
}

test('a locked cell shows no number until its neighbour is correctly filled', async ({
  page,
}) => {
  const { level, locked, neighbour } = findLockedFixture();
  await page.goto('./');
  await expect(page.getByTestId('grid')).toBeVisible();
  await gotoLevel(page, level.id);
  await expect(page.getByTestId('tier')).toHaveText(`Tier ${level.tier}`);

  const lockedCell = page.getByTestId(`cell-${locked}`);
  await expect(lockedCell.locator('.cell-num')).toHaveText('');
  await expect(lockedCell).toHaveClass(/cell-locked/);

  // Enter a WRONG letter on the neighbour first: rejected, still locked.
  const correct = level.solution[neighbour];
  const wrong = 'QJXZK'.split('').find((l) => l !== correct)!;
  await page.getByTestId(`cell-${neighbour}`).click();
  await page.getByTestId(`key-${wrong}`).click();
  await expect(lockedCell.locator('.cell-num')).toHaveText('');
  // The wrong entry is undone, so the cell is fillable again.
  await expect(page.getByTestId(`cell-${neighbour}`).locator('.cell-letter')).toHaveText('');

  // Correct the neighbour: the number appears.
  await page.getByTestId(`cell-${neighbour}`).click();
  await page.getByTestId(`key-${correct}`).click();
  await expect(lockedCell.locator('.cell-num')).toHaveText(String(level.cipher[locked]));
  await expect(lockedCell).not.toHaveClass(/cell-locked/);
});

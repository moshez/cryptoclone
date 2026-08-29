import { expect, test } from '@playwright/test';
import { fixtureLevels, gotoLevel, type FixtureLevel } from './helpers';

function findLockedFixture(): { level: FixtureLevel; locked: number; neighbour: number } {
  for (const level of fixtureLevels()) {
    for (const locked of level.lockedIndices) {
      const dir = level.halfLocked?.[String(locked)] ?? 'both';
      for (const neighbour of dir === 'left' ? [locked - 1] : dir === 'right' ? [locked + 1] : [locked - 1, locked + 1]) {
        if (
          level.cipher[neighbour] !== undefined &&
          level.cipher[neighbour] !== -1 &&
          !level.lockedIndices.includes(neighbour) &&
          // The neighbour's symbol must not already be revealed, or the
          // cell starts unlocked.
          !level.revealed.some(([num]) => num === level.cipher[neighbour]) &&
          // No OTHER neighbour may auto-unlock it first.
          ![locked - 1, locked + 1]
            .filter((j) => j !== neighbour)
            .some(
              (j) =>
                level.cipher[j] !== undefined &&
                level.cipher[j] !== -1 &&
                level.revealed.some(([num]) => num === level.cipher[j]),
            )
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

  // Fill the neighbour with a WRONG letter first: still locked.
  const correct = level.solution[neighbour];
  const revealedLetters = new Set(level.revealed.map(([, l]) => l));
  const wrong = 'QJXZK'.split('').find((l) => l !== correct && !revealedLetters.has(l))!;
  await page.getByTestId(`cell-${neighbour}`).click();
  await page.getByTestId(`key-${wrong}`).click();
  await expect(lockedCell.locator('.cell-num')).toHaveText('');

  // Correct the neighbour: the number appears.
  await page.getByTestId(`cell-${neighbour}`).click();
  await page.getByTestId('key-clear').click();
  await page.getByTestId(`cell-${neighbour}`).click();
  await page.getByTestId(`key-${correct}`).click();
  await expect(lockedCell.locator('.cell-num')).toHaveText(String(level.cipher[locked]));
  await expect(lockedCell).not.toHaveClass(/cell-locked/);
});

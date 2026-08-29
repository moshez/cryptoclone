/* Deterministic layout assertions. Entries below marked VF-n correspond to
 * findings in e2e/vision-findings.md from the model-vision review loop. */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { gotoLevel } from './helpers';

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  expect(b).not.toBeNull();
  return b!;
}

async function assertNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test('no content extends past the viewport on any level', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('grid')).toBeVisible();
  for (const id of [1, 30, 60]) {
    await gotoLevel(page, id);
    await expect(page.getByTestId('level-input')).toHaveValue(String(id));
    await expect(page.getByTestId('grid')).toBeVisible();
    await assertNoHorizontalScroll(page);
    const viewport = page.viewportSize()!;
    const grid = await box(page.getByTestId('grid'));
    expect(grid.x + grid.width).toBeLessThanOrEqual(viewport.width + 1);
  }
});

test('grid and keyboard never overlap', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('grid')).toBeVisible();
  const grid = await box(page.getByTestId('grid'));
  const keyboard = await box(page.getByTestId('keyboard'));
  expect(grid.y + grid.height).toBeLessThanOrEqual(keyboard.y + 1);
});

test('keyboard tap targets are at least 44px tall and not tiny', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('keyboard')).toBeVisible();
  for (const letter of ['Q', 'A', 'M']) {
    const key = await box(page.getByTestId(`key-${letter}`));
    expect(key.height, `key ${letter} height`).toBeGreaterThanOrEqual(44);
    expect(key.width, `key ${letter} width`).toBeGreaterThanOrEqual(24);
  }
});

test('words never break across lines', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('grid')).toBeVisible();
  await gotoLevel(page, 60); // longest fixture solution
  await expect(page.getByTestId('grid')).toBeVisible();
  const misaligned = await page.evaluate(() => {
    let bad = 0;
    for (const word of document.querySelectorAll('.word')) {
      const tops = new Set(
        [...word.querySelectorAll('.cell')].map((c) => c.getBoundingClientRect().top),
      );
      if (tops.size > 1) bad++;
    }
    return bad;
  });
  expect(misaligned).toBe(0);
});

// VF-1: on desktop-sized screens the keyboard must sit near the grid, not
// pinned to the bottom of a stretched column with a dead zone between.
test('no dead zone between grid and keyboard on desktop', async ({ page }) => {
  const viewport = page.viewportSize()!;
  test.skip(viewport.width < 900 || viewport.height < 700, 'desktop-only finding');
  await page.goto('./');
  await expect(page.getByTestId('grid')).toBeVisible();
  const grid = await box(page.getByTestId('grid'));
  const keyboard = await box(page.getByTestId('keyboard'));
  expect(keyboard.y - (grid.y + grid.height)).toBeLessThanOrEqual(240);
});

function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(fg: [number, number, number], bg: [number, number, number]): number {
  const [l1, l2] = [relativeLuminance(fg), relativeLuminance(bg)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}

function parseRgb(css: string): [number, number, number] {
  const m = css.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)!;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

// VF-2: cipher numbers and meta text are small; their computed contrast
// against their backgrounds must clear WCAG 4.5:1.
test('small text has at least 4.5:1 contrast', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('grid')).toBeVisible();
  const samples = await page.evaluate(() => {
    const bgOf = (el: Element): string => {
      for (let node: Element | null = el; node; node = node.parentElement) {
        const bg = getComputedStyle(node).backgroundColor;
        if (bg && !bg.includes('rgba(0, 0, 0, 0)')) return bg;
      }
      return 'rgb(255, 255, 255)';
    };
    const pick = (selector: string) => {
      const el = document.querySelector(selector)!;
      return { fg: getComputedStyle(el).color, bg: bgOf(el) };
    };
    return [
      pick('.cell:not(.cell-selected):not(.cell-same) .cell-num'),
      pick('.cell-selected .cell-num'),
      pick('.tier'),
      pick('.about'),
    ];
  });
  for (const { fg, bg } of samples) {
    expect(contrast(parseRgb(fg), parseRgb(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  }
});

test('attribution card text is not clipped', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('grid')).toBeVisible();
  // Cheat completion state via the real solving path is covered elsewhere;
  // here we care about layout, so solve level 1 quickly through the store.
  const { fixtureLevel, solveLevel } = await import('./helpers');
  await solveLevel(page, fixtureLevel(1));
  const card = page.getByTestId('attribution');
  await expect(card).toBeVisible();
  const clipped = await card.evaluate(
    (el) => el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight + 1,
  );
  expect(clipped).toBe(false);
  await assertNoHorizontalScroll(page);
});

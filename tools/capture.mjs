/* Capture deterministic screenshots of the app's key states for the vision
 * review pass. Reuses the e2e fixture builds and the e2e Playwright
 * install:  cd e2e && npm ci  first.
 *
 * Determinism: fixture corpus, animations and transitions disabled via an
 * injected stylesheet plus prefers-reduced-motion, no wall-clock content,
 * fonts awaited via document.fonts.ready.
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const e2eDir = resolve(here, '../e2e');
const outDir = join(here, 'screenshots');
const require = createRequire(join(e2eDir, 'package.json'));
const { chromium } = require('playwright');

const VIEWPORTS = {
  small: { width: 375, height: 667 },
  large: { width: 414, height: 896 },
  desktop: { width: 1280, height: 800 },
};

const FREEZE_CSS =
  '*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }';

function fixtureLevels() {
  const dir = join(e2eDir, 'fixtures/data');
  return readdirSync(dir)
    .filter((f) => f.startsWith('batch-'))
    .sort()
    .flatMap((f) => JSON.parse(readFileSync(join(dir, f), 'utf-8')).levels);
}

async function main() {
  if (!existsSync(join(e2eDir, '.serve/current'))) {
    execSync('node -e "import(\'./global-setup.mjs\').then(m => m.default())"', {
      cwd: e2eDir,
      stdio: 'inherit',
    });
  }
  const { makeServer } = await import(join(e2eDir, 'serve.mjs'));
  const server = makeServer(join(e2eDir, '.serve/current'), '/cryptoclone/');
  await new Promise((ok) => server.listen(4188, ok));

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const executablePath = existsSync('/opt/pw-browsers/chromium')
    ? '/opt/pw-browsers/chromium'
    : undefined;
  const browser = await chromium.launch({ executablePath });

  const levels = fixtureLevels();
  const level1 = levels[0];
  const lastLevel = levels[levels.length - 1];

  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    const context = await browser.newContext({
      viewport,
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    const freeze = () => page.addStyleTag({ content: FREEZE_CSS });
    const shot = async (slug) => {
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: join(outDir, `${name}-${slug}.png`), fullPage: true });
    };
    const goto = async (level) => {
      const input = page.getByTestId('level-input');
      await input.fill(String(level));
      await input.blur();
      await page.getByTestId('grid').waitFor();
      await freeze();
    };
    const solve = async (level) => {
      const revealed = new Set(level.revealed.map(([num]) => num));
      const done = new Set();
      for (let i = 0; i < level.cipher.length; i++) {
        const num = level.cipher[i];
        if (num === -1 || revealed.has(num) || done.has(num)) continue;
        if (level.lockedIndices.includes(i)) continue;
        done.add(num);
        await page.getByTestId(`cell-${i}`).click();
        await page.getByTestId(`key-${level.solution[i]}`).click();
      }
    };

    await page.goto('http://localhost:4188/cryptoclone/');
    await page.getByTestId('grid').waitFor();
    await freeze();
    await shot('level1-fresh');

    // Mid-solve with one wrong guess so an error pip is lit.
    await page.getByTestId('cell-0').click();
    await page.getByTestId('key-T').click();
    await page.getByTestId('cell-4').click();
    await page.getByTestId('key-J').click();
    await shot('level1-midsolve');

    // Solved: attribution card.
    await solve(level1);
    await shot('level1-solved');

    // Locked-cell level (first fixture level with locks).
    const lockedLevel = levels.find((l) => l.lockedIndices.length > 0);
    await goto(lockedLevel.id);
    await shot(`level${lockedLevel.id}-locked`);

    // Longest fixture level, hardest tier.
    await goto(lastLevel.id);
    await shot(`level${lastLevel.id}-tier5`);

    await context.close();
  }
  await browser.close();
  await new Promise((ok) => server.close(ok));
  console.log(`screenshots written to ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

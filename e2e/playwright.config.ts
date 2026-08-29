import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Some dev environments preinstall a Chromium at a fixed path instead of
// the per-version browser bundles; use it when present (CI installs its
// own browsers and takes the default).
const LOCAL_CHROMIUM = '/opt/pw-browsers/chromium';
const chromiumLaunch =
  !process.env.CI && existsSync(LOCAL_CHROMIUM)
    ? { launchOptions: { executablePath: LOCAL_CHROMIUM } }
    : {};

const VIEWPORTS = {
  small: { width: 375, height: 667 },
  large: { width: 414, height: 896 },
  desktop: { width: 1280, height: 800 },
} as const;

export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173/cryptoclone/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: (
    [
      ['chromium', devices['Desktop Chrome']],
      ['webkit', devices['Desktop Safari']],
    ] as const
  ).flatMap(([browser, device]) =>
    (Object.keys(VIEWPORTS) as (keyof typeof VIEWPORTS)[]).map((vp) => ({
      name: `${browser}-${vp}`,
      use: {
        ...device,
        viewport: VIEWPORTS[vp],
        ...(browser === 'chromium' ? chromiumLaunch : {}),
      },
    })),
  ),
  webServer: {
    command: 'node setup-and-serve.mjs',
    url: 'http://localhost:4173/cryptoclone/',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});

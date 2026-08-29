/* Build the app twice (build ids A and B) against the fixture corpus, and
 * point .serve/current at build A. The staleness spec swaps its own symlink
 * to build B. */
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(here, '../app');
const serveDir = join(here, '.serve');

function build(buildId, dest) {
  execSync('npx vite build', {
    cwd: appDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      BUILD_ID: buildId,
      DATA_DIR: resolve(here, 'fixtures/data'),
      BASE_PATH: '/cryptoclone/',
    },
  });
  cpSync(join(appDir, 'dist'), dest, { recursive: true });
}

export default function globalSetup() {
  rmSync(serveDir, { recursive: true, force: true });
  mkdirSync(serveDir, { recursive: true });
  build('e2e-build-a', join(serveDir, 'build-a'));
  build('e2e-build-b', join(serveDir, 'build-b'));
  symlinkSync('build-a', join(serveDir, 'current'));
  symlinkSync('build-a', join(serveDir, 'stale-current'));
}

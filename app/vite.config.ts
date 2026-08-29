import { createHash } from 'node:crypto';
import { cpSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const BASE = process.env.BASE_PATH ?? '/cryptoclone/';
const BUILD_ID =
  process.env.BUILD_ID ?? `dev-${createHash('sha256').update(String(Date.now())).digest('hex').slice(0, 8)}`;
const DATA_DIR = process.env.DATA_DIR ?? resolve(__dirname, '../data');

function listFiles(dir: string, prefix = ''): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory()
      ? listFiles(full, `${prefix}${name}/`)
      : [`${prefix}${name}`];
  });
}

/** GitHub Pages packaging: emit the service worker with build id + precache
 * manifest baked in, copy /data, add .nojekyll and 404.html, and fail the
 * build on any root-absolute URL that would 404 under the repo base path. */
function pagesPlugin(): Plugin {
  let outDir = '';
  return {
    name: 'pages-packaging',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      cpSync(DATA_DIR, join(outDir, 'data'), { recursive: true });
      writeFileSync(join(outDir, '.nojekyll'), '');
      cpSync(join(outDir, 'index.html'), join(outDir, '404.html'));

      const precache = listFiles(outDir).filter(
        (f) => !f.startsWith('data/') && f !== 'sw.js' && f !== '404.html' && f !== '.nojekyll',
      );
      const template = readFileSync(resolve(__dirname, 'sw.js'), 'utf-8');
      const sw = template
        .replaceAll('__BUILD_ID__', BUILD_ID)
        .replaceAll('__BASE__', BASE)
        .replaceAll('__PRECACHE__', JSON.stringify(precache.sort()));
      writeFileSync(join(outDir, 'sw.js'), sw);

      for (const file of listFiles(outDir)) {
        if (!/\.(html|js|css)$/.test(file) || file === 'sw.js') continue;
        const text = readFileSync(join(outDir, file), 'utf-8');
        const suspicious = text.match(/(?:src|href)="\/(?!\/)[^"]*"/g) ?? [];
        const bad = suspicious.filter((m) => !m.includes(`"${BASE}`));
        const badFetch = /fetch\(["']\/(?!\/)/.test(text) && !text.includes(`"${BASE}`);
        if (bad.length > 0 || badFetch) {
          throw new Error(
            `${file} contains root-absolute paths that will 404 under ${BASE}: ${bad.join(', ')}`,
          );
        }
      }
      if (!existsSync(join(outDir, 'data/manifest.json'))) {
        throw new Error('data/manifest.json missing from build output');
      }
    },
  };
}

export default defineConfig({
  base: BASE,
  plugins: [react(), pagesPlugin()],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  build: {
    sourcemap: false,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});

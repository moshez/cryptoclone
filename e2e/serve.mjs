/* Minimal static server for the built app under a GitHub-Pages-like base
 * path. Files are resolved per-request (no startup snapshot), so the
 * staleness test can swap the root symlink between requests. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]] : [])).filter((p) => p.length),
);

const PORT = Number(args.port ?? 4173);
const ROOT = args.root ?? '.serve/current';
const BASE = args.base ?? '/cryptoclone/';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};

export function makeServer(root, base) {
  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let path = decodeURIComponent(url.pathname);
    if (path === '/' || path === base.slice(0, -1)) {
      res.writeHead(302, { location: base });
      res.end();
      return;
    }
    if (!path.startsWith(base)) {
      res.writeHead(404).end('outside base path');
      return;
    }
    let rel = path.slice(base.length);
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    const file = normalize(join(root, rel));
    try {
      const body = await readFile(file);
      res.writeHead(200, {
        'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
        'cache-control': 'no-store',
      });
      res.end(body);
    } catch {
      try {
        // GitHub Pages serves 404.html for unknown paths.
        const body = await readFile(join(root, '404.html'));
        res.writeHead(404, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        res.end(body);
      } catch {
        res.writeHead(404).end('not found');
      }
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  makeServer(ROOT, BASE).listen(PORT, () => {
    console.log(`serving ${ROOT} at http://localhost:${PORT}${BASE}`);
  });
}

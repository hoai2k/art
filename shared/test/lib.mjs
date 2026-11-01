// Shared helpers for the browser checks: find Playwright (installed globally
// in the cloud containers, or in node_modules) and serve a folder over HTTP.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

export async function playwright() {
  try {
    return await import('playwright');
  } catch {
    const root = execSync('npm root -g').toString().trim();
    const require = createRequire(join(root, 'noop.js'));
    return require(join(root, 'playwright'));
  }
}

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.svg': 'image/svg+xml',
};

// Serves `dir` on 127.0.0.1:<port>. Returns { url, close }.
export function serve(dir, port = 0) {
  const server = createServer(async (req, res) => {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(dir, path));
    if (!file.startsWith(normalize(dir))) { res.writeHead(403).end(); return; }
    try {
      if ((await stat(file)).isDirectory()) { res.writeHead(302, { Location: path + '/' }).end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(await readFile(file));
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise(resolve => server.listen(port, '127.0.0.1', () => {
    resolve({ url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() });
  }));
}

export const CHROMIUM_ARGS = [
  '--use-fake-ui-for-media-stream',
  '--use-fake-device-for-media-stream',
  '--autoplay-policy=no-user-gesture-required',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
];

export async function launch() {
  const { chromium } = await playwright();
  const opts = { args: CHROMIUM_ARGS };
  try {
    return await chromium.launch(opts);
  } catch {
    return chromium.launch({ ...opts, executablePath: '/opt/pw-browsers/chromium' });
  }
}

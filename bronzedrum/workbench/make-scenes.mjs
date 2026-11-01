// Capture each chapter's scene for the sound workbench: the game as it looks
// while that chapter's ambience plays (no HUD), saved as scenes/<id>.webp.
// Run from bronzedrum/: node workbench/make-scenes.mjs
// Needs Playwright (as `playwright`, or PLAYWRIGHT_MODULE) and ffmpeg.

import { createServer } from 'node:http';
import { readFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const game = join(here, '..', 'game');
const out = join(here, 'scenes');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.mp3': 'audio/mpeg' };

let pw;
for (const t of [process.env.PLAYWRIGHT_MODULE && pathToFileURL(process.env.PLAYWRIGHT_MODULE).href, 'playwright', '/opt/node-tools/node_modules/playwright/index.mjs'].filter(Boolean)) {
  try {
    pw = await import(t);
    break;
  } catch {
    /* next */
  }
}
if (!pw) throw new Error('Playwright not found');

const server = createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  try {
    const body = await readFile(join(game, path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
}).listen(0);

const preinstalled = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await pw.chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (existsSync(preinstalled) ? preinstalled : undefined) });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://localhost:${server.address().port}/`);
await page.waitForFunction(() => !document.querySelector('#title').hidden);
await page.click('#press-start');
await page.waitForTimeout(1500);
// The scene alone: no HUD over it.
await page.evaluate(() => {
  window.__bronzeDrum.renderer.hud = () => {};
});
await mkdir(out, { recursive: true });
const ids = await page.evaluate(() => window.__bronzeDrum.STAGES.map((s) => s.id));
const shots = ids.map((id, i) => [id, () => window.__bronzeDrum.startStage(i)]).concat([['practice', null]]);
for (const [id] of shots) {
  await page.evaluate(([id, i]) => {
    const B = window.__bronzeDrum;
    if (id === 'practice') {
      B.startPractice('free');
      B.game.energy = 32; // the dancers gathered
    } else B.startStage(i);
  }, [id, ids.indexOf(id)]);
  await page.waitForTimeout(6500); // the camera settles and the intro text goes
  const png = join(out, `${id}.png`);
  await page.screenshot({ path: png });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-vf', 'scale=960:-1', '-quality', '78', join(out, `${id}.webp`)]);
  await rm(png);
  console.log(`scenes/${id}.webp`);
}
await browser.close();
server.close();

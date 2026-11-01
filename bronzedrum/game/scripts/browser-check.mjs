// Checks that need a real browser (Chromium through Playwright): things a
// screenshot or a unit test cannot see. Run from bronzedrum/game:
//
//   node scripts/browser-check.mjs
//
// It serves the game itself, so nothing else needs to be running. Playwright
// is found as the `playwright` package, or at PLAYWRIGHT_MODULE (a path to its
// index.mjs); CHROMIUM_PATH points at a Chromium binary if Playwright has none.
//
//  1. Frame cost: every chapter and Drum Practice draws with no errors, and no
//     scene's frames take more than 2.5 times the quickest scene's (a per-frame
//     canvas filter once made battles ten times slower than the rest). Frames
//     are timed from one to the next, so the painting the browser does after
//     draw() returns counts too, and the game's automatic resolution step-down
//     is switched off so every scene is drawn at the same size.
//  2. Demonstration timing: with the CPU slowed six times, every stroke of a
//     demonstration plays exactly when the pointer reaches it.
//  3. Title selection: the selected title button looks different from the
//     other (their paper shape clips any outline).

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

async function playwright() {
  const tries = [process.env.PLAYWRIGHT_MODULE && pathToFileURL(process.env.PLAYWRIGHT_MODULE).href, 'playwright', '/opt/node-tools/node_modules/playwright/index.mjs'].filter(Boolean);
  for (const t of tries) {
    try {
      return await import(t);
    } catch {
      /* next */
    }
  }
  console.error('Playwright not found: install it (npm i -D playwright) or set PLAYWRIGHT_MODULE.');
  process.exit(2);
}

const server = createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  try {
    const body = await readFile(join(root, path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
}).listen(0);
const base = `http://localhost:${server.address().port}/`;

const { chromium } = await playwright();
const { existsSync } = await import('node:fs');
const preinstalled = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || (existsSync(preinstalled) ? preinstalled : undefined),
  args: ['--autoplay-policy=no-user-gesture-required'],
});
let failed = 0;
const fail = (msg) => {
  failed += 1;
  console.error(`FAIL ${msg}`);
};

// Drawn at 2× pixels, like a phone or a laptop's screen: some costs (a canvas
// filter) only show at that density.
async function open(throttle = 1, scale = 2) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: scale });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/fonts|ERR_CERT|ERR_NAME|net::/.test(m.text())) errors.push(m.text());
  });
  await page.goto(base);
  // The title is static HTML; the game behind the invite door loads after it.
  await page.waitForFunction(() => window.__bronzeDrum && !document.querySelector('#title').hidden);
  if (throttle > 1) await (await ctx.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: throttle });
  return { ctx, page, errors };
}

// 1. Frame cost.
{
  const { ctx, page, errors } = await open();
  await page.click('#press-start');
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    window.__bronzeDrum.renderer.autoResolution = false;
    window.__cost = [];
    let last = performance.now();
    const tick = (now) => {
      window.__cost.push(now - last);
      last = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const scenes = [...Array(9).keys()].map((i) => ['stage', i]).concat([['practice', 'free'], ['practice', 'call'], ['practice', 'training']]);
  const costs = [];
  for (const [kind, arg] of scenes) {
    await page.evaluate(([k, a]) => {
      if (k === 'stage') {
        window.__bronzeDrum.startStage(a);
        window.__bronzeDrum.begin(); // past the chapter's opening card
      } else {
        window.__bronzeDrum.startPractice(a);
        window.__bronzeDrum.game.energy = 32; // all six dancers
      }
      window.__cost = [];
    }, [kind, arg]);
    await page.waitForTimeout(3000);
    const c = await page.evaluate(() => {
      const all = window.__cost;
      const a = (all.length > 6 ? all.slice(3) : all).sort((x, y) => x - y);
      return a.length ? a[Math.floor(a.length / 2)] : null;
    });
    costs.push([`${kind} ${arg}`, c]);
  }
  // Against the cheapest scene: every scene draws the same layers, so none should cost several times more.
  const cheapest = Math.min(...costs.map((c) => c[1] ?? Infinity));
  for (const [name, c] of costs) {
    if (c === null) {
      fail(`${name} drew no frames in 2.5 s`);
      continue;
    }
    console.log(`  frame ${name.padEnd(16)} ${c.toFixed(1)} ms`);
    if (!(c <= cheapest * 2.5)) fail(`${name} frames take ${c.toFixed(1)} ms, over 2.5× the quickest scene (${cheapest.toFixed(1)} ms)`);
  }
  for (const e of errors) fail(`page error: ${e}`);
  await ctx.close();
}

// 2. Demonstration timing under a slow CPU.
{
  const { ctx, page } = await open();
  await page.evaluate(() => localStorage.removeItem('bronzedrum.prototype.demos') /* the game's save key (main.js STORE) */);
  await page.reload();
  // The title is static HTML; the game behind the invite door loads after it.
  await page.waitForFunction(() => window.__bronzeDrum && !document.querySelector('#title').hidden);
  await page.click('#press-start');
  await page.waitForTimeout(800);
  await (await ctx.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: 6 });
  // The demonstration is read as its strokes are scheduled (startDemo sets
  // game.demo, then schedules every stroke through sound.play). A timer polling
  // for game.demo missed it: under the throttle the frames keep the main thread
  // busy, and a 5 ms interval could go 15 s without running, longer than the
  // demonstration lasts.
  await page.evaluate(() => {
    const B = window.__bronzeDrum;
    window.__plays = [];
    const play = B.sound.play.bind(B.sound);
    B.sound.play = (id, t, ...rest) => {
      const g = B.game;
      if ((id === 'drum-tung' || id === 'drum-cac') && g && g.demo) {
        if (!window.__demo) window.__demo = { start: g.demo.start, u: g.demo.u, strokes: g.demo.strokes, reps: g.demo.reps, beats: g.demo.beats, clock: g.clockStart };
        window.__plays.push(t);
      }
      return play(id, t, ...rest);
    };
    B.startStage(0);
    B.begin(); // past the chapter's opening card
  });
  await page.waitForFunction(() => window.__demo, null, { timeout: 60000 });
  const d = await page.evaluate(() => window.__demo);
  const plays = await page.evaluate(() => window.__plays);
  const want = [];
  for (let r = 0; r < d.reps; r++) for (const s of d.strokes) want.push(d.clock + d.start + (r * (d.beats + 1) + s.pos) * d.u);
  const off = want.map((w, i) => (plays[i] === undefined ? Infinity : Math.abs(plays[i] - w) * 1000));
  console.log(`  demonstration strokes off by ${off.map((o) => o.toFixed(0)).join(', ')} ms`);
  if (off.some((o) => o > 5)) fail('a demonstration stroke is not scheduled on its beat');
  await ctx.close();
}

// 3. Title selection.
{
  const { ctx, page } = await open();
  await page.waitForTimeout(500);
  const look = () => page.evaluate(() => ['press-start', 'practice-start'].map((id) => getComputedStyle(document.getElementById(id)).backgroundColor));
  const [a1, b1] = await look();
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(300);
  const [a2, b2] = await look();
  const focused = await page.evaluate(() => document.activeElement.id);
  console.log(`  title: selected ${focused}; backgrounds ${a1}/${b1} then ${a2}/${b2}`);
  if (focused !== 'practice-start') fail('arrow down on the title did not select Drum Practice');
  if (b1 === b2) fail('the selected title button looks the same as before it was selected');
  await ctx.close();
}

await browser.close();
server.close();
console.log(failed ? `${failed} problem(s)` : 'browser check ok');
process.exit(failed ? 1 : 0);

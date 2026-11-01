// Browser check (Chromium through Playwright), run from fibreart/game:
//
//   node scripts/browser-check.mjs [--shots <dir>]
//
// Serves the game and drives it with a simulated Xbox controller
// (navigator.getGamepads is replaced before the page loads) and the keyboard:
//
//  1. Title: loads with no errors and draws; a controller button starts play.
//  2. Play: every stick, trigger and button is pushed in turn; controls are
//     found, the picture moves, nothing throws.
//  3. A large control is set up by hand and leaned on until the picture is
//     carried into the next scene.
//  4. Every scene is shown and left alone until its composition settles.
//  5. Menu pauses, View opens the card, B closes; the keyboard plays too.
//
// Screenshots go to --shots (default: none). Playwright is found as the
// `playwright` package, at PLAYWRIGHT_MODULE, or in /opt/node-tools.
// Set PLAYWRIGHT_EXECUTABLE_PATH to use an already installed Chromium browser.

import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' };
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : null;
};
const shots = arg('--shots');
const scenesOnly = process.argv.includes('--scenes');

async function playwright() {
  const tries = [process.env.PLAYWRIGHT_MODULE && pathToFileURL(process.env.PLAYWRIGHT_MODULE).href, 'playwright', '/opt/node-tools/node_modules/playwright/index.mjs'].filter(Boolean);
  for (const t of tries) {
    try {
      return await import(t);
    } catch { /* next */ }
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
    res.end('not found');
  }
});

const PAD = `
  (() => {
    const pad = { index: 0, id: 'Xbox Controller (simulated)', connected: true, mapping: 'standard',
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0, touched: false })),
      axes: [0, 0, 0, 0], timestamp: 0, vibrationActuator: { playEffect: () => Promise.resolve('complete') } };
    window.__pad = pad;
    window.__padOn = true;
    navigator.getGamepads = () => (window.__padOn ? [pad, null, null, null] : [null, null, null, null]);
  })();
`;

const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures.push(what);
};

async function main() {
  await new Promise((r) => server.listen(0, r));
  const url = `http://localhost:${server.address().port}/`;
  const { chromium } = await playwright();
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.addInitScript(PAD);
  if (shots) await mkdir(shots, { recursive: true });
  const shot = async (name) => shots && page.screenshot({ path: join(shots, `${name}.png`) });
  const wait = (ms) => page.waitForTimeout(ms);
  const btn = (i, v) => page.evaluate(([i, v]) => { const b = window.__pad.buttons[i]; b.pressed = v > 0.5; b.value = v; }, [i, v]);
  const tap = async (i, ms = 350) => { await btn(i, 1); await wait(ms); await btn(i, 0); await wait(250); };
  // Hold a button until the game has seen it (frames are slow in software WebGL).
  const pressUntil = async (i, fn, timeout = 30000, arg = null) => {
    await btn(i, 1);
    try { await page.waitForFunction(fn, arg, { timeout }); } finally { await btn(i, 0); await wait(300); }
  };
  const axes = (a) => page.evaluate((a) => { window.__pad.axes = a; }, a);
  const G = (fn, a) => page.evaluate(fn, a);

  await page.goto(url);
  await page.waitForSelector('#title:not([hidden])', { timeout: 30000 });
  await wait(1500);
  // A drawn picture compresses far worse than a blank screen.
  const drawn = (await page.screenshot()).length;
  check(drawn > 400000, `title draws the picture (${Math.round(drawn / 1000)} kB screenshot)`);
  check(await page.evaluate(() => document.querySelector('#logo-img').naturalWidth > 0), 'title logo loads');
  await shot('01-title');

  // Any button starts.
  check(await pressUntil(0, () => window.fibreart.ui.screen === 'play', 20000).then(() => true, () => false), 'a controller button starts play');
  check(await G(() => window.fibreart.game().players.some((p) => p.id === 'pad0')), 'the controller is player 1');
  // The song starts with play and keeps going.
  const songAt = await page.waitForFunction(() => window.fibreart.audio.songPlaying, null, { timeout: 20000 }).then(() => true, () => false);
  check(songAt, 'the song plays');
  await shot('02-play-start');
  const fps = await G(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => (++n < 20 ? requestAnimationFrame(f) : res(Math.round(20000 / (performance.now() - t0)))); requestAnimationFrame(f); }));
  console.log(`  ${fps} frames a second in this browser (software WebGL)`);

  if (!scenesOnly) await interact();
  await tour();
  check(errors.length === 0, `no errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  await browser.close();
  server.close();
  if (failures.length) {
    console.error(`${failures.length} check(s) failed`);
    process.exit(1);
  }

  async function interact() {
  // Push every input in turn.
  const inputs = [[0, 'A'], [1, 'B'], [2, 'X'], [3, 'Y'], [4, 'LB'], [5, 'RB']];
  await axes([0.9, 0, 0, 0]); await wait(900); await axes([0, 0.9, 0, 0]); await wait(900); await axes([0, 0, 0, 0]);
  await axes([0, 0, -0.9, 0.3]); await wait(900); await axes([0, 0, 0, 0]);
  await btn(6, 1); await wait(900); await btn(6, 0);
  await btn(7, 1); await wait(900); await btn(7, 0);
  for (const [i, name] of inputs) {
    await pressUntil(i, (n) => window.fibreart.game().players.find((p) => p.id === 'pad0').bindings[n].found, 20000, name).catch(() => {});
  }
  await wait(300);
  await shot('03-every-input');
  const found = await G(() => Object.values(window.fibreart.game().players.find((p) => p.id === 'pad0').bindings).filter((b) => b.found).length);
  check(found >= 8, `pushing every input finds the controls (${found} of 10)`);

  // Set a large control up by hand: make LS a swirl centred on a piece in the middle.
  await G(() => {
    const g = window.fibreart.game();
    const pl = g.players.find((p) => p.id === 'pad0');
    const anchor = g.pieces.reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a));
    pl.bindings.LS = { input: 'LS', scale: 'large', verb: 'swirl', target: anchor.i, setup: { type: 'centre', anchor: anchor.i }, found: true, use: 1 };
    anchor.home = { ...anchor.home, x: 8, y: 4.5 };
    anchor.x = 8; anchor.y = 4.5;
  });
  await axes([0.8, 0.2, 0, 0]);
  await wait(700);
  await shot('04-swirl');
  const swirled = await page.waitForFunction(() => window.fibreart.game().rearranged > 0, null, { timeout: 60000 }).then(() => true, () => false);
  await axes([0, 0, 0, 0]);
  check(swirled, 'an awake swirl rearranges the picture');
  await wait(800);
  await shot('05-after-swirl');

  // A pour, set up, carries the picture on.
  const before = await G(() => window.fibreart.game().index);
  await G(() => {
    const g = window.fibreart.game();
    const pl = g.players.find((p) => p.id === 'pad0');
    const a = g.pieces[0];
    a.x = 8; a.y = 4.5; a.home = { ...a.home, x: 8, y: 4.5 };
    pl.bindings.RT = { input: 'RT', scale: 'large', verb: 'pour', target: 0, setup: { type: 'centre', anchor: 0 }, found: true, use: 1 };
  });
  await btn(7, 1);
  await wait(900);
  await shot('06-pour');
  const poured = await page.waitForFunction((b) => window.fibreart.game().index !== b, before, { timeout: 60000 }).then(() => true, () => false);
  await btn(7, 0);
  await wait(900);
  await shot('07-dissolving');
  check(poured, 'an awake pour carries the picture into the next scene');
  await wait(3000);

  // Pause, the card, back.
  const ok = (fn) => fn.then(() => true, () => false);
  check(await ok(pressUntil(9, () => window.fibreart.ui.modals.includes('pause'))), 'Menu pauses');
  await shot('08-pause');
  check(await ok(pressUntil(1, () => !window.fibreart.ui.modals.length && !window.fibreart.ui.paused)), 'B resumes');
  check(await ok(pressUntil(8, () => window.fibreart.ui.modals.includes('card'))), 'View opens the card of controls found');
  await shot('09-card');
  await ok(pressUntil(1, () => !window.fibreart.ui.modals.length));

  // Disconnect pauses; reconnect, resume.
  await G(() => { window.__padOn = false; });
  await page.waitForFunction(() => window.fibreart.ui.paused, null, { timeout: 20000 }).catch(() => {});
  check(await G(() => window.fibreart.ui.paused && /disconnected/.test(window.fibreart.ui.pauseReason)), 'a disconnected controller pauses');
  await G(() => { window.__padOn = true; });
  await page.waitForFunction(() => window.fibreart.input.pads().length > 0);
  await wait(300);
  const state = () => G(() => JSON.stringify({ paused: window.fibreart.ui.paused, modals: window.fibreart.ui.modals, reason: window.fibreart.ui.pauseReason, pads: window.fibreart.input.pads(), players: window.fibreart.game().players.map((p) => p.id) }));
  console.log('  reconnected:', await state());
  await pressUntil(1, () => !window.fibreart.ui.paused, 20000).catch(() => {});
  console.log('  after B:', await state());
  check(await G(() => !window.fibreart.ui.paused), 'after reconnecting, B resumes');
  if (await G(() => window.fibreart.ui.paused)) await page.mouse.click(8, 8);

  // Keyboard plays too.
  await page.keyboard.down('KeyD');
  const joined = await page.waitForFunction(() => window.fibreart.game().players.some((p) => p.id === 'kb'), null, { timeout: 20000 }).then(() => true, () => false);
  await page.keyboard.up('KeyD');
  await page.keyboard.press('KeyK');
  await wait(200);
  check(joined, 'the keyboard joins as a player');

  }

  async function tour() {
  // Every scene: once its transition is over, then stirred.
  const n = await G(() => window.fibreart.game().scenes.length);
  for (let i = 0; i < n; i++) {
    await G(() => {
      const g = window.fibreart.game();
      g.transition = null;
      g.travellers = [];
    });
    await G((i) => {
      const g = window.fibreart.game();
      g.index = (i - 1 + g.scenes.length) % g.scenes.length;
      window.fibreart.shift('pour');
    }, i);
    await page.waitForFunction(() => !window.fibreart.game().transition, null, { timeout: 60000 });
    await wait(400);
    const key = await G(() => window.fibreart.game().scene.key);
    await shot(`10-scene-${String(i).padStart(2, '0')}-${key}`);
    // Stir it: push every piece outward and pulse a bloom.
    await G(() => {
      const g = window.fibreart.game();
      for (const p of g.pieces) { p.vx += (p.x - 8) * 0.5; p.vy += (p.y - 4.5) * 0.4; p.vrot += 0.6; p.vbloom += 1.5; p.sx = 1.5; }
      g.field.swirls.push({ owner: 'pad0X', x: 8, y: 4.5, r: 8, a: 1.2, va: 0 });
    });
    await wait(500);
    await shot(`11-stirred-${String(i).padStart(2, '0')}-${key}`);
  }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

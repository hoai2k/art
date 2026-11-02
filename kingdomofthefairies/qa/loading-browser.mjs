// Per-act loading (src/act-art.js, out.want in src/art.js): on a slow network
// an act opened straight from the title starts once its own art is in, well
// before the whole game's; A pressed before then turns the card's prompt into
// a loading bar, and the act begins when it fills.
import assert from 'node:assert/strict';
import { serve, playwright } from '../../shared/test/lib.mjs';
const server = await serve(new URL('../', import.meta.url).pathname), { chromium } = await playwright();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
const poll = async (page, fn, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await page.evaluate(fn)) return; await page.waitForTimeout(100); } throw Error('timed out: ' + fn); };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route(/\.webp$/, async (r) => { await new Promise((f) => setTimeout(f, 150)); r.continue(); });
  // (not waiting for 'load': Chromium holds it for every script-started image)
  await page.goto(server.url + '/?qa&act=7&scene=4', { waitUntil: 'commit' });
  await poll(page, () => window.__kingdomOfTheFairies && !document.body.classList.contains('booting'));
  await page.evaluate(() => { window.allAt = null; window.__kingdomOfTheFairies.assets.all.then(() => { window.allAt = performance.now(); }); });
  await page.keyboard.press('Enter');
  await poll(page, () => window.__kingdomOfTheFairies.S.mode === 'intro');
  await page.waitForTimeout(600);
  await page.keyboard.down('Space'); await page.waitForTimeout(120); await page.keyboard.up('Space'); await page.waitForTimeout(200);
  const card = await page.evaluate(() => { const c = window.__kingdomOfTheFairies.S.card; return { waiting: c?.waiting, loading: c?.loading, text: c?.loadingText }; });
  assert.equal(card.waiting, true, 'A before the art is in waits'); assert.ok(card.loading >= 0 && card.loading < 1); assert.equal(card.text, 'SETTING THE STAGE');
  await poll(page, () => window.__kingdomOfTheFairies.S.mode === 'play');
  const playAt = await page.evaluate(() => performance.now());
  assert.equal(await page.evaluate(() => window.allAt), null, 'the act starts before the whole game has loaded');
  assert.equal(await page.evaluate(() => window.__kingdomOfTheFairies.S.state.phase), 'wedding');
  await poll(page, () => window.allAt != null, 120000);
  const allAt = await page.evaluate(() => window.allAt);
  assert.deepEqual(errors, []);
  console.log(`Act VI's wedding played at ${Math.round(playAt)} ms, the whole game's art in at ${Math.round(allAt)} ms; A early showed the loading bar`);
} finally { await browser.close(); server.close(); }

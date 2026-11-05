import assert from 'node:assert/strict';
import { serve, playwright } from '../../shared/test/lib.mjs';
const root = new URL('../', import.meta.url).pathname;
const servers = [await serve(root), await serve(root + 'dist/crazygames-preview/')];
const { chromium } = await playwright();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
  for (const [build, legacy] of [[0, false], [0, true], [1, false]]) {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const edition = legacy ? '&widowsbay=on' : '';
    const url = servers[build].url + '/?qa' + edition;
    await page.goto(url + '&debug');
    await page.waitForFunction(() => window.__kingdomOfTheFairies && !document.body.classList.contains('booting'));
    const baseline = await page.evaluate(() => ({ ...localStorage }));
    if (!build) await page.locator('#start').click();
    await page.waitForFunction(() => window.__kingdomOfTheFairies.S.mode === 'playbill');
    const count = legacy ? 5 : 7;
    assert.equal(await page.locator('#playbill-controls button:enabled').count(), count);
    await page.evaluate(() => window.__kingdomOfTheFairies.open.scenes());
    assert.equal(await page.locator('#scene-list h3').count(), count);
    assert.equal(await page.locator('#scene-list button:disabled').count(), 0);
    await page.locator('#scene-list button').last().click();
    assert.equal(await page.evaluate(() => window.__kingdomOfTheFairies.S.actIndex), count - 1);
    await page.waitForFunction(() => window.__kingdomOfTheFairies.S.mode === 'intro');
    const saved = await page.evaluate(async () => {
      const { loadSave, recordResult, writeSave } = await import('/src/save.js');
      const save = loadSave();
      recordResult(save, 7, { score: 9000, ending: 'wedding' }, 7);
      save.scenes = { 7: 4 }; writeSave(save);
      return { ...localStorage };
    });
    const progress = obj => Object.fromEntries(Object.entries(obj).filter(([k]) => k.endsWith('.save.v1')));
    assert.deepEqual(progress(saved), progress(baseline), 'debug progress never persists');
    await page.goto(url);
    await page.waitForFunction(() => window.__kingdomOfTheFairies && !document.body.classList.contains('booting'));
    await page.evaluate(() => window.__kingdomOfTheFairies.open.scenes());
    assert.equal(await page.locator('#scene-list h3').count(), 1, 'removing debug restores locks');
    assert.ok(await page.locator('#scene-list button:disabled').count() > 0);
    // Real progress must still save outside debug mode.
    const real = await page.evaluate(async () => {
      const { loadSave, recordResult } = await import('/src/save.js');
      recordResult(loadSave(), 1, { score: 123 }, 7);
      return loadSave();
    });
    assert.equal(real.unlocked, 2); assert.equal(real.best[1], 123);
    assert.deepEqual(errors, []); await page.close();
  }
  console.log('Film, legacy and CrazyGames preview: debug opens every Act/scene, scene selection works, debug saves are isolated, removing the parameter restores locks, and normal progress still saves');
} finally { await browser.close(); for (const server of servers) server.close(); }

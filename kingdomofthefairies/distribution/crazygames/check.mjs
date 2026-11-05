// Integration checks against the built release, with the platform SDK mocked.
// Real CrazyGames Developer Portal QA remains a separate submission step.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { serve, launch } from '../../../shared/test/lib.mjs';
import { ACT_ART } from '../../src/act-art.js';
import { exerciseAssetRecovery } from '../../qa/lib/asset-recovery.mjs';

const release = fileURLToPath(new URL('../../dist/crazygames/', import.meta.url));
const server = await serve(release);
const browser = await launch();
const mock = `
window.cgCalls = []; window.cgReady = false;
const record = name => window.cgCalls.push(name);
window.cgMuted = false;
window.CrazyGames = { SDK: {
  async init() { await new Promise(r => setTimeout(r, 50)); window.cgReady = true; record('init'); },
  game: {
    settings: {muteAudio: false},
    addSettingsChangeListener(fn) { window.cgSettings = fn; },
    loadingStart() { record('loadingStart'); }, loadingStop() { record('loadingStop'); },
    gameplayStart() { record('gameplayStart'); }, gameplayStop() { record('gameplayStop'); },
  },
  data: {
    getItem(k) { if (!window.cgReady) throw Error('save read before init'); record('read:' + k); return localStorage.getItem('cg:' + k); },
    setItem(k,v) { record('write:' + k); localStorage.setItem('cg:' + k,v); }
  }
}};`;
const qa = 'window.__kingdomOfTheFairies';
const wait = (page, expression) => page.waitForFunction(expression, null, { timeout: 45000 });
const pageErrors = [], failures = [], requests = new Set();
try {
  const page = await browser.newPage({ viewport: { width: 907, height: 510 } });
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('response', r => { if (r.url().startsWith(server.url) && r.status() >= 400) failures.push(r.url()); });
  page.on('request', r => { if (r.url().startsWith(server.url + '/assets/')) requests.add(new URL(r.url()).pathname.slice(8)); });
  await page.route('https://sdk.crazygames.com/**', route => route.fulfill({ contentType: 'text/javascript', body: mock }));
  await page.route(/https:\/\/(fonts\.googleapis|fonts\.gstatic)\.com\//, route => route.abort());
  await page.addInitScript(() => {
    window.fullscreenRequests = 0;
    Element.prototype.requestFullscreen = () => { window.fullscreenRequests++; return Promise.resolve(); };
    localStorage.setItem('kingdomofthefairies.settings.v1', JSON.stringify({ cast: 'original', sound: false }));
  });
  await page.goto(server.url + '/?qa&widowsbay=on&look=original&edit=local');
  await wait(page, `${qa} && !document.body.classList.contains('booting')`);
  assert.equal(await page.evaluate(`${qa}.settings.cast`), 'tinted');
  assert.equal(await page.locator('#btn-fullscreen').isVisible(), false);
  assert.equal(await page.locator('#btn-sound').isVisible(), false);
  assert.equal(await page.locator('[data-key="sound"]').isVisible(), false);
  assert.equal(await page.evaluate(`${qa}.audio.state().sound`), true, 'old local mute does not suppress platform sound');
  assert.equal(await page.locator('[data-key="castLook"]').isVisible(), false);
  assert.equal(await page.locator('#unlock-editor').count(), 0);
  assert.equal(await page.evaluate(`import('./src/theme.js').then(m => m.EDITION)`), 'film');
  assert.ok(!(await page.evaluate('window.cgCalls')).includes('gameplayStart'), 'title is not gameplay');
  await wait(page, `window.cgCalls.includes('gameplayStart')`);
  assert.equal(await page.evaluate(`${qa}.S.actIndex`), 0);
  assert.equal(await page.evaluate(`${qa}.S.state.p.vx`), 0, 'opening idle pose is exercised');
  assert.ok(await page.evaluate(`${qa}.assets.images['prince-court-tinted']?.naturalWidth > 0`), 'opening standing artwork is decoded before play');
  assert.equal(await page.evaluate('window.fullscreenRequests'), 0);
  assert.ok(![...requests].some(p => p.includes('widowsbay') || p.includes('band-trio')), 'no legacy downloads');
  const manifest = JSON.parse(await fs.readFile(release + 'assets/manifest.json'));
  const firstFiles = new Set(ACT_ART.film.prologue.tinted.map(id => manifest.slots[id]?.file));
  const laterOnly = new Set(ACT_ART.film.burning.tinted.map(id => manifest.slots[id]?.file).filter(p => p && !firstFiles.has(p)));
  assert.ok(![...requests].some(p => laterOnly.has(p)), 'later act art is deferred');
  const initialRequests = [...requests];
  const initialBytes = (await Promise.all(initialRequests.map(async p => (await fs.stat(release + 'assets/' + p)).size))).reduce((a,b) => a+b,0);
  assert.ok(initialBytes < 20e6, `initial assets ${initialBytes} bytes exceed mobile target`);
  await page.evaluate('window.cgSettings({muteAudio:true})');
  assert.equal(await page.evaluate(`${qa}.audio.state().sound`), false);
  await page.locator('#btn-settings').click();
  assert.equal(await page.locator('[data-key="music"]').isVisible(), true);
  assert.equal(await page.locator('[data-key="sfx"]').isVisible(), true);
  await page.locator('[data-key="music"]').fill('6');
  await page.locator('[data-key="sfx"]').fill('7');
  assert.equal(await page.evaluate(`${qa}.audio.state().sound`), false, 'mix changes cannot override platform mute');
  await page.locator('#settings .card-x').click();
  await page.evaluate('window.cgSettings({muteAudio:false})');
  assert.equal(await page.evaluate(`${qa}.audio.state().sound`), true);
  await page.keyboard.press('KeyP');
  await wait(page, `window.cgCalls.includes('gameplayStop')`);
  const starts = await page.evaluate('window.cgCalls.filter(x=>x==="gameplayStart").length');
  await page.locator('#pause [data-act="resume"]').click();
  await wait(page, `window.cgCalls.filter(x=>x==='gameplayStart').length > ${starts}`);
  const recoveryStarts = await page.evaluate('window.cgCalls.filter(x=>x==="gameplayStart").length');
  const recoveryStops = await page.evaluate('window.cgCalls.filter(x=>x==="gameplayStop").length');
  await exerciseAssetRecovery(page);
  await wait(page, `window.cgCalls.filter(x=>x==='gameplayStart').length >= ${recoveryStarts + 2}`);
  assert.ok(await page.evaluate(`window.cgCalls.filter(x=>x==='gameplayStop').length >= ${recoveryStops + 2}`), 'asset waits stop SDK gameplay and resume only after recovery');
  // Exercise every act's loading and scene selection, including remote saves.
  await page.evaluate(`${qa}.open.scenes()`);
  const sceneCount = await page.locator('#scene-list button').count();
  assert.ok(sceneCount > 0);
  await page.locator('#scenes .card-x').click();
  for (let act = 1; act <= 7; act++) {
    await page.goto(server.url + '/?qa&act=' + act + '&scene=0');
    await wait(page, `${qa} && !document.body.classList.contains('booting')`);
    await wait(page, `${qa}.S.mode === 'play' && ${qa}.S.curtain > 0.9`);
    assert.deepEqual(await page.evaluate(`${qa}.assets.failed`), [], 'act ' + act + ' assets');
    const needed = Object.values(ACT_ART.film)[act - 1].tinted;
    assert.deepEqual(await page.evaluate(ids => ids.filter(id => !window.__kingdomOfTheFairies.assets.images[id]), needed), [], 'act ' + act + ' required art decoded');
    if (act === 1) {
      // Inject a valid checkpoint to isolate persistence from story timing.
      // The game suites independently test earning these checkpoints.
      await page.evaluate(`${qa}.S.state.checkpoint = {scene: 1}`);
      await wait(page, `window.cgCalls.some(x=>x.startsWith('write:'))`);
      assert.ok(await page.evaluate(`JSON.parse(localStorage.getItem('cg:kingdomofthefairies.save.v1')).scenes`));
      assert.equal(await page.evaluate(`localStorage.getItem('kingdomofthefairies.save.v1')`), null, 'progress uses SDK storage exclusively');
    }
  }
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(failures, []);
  const viewportSizes = [[907,510], [1216,684], [1077,606], [821,462], [1366,768], [1920,1080], [1536,864], [1280,720], [1080,607]];
  for (const [width, height] of viewportSizes) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(120);
    const layout = await page.evaluate(() => ({ width: document.querySelector('#app').clientWidth, height: document.querySelector('#app').clientHeight, scroll: document.documentElement.scrollWidth > innerWidth }));
    assert.equal(layout.width, width); assert.equal(layout.height, height); assert.equal(layout.scroll, false);
  }
  await page.setViewportSize({ width: 907, height: 510 });
  await page.waitForTimeout(120);
  await page.screenshot({ path: release + '../crazygames-preview.png' });
  console.log(`CrazyGames integration passed: 7 acts; film/tint locks; SDK lifecycle, mute, saves, no fullscreen; initial requested assets ${(initialBytes / 1e6).toFixed(1)} MB.`);
  // SDK failure must show recovery instead of silently using another save.
  const failedPage = await browser.newPage();
  await failedPage.route('https://sdk.crazygames.com/**', route => route.fulfill({ contentType: 'text/javascript', body: 'window.CrazyGames={SDK:{init:async()=>{throw Error("offline")}}}' }));
  await failedPage.goto(server.url);
  await failedPage.getByRole('button', { name: 'Reload', exact: true }).waitFor();
  console.log('SDK initialization failure recovery passed.');
  const mobile = await browser.newPage({ viewport: { width: 800, height: 450 }, isMobile: true, hasTouch: true });
  await mobile.route('https://sdk.crazygames.com/**', route => route.fulfill({ contentType: 'text/javascript', body: mock }));
  mobile.on('pageerror', e => pageErrors.push(e.message));
  await mobile.goto(server.url + '/?qa');
  await wait(mobile, `window.cgCalls.includes('gameplayStart')`);
  const outside = await mobile.evaluate(() => [...document.querySelectorAll('#touch button, #icons button')].filter(el => {
    const r = el.getBoundingClientRect();
    return getComputedStyle(el).display !== 'none' && r.width && r.height && (r.left < 0 || r.top < 0 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1);
  }).map(el => el.className));
  assert.deepEqual(outside, [], 'mobile controls stay within supplied viewport');
  assert.deepEqual(pageErrors, []);
  console.log('800×450 mobile viewport and touch controls passed.');
  await fs.writeFile(release + '../crazygames-browser-checks.json', JSON.stringify({ status: 'passed', acts: 7, viewportSizes: [...viewportSizes, [800,450]], initialGameAssetBytes: initialBytes, checks: ['automatic opening without clicks', 'film/colorized locks', 'later art deferred', 'SDK initialization before progress reads', 'SDK gameplay and loading transitions', 'platform mute precedence', 'SDK progress storage', 'no custom fullscreen requests', 'SDK startup failure recovery', 'mobile controls inside viewport'], limits: 'Mocked SDK integration; initial game assets exclude remote SDK/fonts. Real SDK localhost smoke test also run separately. Real portal QA still required.' }, null, 2) + '\n');
} finally { await browser.close(); server.close(); }

// Integration checks for both editions, including network exclusion and music startup.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { serve, playwright } from '../../shared/test/lib.mjs';
const out = new URL('../../local/fairies-theme/', import.meta.url);
await mkdir(out, { recursive: true });
const server = await serve(new URL('../', import.meta.url).pathname);
const { chromium } = await (process.env.PLAYWRIGHT_MODULE ? import(process.env.PLAYWRIGHT_MODULE) : playwright());
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
try {
  const results = [];
  for (const legacy of [false, true]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [], requests = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => requests.push(r.url()));
    await page.addInitScript(() => {
      for (const prefix of ['widowsbay', 'kingdomofthefairies', 'kingdomofthefairies.partial']) localStorage.setItem(prefix + '.settings.v1', JSON.stringify({ film: 'off', music: 0, sfx: 0, period: false, extraAnimations: true }));
    });
    await page.goto(server.url + '/?qa' + (legacy ? '&widowsbay=on' : ''));
    await page.waitForFunction(() => document.querySelector('#logo-img').naturalWidth > 0);
    assert.equal(await page.title(), legacy ? "Widow's Bay" : 'Kingdom of the Fairies');
    assert.equal(await page.locator('[data-key="period"]').evaluate(el => el.hidden), !legacy);
    const credits = await page.evaluate(() => {
      const el = document.querySelector('#credits'); el.hidden = false;
      const text = el.innerText; el.hidden = true; return text;
    });
    assert.equal(/Langan|Frost|Wane|music video/.test(credits), legacy);
    assert.equal(/Widow[’']s Bay/.test(credits), legacy);
    await page.screenshot({ path: new URL(legacy ? 'legacy-title.png' : 'fairies-title.png', out).pathname });
    await page.locator('#start').click();
    await page.waitForFunction(() => window.__kingdomOfTheFairies?.audio.nowPlaying(), { timeout: 30000 });
    const music = await page.evaluate(() => window.__kingdomOfTheFairies.audio.nowPlaying());
    assert.equal(music.kind, legacy ? 'song' : 'period');
    if (!legacy) {
      const reprise = await page.evaluate(() => {
        const audio = window.__kingdomOfTheFairies.audio;
        audio.returnToSong(); audio.setPeriodOn(false); return audio.nowPlaying();
      });
      assert.equal(reprise.kind, 'period', 'default never returns to a song');
    }
    assert.equal(requests.some(u => u.endsWith('/audio/widowsbay.mp3')), legacy);
    const rendered = await page.evaluate(async () => {
      const { loadAssets, createRenderer } = await import('/src/art.js');
      const { ACTS } = await import('/src/acts/index.js');
      const assets = await loadAssets('/assets/'); await assets.all;
      const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
      const renderer = createRenderer(canvas, assets), bandCalls = [];
      for (const fn of ['asset', 'assetCrop', 'idle', 'img']) {
        const original = renderer.kit[fn];
        renderer.kit[fn] = (...args) => { if (String(args[0]).startsWith('band-')) bandCalls.push(args[0]); return original(...args); };
      }
      const scenes = [];
      for (const act of ACTS) for (let scene = 0; scene < (act.scenes?.length || 1); scene++) {
        const state = act.create({ from: { scene }, carry: { guitar: true, pearl: true, rose: true, stone: true, sleepers: 8, tea: 3 } });
        state.beat = 8; state.phaseT = 8;
        renderer.render({ act, state, t: 8, curtain: 1, film: 'off', extraAnimations: true, hud: true });
        scenes.push([act.id, scene]);
      }
      renderer.render({ t: 8, curtain: 0, film: 'off', curtainCall: 1 });
      window.__themeRenderer = { renderer, canvas, ACTS };
      return { bandCalls, scenes, bandLoaded: Object.keys(assets.images).filter(id => id.startsWith('band-')), songRegistered: !!assets.audio.song };
    });
    assert.equal(rendered.songRegistered, legacy);
    assert.equal(rendered.bandLoaded.length > 0, legacy);
    assert.equal(rendered.bandCalls.length > 0, legacy);
    if (!legacy) assert.equal(requests.some(u => /\/(?:band-[^/]+|logo\.webp)(?:$|\?)/.test(u)), false);
    const pageant = await page.evaluate(() => {
      const { renderer, canvas, ACTS } = window.__themeRenderer;
      const act = ACTS[4], state = act.create({ from: { scene: 6 }, carry: { guitar: true, pearl: true, stone: true, tea: 3, sleepers: 8 } });
      state.phaseT = 6;
      renderer.render({ act, state, t: 6, curtain: 1, film: 'off', extraAnimations: true });
      return canvas.toDataURL().split(',')[1];
    });
    await writeFile(new URL(legacy ? 'legacy-pageant.png' : 'fairies-pageant.png', out), Buffer.from(pageant, 'base64'));
    assert.deepEqual(errors, []);
    results.push({ legacy, music, scenes: rendered.scenes.length, bandDraws: rendered.bandCalls.length, errors });
    await page.goto(server.url + '/workbench/?' + (legacy ? 'widowsbay=on' : ''));
    await page.waitForFunction(() => document.querySelector('#scene').options.length > 0);
    assert.equal(await page.title(), (legacy ? "Widow's Bay" : 'Kingdom of the Fairies') + ' · Workbench');
    assert.deepEqual(errors, []);
    await page.close();
  }
  await writeFile(new URL('results.json', out), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); server.close(); }

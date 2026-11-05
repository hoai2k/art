// Exercise late/timed artwork directly, independently of the asset sampler.
import assert from 'node:assert/strict';
import { serve, launch } from '../../shared/test/lib.mjs';
const preview = process.argv.includes('--preview');
const urlArg = process.argv.indexOf('--url');
const root = new URL(preview ? '../dist/crazygames-preview/' : '../', import.meta.url).pathname;
const server = urlArg < 0 ? await serve(root) : null;
const url = (urlArg < 0 ? server.url : process.argv[urlArg + 1]).replace(/\/$/, '');
const browser = await launch();
try {
  const missing = [];
  for (const [key, number, targets] of [['court', 4, ['fish-large']], ['whale', 5, ['whale-tail', 'whale-beached']]]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(url + '/?qa&act=' + number + '&scene=1');
    await page.waitForFunction(() => window.__kingdomOfTheFairies && !document.body.classList.contains('booting'), null, { timeout: 60000 });
    if (!preview) await page.evaluate(() => document.querySelector('#start').click());
    await page.waitForFunction(() => window.__kingdomOfTheFairies.S.mode === 'play' && window.__kingdomOfTheFairies.S.curtain > .9, null, { timeout: 60000 });
    if (!preview) await page.evaluate(() => window.__kingdomOfTheFairies.assets.all);
    const result = await page.evaluate(async ({ key, targets }) => {
      const { createRenderer } = await import('./src/art.js');
      const { ACTS } = await import('./src/acts/index.js');
      const q = window.__kingdomOfTheFairies, act = ACTS.find(a => a.key === key);
      const state = act.create({ from: { scene: 1 } });
      if (key === 'court') { state.fish.t = 2.1; state.whale.t = -1; }
      else { state.phase = 'shore'; state.phaseT = 0; }
      const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
      const renderer = createRenderer(canvas, q.assets), drawn = {};
      const asset = renderer.kit.asset;
      renderer.kit.asset = (id, ...args) => { const ok = asset(id, ...args); if (targets.includes(id)) drawn[id] = !!ok; return ok; };
      renderer.render({ act, state, t: 2, curtain: 1, film: 'off', tinted: true, hud: true });
      if(key==='whale'){ const {shoreTimes}=await import('./src/acts/act4.js');state.phaseT=shoreTimes(state.revellers).tail+1;renderer.render({act,state,t:state.phaseT,curtain:1,film:'off',tinted:true,hud:true}); }
      return { drawn, failed: q.assets.failed };
    }, { key, targets });
    console.log(preview ? 'preview' : 'website', key, JSON.stringify(result));
    for (const id of targets) if(result.drawn[id]!==true) missing.push(id);
    assert.deepEqual(result.failed, []); assert.deepEqual(errors, []);
    await page.close();
  }
  assert.deepEqual(missing, [], 'late artwork must draw delivered assets, not procedural fallbacks');
} finally { await browser.close(); server?.close(); }

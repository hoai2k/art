// Cold scene selection and the entire timed shore procession. Runtime
// artwork recovery is a fallback, never an acceptable scene preload plan.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { serve, playwright } from '../../shared/test/lib.mjs';
const preview = process.argv.includes('--preview');
const output = process.env.KOTF_QA_OUTPUT || '/tmp/fairy-whale-preload';
await mkdir(output, { recursive: true });
const root = new URL(preview ? '../dist/crazygames-preview/' : '../', import.meta.url).pathname;
const server = await serve(root), { chromium } = await playwright();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultTimeout(60000);
  const errors = [], lateRequests = [];
  let watching = false;
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (watching && /\/assets\/.*\.webp(?:\?|$)/.test(r.url())) lateRequests.push(r.url()); });
  await page.addInitScript(() => { Element.prototype.requestFullscreen = () => Promise.resolve(); });
  await page.goto(server.url + '/?qa&debug');
  await page.waitForFunction(() => window.__kingdomOfTheFairies && !document.body.classList.contains('booting'));
  if (!preview) await page.locator('#start').click();
  await page.waitForFunction(() => window.__kingdomOfTheFairies.S.mode === 'playbill');
  const scenes = [];
  for (const [name, x, scene] of [['The Cave Mouth', 140, 5], ['The Dark Pools', 1980, 6], ['The Cave Mouth', 140, 5]]) {
    await page.evaluate(() => window.__kingdomOfTheFairies.open.scenes());
    await page.locator('#scene-list').getByRole('button', { name: new RegExp(name + '$') }).click();
    const sample = await page.evaluate(() => {
      const S = window.__kingdomOfTheFairies.S;
      return { phase: S.state.phase, x: S.state.cv?.s.x, checkpoint: S.checkpoint.scene, caption: S.card?.sub };
    });
    assert.equal(sample.phase, 'cavern'); assert.equal(sample.x, x);
    assert.equal(sample.checkpoint, scene); assert.ok(sample.caption.includes(name));
    scenes.push({ name, ...sample });
  }
  await page.waitForFunction(async () => {
    const q = window.__kingdomOfTheFairies, { ACT_ART } = await import('/src/act-art.js');
    const p = q.assets.progress(ACT_ART.film.whale.tinted); return p.done >= p.total;
  });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__kingdomOfTheFairies.S.mode === 'play');
  const missing = await page.evaluate(async () => {
    const q = window.__kingdomOfTheFairies, { ACT_ART } = await import('/src/act-art.js');
    const needed = ['crew-squire-crawl-tinted', 'crew-bosun-crawl-tinted', 'crew-helmsman-crawl-tinted', 'crew-manatarms-crawl-tinted'];
    return needed.filter(id => !ACT_ART.film.whale.tinted.includes(id) || !q.assets.images[id]?.naturalWidth);
  });
  assert.deepEqual(missing, [], 'every survivor crawl is in the scene preload and decoded before play');
  await page.evaluate(() => {
    const q = window.__kingdomOfTheFairies, act = q.S.act;
    window.shoreReview = { waits: [], required: [], emerged: [], actStep: act.step };
    addEventListener('kotf:asset-wait', e => { if (e.detail.waiting) window.shoreReview.waits.push(q.S.state.phaseT); });
    const require = q.assets.require;
    q.assets.require = (...args) => { window.shoreReview.required.push(args[0]); return require(...args); };
    act.step = (st, dt, input) => {
      window.shoreReview.actStep(st, dt * 3, input);
      window.shoreReview.emerged.push(...st.events.filter(e => e.type === 'revellerOut').map(e => e.n));
    };
    const st = act.create({ carry: { sleepers: 8 } }); st.phase = 'shore'; st.phaseT = 0;
    Object.assign(q.S, { state: st, mode: 'play', paused: false, card: null, curtain: 1, curtainTarget: 1 });
  });
  watching = true;
  await page.waitForFunction(() => window.__kingdomOfTheFairies.S.state.phase === 'cavern');
  watching = false;
  const result = await page.evaluate(() => ({ ...window.shoreReview, actStep: undefined }));
  assert.deepEqual(result.waits, [], 'no flickering recovery overlay during the procession');
  assert.deepEqual(result.required, [], 'no unplanned image requirement during the procession');
  assert.deepEqual(lateRequests, [], 'no images download once the scene starts');
  assert.equal(new Set(result.emerged).size, 8, 'all survivor arrivals were exercised');
  assert.deepEqual(errors, []);
  await page.locator('#stage').screenshot({ path: `${output}/${preview ? 'preview' : 'website'}-cave-mouth.png` });
  await writeFile(`${output}/${preview ? 'preview' : 'website'}-checks.json`, JSON.stringify({ scenes, ...result, lateRequests }, null, 2) + '\n');
  console.log(`${preview ? 'Preview' : 'Website'}: Cave Mouth and Dark Pools select distinct correct spawn points; all eight shore arrivals need no late images or loading overlays`);
} finally { await browser.close(); server.close(); }

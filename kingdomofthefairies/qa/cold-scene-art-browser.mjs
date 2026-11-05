// Decode the delivered catalog, then restrict each renderer to that Act's
// preload list. The rest of the game's cached images cannot mask omissions.
import assert from 'node:assert/strict';
import { serve, playwright } from '../../shared/test/lib.mjs';
const preview = process.argv.includes('--preview');
const server = await serve(new URL(preview ? '../dist/crazygames-preview/' : '../', import.meta.url).pathname);
const { chromium } = await playwright();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(server.url + '/?qa');
  await page.waitForFunction(() => window.__kingdomOfTheFairies && !document.body.classList.contains('booting'), null, { timeout: 60000 });
  const result = await page.evaluate(async preview => {
    const q = window.__kingdomOfTheFairies, { ACTS } = await import('/src/acts/index.js');
    const { ACT_ART } = await import('/src/act-art.js'), { createRenderer } = await import('/src/art.js');
    const looks = preview ? ['tinted'] : ['tinted', 'original'];
    await q.assets.want([...new Set(ACTS.flatMap(a => looks.flatMap(look => ACT_ART.film[a.key][look])))]);
    const failed = [], samples = [];
    for (const act of ACTS) for (const look of looks) {
      const ids = ACT_ART.film[act.key][look], required = [];
      const images = Object.fromEntries(ids.filter(id => q.assets.images[id]).map(id => [id, q.assets.images[id]]));
      const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
      const assets = { ...q.assets, images, require: id => required.push(id) }, renderer = createRenderer(canvas, assets);
      const draw = (st, label) => {
        required.length = 0;
        const complete = renderer.render({ act, state: st, t: st.phaseT || 1, curtain: 1, film: 'off', tinted: look === 'tinted', hud: true });
        samples.push(`${act.key}/${look}/${label}`);
        if (!complete || required.length) failed.push({ act: act.key, look, label, required: required.slice() });
      };
      for (let scene = 0; scene < (act.scenes?.length || 1); scene++) {
        const st = act.create({ carry: { sleepers: 8, tea: 3, guitar: true, pearl: true, stone: true, pearls: 30 }, from: { scene } });
        draw(st, 'entry-' + scene);
      }
      if (act.key === 'crossing') for (const phase of ['party', 'turn', 'wreck', 'sink', 'iris']) for (const age of [.2, 1.2, 2.4, 3.3, 5]) {
        const st = act.create({}); st.phase = phase; st.phaseT = age; draw(st, phase + '-' + age);
      }
      if (act.key === 'grotto') for (const age of [0, .2, .8, 1.8, 3.5]) {
        const st = act.create({}); st.phase = 'swim'; st.phaseT = 10;
        for (const sl of st.sleepers) { sl.state = age ? 'rising' : 'asleep'; sl.t = age; }
        draw(st, 'sleepers-' + age);
      }
      if (act.key === 'whale') {
        const { MAX_REVELLERS, shoreTimes } = await import('/src/acts/act4.js');
        const st = act.create({ carry: { sleepers: MAX_REVELLERS } }); st.phase = 'shore';
        const T = shoreTimes(MAX_REVELLERS);
        for (const t of [T.crawl + .1, T.crawl + 1.6, T.crawl + 2.1, T.tail + 1, ...Array.from({ length: MAX_REVELLERS }, (_, i) => T.out + i * T.gap + .1)]) {
          st.phaseT = t; draw(st, 'shore-' + t);
        }
      }
    }
    return { failed, samples: samples.length };
  }, preview);
  assert.deepEqual(result.failed, []); assert.deepEqual(errors, []);
  console.log(`${preview ? 'Preview' : 'Website'}: ${result.samples} cold Act/look/scene and late crew-pose renders completed using only their own preload lists`);
} finally { await browser.close(); server.close(); }

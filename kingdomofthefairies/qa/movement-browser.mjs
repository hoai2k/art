// Run: CHROMIUM_PATH=/path/to/chromium node kingdomofthefairies/qa/movement-browser.mjs
// Saves game screenshots and asset/pose checks in ignored local/.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { serve, playwright } from '../../shared/test/lib.mjs';

const out = new URL('../../local/widowsbay-movement/', import.meta.url);
await mkdir(out, { recursive: true });
const server = await serve(new URL('../', import.meta.url).pathname);
const { chromium } = await playwright();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(server.url + '/?qa');
  const assets = await page.evaluate(async () => {
    const { loadAssets, createRenderer } = await import('/src/art.js');
    const { MOVEMENT_IDS } = await import('/src/acts/sailor-motion.js');
    const { default: act4 } = await import('/src/acts/act4.js');
    const { default: act5, HOUSE, climberPos } = await import('/src/acts/act5.js');
    const a = await loadAssets('/assets/'); await a.all;
    const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
    const renderer = createRenderer(canvas, a);
    const asset = renderer.kit.asset;
    const draws = [];
    renderer.kit.asset = (...args) => {
      if (args[0].startsWith('sailor-') || args[0].startsWith('prince-wall-')) draws.push({ id: args[0], box: args.slice(1, 5), pass: renderer.kit.P.mode });
      return asset(...args);
    };
    window.__movement = { a, renderer, canvas, draws, act4, act5, HOUSE, climberPos };
    return MOVEMENT_IDS.map((id) => ({ id, loaded: !!a.images[id],
      width: a.images[id]?.naturalWidth, height: a.images[id]?.naturalHeight }));
  });
  for (const a of assets) {
    assert.equal(a.loaded, true, a.id); assert.equal(a.width, 360); assert.equal(a.height, 440);
  }
  const cases = [
    ['whale-rise', 'sailor-leap'], ['whale-apex', 'sailor-apex'],
    ['whale-fall', 'sailor-fall'], ['whale-land', 'sailor-land'],
    // the film's cliff climbs on the prince's own wall frames (F19)
    ['cliff-reach', 'prince-wall-up-a'], ['cliff-pull', 'prince-wall-up-b'],
    ['cliff-fall', 'sailor-fall'], ['stairs-a', 'sailor-stairs-a'],
    ['stairs-b', 'sailor-stairs-b'], ['ladder', 'prince-wall-up-b'],
    ['ivy', 'prince-wall-up-b'], ['slope', 'sailor-stairs-b'],
    ['house-fall', 'sailor-fall'], ['house-land', 'sailor-land'], ['house-throw', 'sailor-throw'],
    ['house-carry', 'sailor-carry'],
  ];
  const records = [];
  for (const [name, expected] of cases) {
    const result = await page.evaluate(([name, expected]) => {
      const B = window.__movement;
      let act, st;
      if (name.startsWith('whale-')) {
        act = B.act4; st = act.create();
        if (name === 'whale-land') st.s.landT = 0.1;
        else Object.assign(st.s, { on: null, x: 400, y: 270,
          vy: name === 'whale-rise' ? -400 : name === 'whale-fall' ? 1100 : 0 });
      } else if (name.startsWith('cliff-')) {
        // the continuous climb (src/acts/climb.js): on the wall, climbing up,
        // a step into the cycle (reach, then pull), or falling
        act = B.act5; st = act.create();
        Object.assign(st.wall, { mode: name === 'cliff-fall' ? 'fall' : 'wall', dir: { x: 0, y: 1 }, dist: name === 'cliff-pull' ? 20 : 0, y: 260, ledge: null });
      } else {
        act = B.act5; st = act.create({ from: { scene: 2 }, carry: { stone: true } });
        const kind = name.startsWith('stairs') ? 'stairs' : name;
        const c = st.conns.find((c) => c.kind === kind);
        if (c) {
          const length = Math.hypot(c.b.x-c.a.x, B.HOUSE.floors[c.b.f]-B.HOUSE.floors[c.a.f]);
          const u = name === 'stairs-a' ? 60 / length : 85 / length;
          st.p.conn = { c, u };
          st.p.x = c.a.x + (c.b.x-c.a.x)*u;
          st.p.y = B.HOUSE.floors[c.a.f] + (B.HOUSE.floors[c.b.f]-B.HOUSE.floors[c.a.f])*u;
          st.p.face = c.b.x < c.a.x ? -1 : 1;
        } else if (name === 'house-fall') Object.assign(st.p, { f: -1, vy: 1100, y: 470 });
        else if (name === 'house-land') st.p.landT = 0.1;
        else if (name === 'house-throw') { st.throwT = 0.2; st.p.x = 700; st.p.f = 1; st.p.y = B.HOUSE.floors[1]; }
        else if (name === 'house-carry') st.p.carry = true;
      }
      B.draws.length = 0;
      const rendered = B.renderer.render({ act, state: st, t: 1, film: 'off', curtain: 1, hud: true });
      const draws = B.draws.filter((d) => d.id === expected);
      const png = B.canvas.toDataURL('image/png').split(',')[1];
      return { draws, png, rendered, recovery: B.a.recovery() };
    }, [name, expected]);
    assert.equal(result.draws.length, 2, name + ' draws expected pose in both passes: '+JSON.stringify({rendered:result.rendered,recovery:result.recovery}));
    assert.deepEqual(result.draws[0].box, result.draws[1].box);
    await writeFile(new URL(name + '.png', out), Buffer.from(result.png, 'base64'));
    records.push({ name, expected, draws: result.draws });
  }
  // Missing delivered pose: hold the frame for loading, never substitute art.
  const fallback = await page.evaluate(() => {
    // (in the film edition sailor-fall is drawn as prince-fall: take both away)
    const B = window.__movement; for (const id of ['sailor-fall', 'prince-fall', 'prince-fall-tinted']) delete B.a.images[id];
    const st = B.act4.create(); Object.assign(st.s, { on: null, vy: 1100 });
    B.draws.length = 0;
    const rendered = B.renderer.render({ act: B.act4, state: st, t: 1, film: 'off', curtain: 1 });
    return { rendered, recovery: B.a.recovery(), draws: B.draws.map((d) => d.id) };
  });
  assert.equal(fallback.rendered, false);
  assert.equal(fallback.recovery.blocked, true);
  assert.ok(!fallback.draws.includes('sailor-leap'), JSON.stringify(fallback));
  assert.deepEqual(errors, []);
  await writeFile(new URL('validation.json', out), JSON.stringify({ assets, records, fallback, errors }, null, 2));
  console.log('Browser passed: eight alpha assets loaded, sixteen movement scenes in both passes, missing-art frame held.');
} finally { await browser.close(); server.close(); }

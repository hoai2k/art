// Review delivered F24–F26 art through the real renderer in every look/effect
// combination. Screenshots and measured scales go to the supplied directory.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { serve, playwright } from '../../shared/test/lib.mjs';
const output = process.argv[2] || '/tmp/fairies-art-review';
const extraAnimations = process.argv[3] !== 'still';
await mkdir(output, { recursive: true });
const server = await serve(new URL('../', import.meta.url).pathname);
const { chromium } = await playwright();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
const measurements = [];
try {
  for (const look of ['original', 'tinted']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(server.url + '/?qa&widowsbay=off&look=' + look);
    await page.waitForFunction(() => window.__kingdomOfTheFairies);
    await page.evaluate(async () => {
      const { loadAssets, createRenderer } = await import('/src/art.js');
      const { drawPerson, personPx } = await import('/src/pose.js');
      const { actBurning, DUEL } = await import('/src/acts/act5film.js');
      const { default: act4 } = await import('/src/acts/act4.js');
      const cavern = await import('/src/acts/act4cavern.js');
      const assets = await loadAssets('/assets/'); await assets.all;
      const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
      canvas.id = 'delivery-review'; canvas.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;width:1280px;height:720px';
      document.body.append(canvas);
      window.deliveryReview = { assets, canvas, createRenderer, drawPerson, personPx, actBurning, DUEL, act4, cavern };
    });
    for (const film of ['off', 'gentle', 'full']) {
      for (const phase of ['scale', 'idle', 'warn', 'reel', 'trap', 'land', 'occupied', 'hang', 'shake', 'fall', 'broken']) {
        const result = await page.evaluate(({ look, film, phase, extraAnimations }) => {
          const q = window.deliveryReview, renderer = q.createRenderer(q.canvas, q.assets);
          const view = { t: 8.025, film, curtain: 1, tinted: look === 'tinted', extraAnimations, hud: false };
          const crops = [], draws = [], sizes = {}, barrelBodies = {};
          for (const method of ['asset', 'idle', 'assetCrop']) {
            const original = renderer.kit[method];
            renderer.kit[method] = (id, ...args) => {
              draws.push(id);
              if (method === 'assetCrop' && id === 'cavern-stalactite') crops.push(args);
              return original(id, ...args);
            };
          }
          if (phase === 'scale') {
            view.scene = k => {
              k.c.fillStyle = k.col('#9c8d92'); k.c.fillRect(0, 0, 1280, 720);
              for (const [id, x, y] of [['prince-stand', 340, 340], ['prince-strike', 790, 340], ['witch-hooded', 260, 650], ['witch-cast', 630, 650], ['witch-recoil', 1010, 650]]) {
                sizes[id] = q.personPx(k, id);
                q.drawPerson(k, id, x, y, 190);
                k.c.fillStyle = k.col('#2a1424'); k.c.font = '14px sans-serif'; k.c.textAlign = 'center'; k.c.fillText(id, x, y + 15);
              }
              for (const id of ['barrel-upturned', 'witch-barrel']) {
                const im = k.img(id), sample = document.createElement('canvas');
                sample.width = im.naturalWidth; sample.height = im.naturalHeight;
                const cx = sample.getContext('2d'); cx.drawImage(im, 0, 0);
                const pixels = cx.getImageData(0, 0, sample.width, sample.height).data;
                let x0 = sample.width, x1 = 0, y0 = sample.height, y1 = 0;
                for (let y = 92; y < sample.height; y++) for (let x = 0; x < sample.width; x++) {
                  if (pixels[(y * sample.width + x) * 4 + 3] < 40) continue;
                  x0 = Math.min(x0, x); x1 = Math.max(x1, x + 1); y0 = Math.min(y0, y); y1 = Math.max(y1, y + 1);
                }
                barrelBodies[id] = { width: x1 - x0, height: y1 - y0, bottom: y1 };
              }
            };
          } else if (['hang', 'shake', 'fall', 'broken'].includes(phase)) {
            const st = q.act4.create({ from: { scene: 5, x: 1980, stone: true } });
            st.cv.t = 8; st.grace = 0; st.cv.drops = [st.cv.drops[3]];
            const d = st.cv.drops[0], events = [];
            // Exercise the real proximity trigger, shake timer and gravity.
            q.cavern.stepCavern(st.cv, 1 / 60, {}, { hit() {}, pearl() {}, events, graceLeft: () => 1 });
            if (phase === 'hang') { d.state = 'hang'; d.y = q.cavern.CEIL_Y; }
            if (phase === 'fall' || phase === 'broken') {
              for (let i = 0; i < 240 && (phase === 'broken' ? d.state !== 'broken' : !(d.state === 'fall' && d.y > 170)); i++) {
                q.cavern.stepCavern(st.cv, 1 / 60, {}, { hit() {}, pearl() {}, events, graceLeft: () => 1 });
              }
            }
            view.act = q.act4; view.state = st;
          } else {
            const st = q.actBurning.create({ from: { scene: 3, introDone: true } });
            st.w.x = 485; st.duel.x = 690;
            st.duel.state = ['land', 'occupied'].includes(phase) ? 'trap' : phase;
            st.duel.t = phase === 'trap' ? (q.DUEL.trap.drop + q.DUEL.trap.land) / 2 : phase === 'land' ? q.DUEL.trap.land + 0.1 : phase === 'occupied' ? q.DUEL.trap.land + 0.6 : 0.2;
            st.w.strikeT = phase === 'warn' || phase === 'reel' ? 0.25 : 0;
            view.act = q.actBurning; view.state = st;
          }
          renderer.render(view);
          return { sizes, draws, crops, barrelBodies };
        }, { look, film, phase, extraAnimations });
        if (phase === 'scale') {
          measurements.push({ look, film, sizes: result.sizes });
          for (const value of Object.values(result.sizes)) assert.ok(value > 0);
          const empty = result.barrelBodies['barrel-upturned'], occupied = result.barrelBodies['witch-barrel'];
          assert.equal(empty.bottom, occupied.bottom, 'barrel base stays on the ground through the handoff');
          assert.ok(Math.abs(empty.height - occupied.height) <= 2, 'barrel rim keeps its height');
          assert.ok(Math.abs(empty.width / occupied.width - 1) < 0.08, 'empty and occupied barrel bodies keep their width');
        } else if (['hang', 'shake', 'fall', 'broken'].includes(phase)) {
          assert.ok(result.draws.includes('cavern-platform'), 'painted rock supports replace the floor rectangles');
          assert.ok(result.crops.length >= 2, `${look}/${film}/${phase}: painted ceiling cap`);
          assert.ok(result.crops[0][5] < 0, "ceiling cap starts beyond the top of the scene");
          assert.ok(result.crops[0][6] > 90, "painted stalactite is enlarged");
          if (phase === 'broken') assert.ok(result.draws.includes('cavern-stalactite-broken'));
          else assert.ok(result.crops.length >= 4, `${phase}: cap and spike in both print passes`);
        } else {
          for (const id of phase === 'warn' ? ['prince-strike', 'witch-cast'] : phase === 'reel' ? ['prince-strike', 'witch-recoil'] : ['trap', 'land'].includes(phase) ? ['barrel-upturned'] : phase === 'occupied' ? ['witch-barrel-anger-b'] : ['witch-hooded']) {
            assert.ok(result.draws.includes(id), `${look}/${film}/${phase}: ${id}`);
          }
        }
        await page.locator('#delivery-review').screenshot({ path: `${output}/${look}-${film}-${phase}.png` });
      }
      console.log(`${look}/${film}, extra animations ${extraAnimations ? 'on' : 'off'}: standing-size comparison, combat and real stalactite lifecycle passed`);
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  for (const look of ['original', 'tinted']) {
    const group = measurements.filter(row => row.look === look);
    for (const row of group) assert.deepEqual(row.sizes, group[0].sizes, 'film effects must not alter character scale');
  }
  await writeFile(`${output}/scales.json`, JSON.stringify(measurements, null, 2) + '\n');
} finally { await browser.close(); server.close(); }

import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { serve, playwright } from '../../shared/test/lib.mjs';
const output = process.argv[2] || '/tmp/fairies-wedding-gifts';
await mkdir(output, { recursive: true });
const root = new URL('../', import.meta.url).pathname;
const servers = [await serve(root), await serve(root + 'dist/crazygames-preview/')];
const { chromium } = await playwright();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
const evidence = [];
try {
  for (let build = 0; build < 2; build++) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(servers[build].url + '/?qa');
    await page.waitForFunction(() => window.__kingdomOfTheFairies && !document.body.classList.contains('booting'));
    const result = await page.evaluate(async build => {
      const q = window.__kingdomOfTheFairies;
      const { actBurning, GIFTING } = await import('/src/acts/act5film.js');
      const { ACT_ART } = await import('/src/act-art.js');
      const { createRenderer } = await import('/src/art.js');
      await q.assets.want(ACT_ART.film.burning.tinted);
      if (!build) await q.assets.want(ACT_ART.film.burning.original);
      const absent = GIFTING.kinds.filter(id => !q.assets.images[id]?.naturalWidth);
      const st = actBurning.create({ carry: { pearls: 10 }, from: { scene: 4 } });
      st.weddingIntro = false; st.phaseT = 5;
      for (let i = 0; i < 1200 && st.phase === 'wedding'; i++) actBurning.step(st, 1/60, { moveX: 1 });
      st.w.x = GIFTING.x; st.w.vx = 0;
      const canvas = document.createElement('canvas'); canvas.id = 'gifts-review'; canvas.width = 1280; canvas.height = 720;
      canvas.style.cssText = 'position:fixed;inset:0;z-index:99999;width:1280px;height:720px'; document.body.append(canvas);
      const renderer = createRenderer(canvas, q.assets), draws = [], asset = renderer.kit.asset;
      renderer.kit.asset = (id, ...args) => { if (id.startsWith('wedding-gift-')) draws.push({ id, width: args[2] }); return asset(id, ...args); };
      const received = [], titles = [], promptDraws = [];
      const context = canvas.getContext('2d'), fillText = context.fillText.bind(context);
      context.fillText = (text, ...args) => { titles.push(text); if (/accept the gift/i.test(text)) promptDraws.push(context.globalAlpha); return fillText(text, ...args); };
      for (let i = 0; i < 20; i++) {
        actBurning.step(st, 1/60, { x: true });
        received.push(st.giftsFlying.at(-1).kind);
        for (let j = 0; j < Math.ceil((GIFTING.flight + 0.1) * 60); j++) {
          actBurning.step(st, 1/60, {});
          if (j === 40) renderer.render({ act: actBurning, state: st, t: 10, curtain: 1, film: 'off', tinted: true });
        }
      }
      actBurning.step(st, 1/60, { x: true });
      for (let j = 0; j < 40; j++) actBurning.step(st, 1/60, {});
      window.giftReview = { st, renderer, act: actBurning, draws };
      const render = tinted => { draws.length = 0; renderer.render({ act: actBurning, state: st, t: 10, curtain: 1, film: 'off', tinted }); return draws.slice(); };
      window.giftReview.render = render;
      const sample = { ...st, w: { ...st.w }, az: { ...st.az }, giftsFlying: st.giftsFlying.map(g => ({ ...g })), giftKinds: [...st.giftKinds], events: [] }, prompt = [];
      const samplePrompt = () => {
        promptDraws.length = 0;
        renderer.render({ act: actBurning, state: sample, t: 10, curtain: 1, film: 'off', tinted: true });
        prompt.push(promptDraws.slice());
      };
      samplePrompt();
      while (sample.giftsFlying.length) actBurning.step(sample, 1/60, {});
      samplePrompt();
      for (let j = 0; j < 27; j++) actBurning.step(sample, 1/60, {});
      samplePrompt();
      for (let j = 0; j < 12; j++) actBurning.step(sample, 1/60, {});
      samplePrompt();
      for (let j = 0; j < 18; j++) actBurning.step(sample, 1/60, {});
      samplePrompt();
      return { absent, received, titles, prompt, landed: st.giftsLanded, repeat: st.giftsFlying[0].kind, draws: render(true) };
    }, build);
    assert.deepEqual(result.absent, []);
    assert.equal(new Set(result.received).size, 20);
    for (const id of result.received) {
      const title = id.replace('wedding-gift-', '').replaceAll('-', ' ');
      assert.ok(result.titles.some(t => t.toLowerCase() === title), `visible title for ${id}`);
    }
    assert.deepEqual(result.prompt.slice(0, 3), [[], [], []], 'prompt hidden during reveal, at landing and for the following half-second');
    assert.ok(result.prompt[3].some(alpha => alpha > 0 && alpha < 1), 'prompt fades in after the delay');
    assert.ok(result.prompt[4].some(alpha => alpha === 1), 'prompt reaches full opacity');
    assert.equal(result.landed, 20);
    assert.equal(result.repeat, result.received[0]);
    assert.ok(result.draws.some(d => d.width === 250), 'handover is large enough to identify');
    assert.equal(new Set(result.draws.map(d => d.id)).size, 20, 'all gifts render on the heap');
    for (const look of build ? ['tinted'] : ['tinted', 'original']) {
      await page.evaluate(look => window.giftReview.render(look === 'tinted'), look);
      await page.locator('#gifts-review').screenshot({ path: `${output}/${build ? 'preview' : 'website'}-${look}.png` });
    }
    assert.deepEqual(errors, []); evidence.push({ build: build ? 'preview' : 'website', ...result });
    await page.close();
  }
  await writeFile(output + '/checks.json', JSON.stringify(evidence, null, 2) + '\n');
  console.log('Website and CrazyGames preview: twenty distinct decoded wedding gifts, large handover, growing heap, and unlimited repeat collection pass');
} finally { await browser.close(); for (const server of servers) server.close(); }

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
      const { TEXT } = await import('/src/text_config.js');
      const { setKeyboardControls } = await import('/src/art.js');
      setKeyboardControls({ primaryX: true, upJump: true });
      const st = actBurning.create({ carry: { pearls: 37, tea: 3 }, from: { scene: 4 } });
      st.weddingIntro = false; st.phaseT = 5;
      for (let i = 0; i < 1200 && st.phase === 'wedding'; i++) actBurning.step(st, 1/60, { moveX: 1 });
      st.w.x = GIFTING.x; st.w.vx = 0;
      const canvas = document.createElement('canvas'); canvas.id = 'gifts-review'; canvas.width = 1280; canvas.height = 720;
      canvas.style.cssText = 'position:fixed;inset:0;z-index:99999;width:1280px;height:720px'; document.body.append(canvas);
      const renderer = createRenderer(canvas, q.assets), draws = [], text = [], asset = renderer.kit.asset;
      renderer.kit.asset = (id, ...args) => { draws.push({ id, x: args[0], y: args[1], width: args[2] }); return asset(id, ...args); };
      const context = canvas.getContext('2d'), fillText = context.fillText.bind(context);
      context.fillText = (value, x, y, ...args) => { text.push({ value, x, y, alpha: context.globalAlpha }); return fillText(value, x, y, ...args); };
      const render = (t = 10, tinted = true, mode = 'key') => {
        draws.length = 0; text.length = 0; renderer.kit.inputMode = mode;
        setKeyboardControls({ primaryX: true, upJump: true });
        renderer.render({ act: actBurning, state: st, t, curtain: 1, film: 'off', tinted });
        return { draws: draws.slice(), text: text.slice() };
      };
      const received = [], titles = [], prompts = [];
      for (let i = 0; i < 20; i++) {
        const mode = ['key', 'pad', 'touch'][i % 3];
        prompts.push({ mode, ...render(10, true, mode) });
        actBurning.step(st, 1/60, { x: true });
        received.push(st.giftsFlying.at(-1).kind);
        for (let j = 0; j < 40; j++) actBurning.step(st, 1/60, {});
        titles.push(render());
        for (let j = 0; j < Math.ceil((GIFTING.flight + GIFTING.promptDelay + GIFTING.promptFade) * 60); j++) actBurning.step(st, 1/60, {});
      }
      for (let i = 0; i < 30; i++) actBurning.step(st, 1/60, { x: true });
      const exhausted = render(), objects = sample => sample.draws.filter(d => d.id === 'aurora-star' || d.id.startsWith('wedding-gift-'));
      const resting = objects(exhausted), later = objects(render(11));
      st.carry.pearls = 0;
      const withoutPearls = objects(render()); st.carry.pearls = 37;
      const sample = render();
      const firstPass = sample.draws.slice(sample.draws.findIndex(d => d.id === 'apotheosis') + 1);
      const nextPass = firstPass.findIndex(d => d.id === 'apotheosis');
      const pilePass = nextPass < 0 ? firstPass : firstPass.slice(0, nextPass);
      window.giftReview = { st, render, act: actBurning };
      return { absent, received, titles, prompts, exhausted, resting, later, withoutPearls, pilePass,
        landed: st.giftsLanded, giftN: st.giftN, flying: st.giftsFlying.length,
        names: GIFTING.kinds.map(id => TEXT.burning.giftTitles[id].toLowerCase()) };
    }, build);
    assert.deepEqual(result.absent, []);
    assert.equal(new Set(result.received).size, 20);
    for (let i = 0; i < 20; i++) {
      assert.ok(result.titles[i].text.some(t => t.value === `The ${result.names[i]}!`), `exclamation for gift ${i + 1}`);
      assert.ok(result.titles[i].draws.some(d => d.id === result.received[i] && d.width === 250));
      const prompt = result.prompts[i].text.find(t => t.value.includes(`Receive the ${result.names[i]}`));
      assert.ok(prompt, `named invitation ${i + 1}`); assert.equal(prompt.y, 360); assert.ok(prompt.x > 700);
      if (result.prompts[i].mode === 'key') assert.ok(result.prompts[i].text.some(t => t.value === 'Space'), 'keyboard primary button');
    }
    assert.equal(result.giftN, 20); assert.equal(result.landed, 20); assert.equal(result.flying, 0);
    assert.ok(!result.exhausted.text.some(t => /Receive the/.test(t.value)), 'no invitation after the last present');
    assert.deepEqual(result.resting, result.later, 'stars and presents stay still');
    assert.deepEqual(result.resting, result.withoutPearls, 'pearls do not occupy object slots');
    const lastPearl = result.pilePass.findLastIndex(d => d.id === 'pearl');
    const firstObject = result.pilePass.findIndex(d => d.id === 'aurora-star' || d.id.startsWith('wedding-gift-'));
    assert.ok(lastPearl >= 0 && lastPearl < firstObject, 'pearls draw behind every object');
    for (const look of build ? ['tinted'] : ['tinted', 'original']) {
      await page.evaluate(look => window.giftReview.render(10, look === 'tinted'), look);
      await page.locator('#gifts-review').screenshot({ path: `${output}/${build ? 'preview' : 'website'}-${look}.png` });
    }
    await page.evaluate(() => {
      const r = window.giftReview;
      Object.assign(r.st, { giftN: 0, giftsLanded: 0, giftKinds: [], giftsFlying: [], giftPromptT: undefined });
      r.render();
    });
    await page.locator('#gifts-review').screenshot({ path: `${output}/${build ? 'preview' : 'website'}-invitation.png` });
    await page.evaluate(() => {
      const r = window.giftReview; r.act.step(r.st, 1/60, { x: true });
      r.st.giftsFlying[0].t = 0.65; r.render();
    });
    await page.locator('#gifts-review').screenshot({ path: `${output}/${build ? 'preview' : 'website'}-goblet.png` });
    assert.deepEqual(errors, []); evidence.push({ build: build ? 'preview' : 'website', ...result });
    await page.close();
  }
  await writeFile(output + '/checks.json', JSON.stringify(evidence, null, 2) + '\n');
  console.log('Website and CrazyGames preview: twenty named invitations above the fairy, Betrothal exclamations, finite gifts, stationary stars and foreground presents pass');
} finally { await browser.close(); for (const server of servers) server.close(); }

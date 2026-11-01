import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { serve, playwright } from '../../shared/test/lib.mjs';
const output = process.argv[2] || '/tmp/fairies-finale-review';
await mkdir(output, { recursive: true });
const server = await serve(new URL('../', import.meta.url).pathname);
const { chromium } = await playwright();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    window.scoreStarts = [];
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) { window.scoreStarts.push(this.buffer?.duration); return start.apply(this, args); };
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (target, ...args) {
      if (target instanceof AudioDestinationNode) {
        const analyser = this.context.createAnalyser(); analyser.fftSize = 2048;
        window.scoreAnalyser = analyser; connect.call(analyser, target);
        return connect.call(this, analyser, ...args);
      }
      return connect.call(this, target, ...args);
    };
  });
  await page.goto(server.url + '/?qa&act=7&scene=4&look=tinted');
  await page.waitForFunction(() => window.__kingdomOfTheFairies);
  // Dispatch through the real start handler even when the shell is still
  // revealing its title art; this is a deliberate QA user gesture.
  await page.locator('#start').evaluate(button => button.click());
  await page.waitForFunction(() => window.__kingdomOfTheFairies.audio.periodStates().includes('period-wedding:ready'), { timeout: 30000 });
  await page.evaluate(() => {
    const { S } = window.__kingdomOfTheFairies;
    S.mode = 'play'; S.card = null; S.curtain = S.curtainTarget = 1; S.paused = false;
  });
  await page.waitForFunction(() => window.__kingdomOfTheFairies.audio.nowPlaying()?.id === 'period-wedding');
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__kingdomOfTheFairies.S.state.w.x > 840);
  await page.keyboard.up('ArrowRight');
  await page.locator('#stage').screenshot({ path: `${output}/stairs-live.png` });
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__kingdomOfTheFairies.S.state.phase === 'apotheosis');
  await page.keyboard.up('ArrowRight');
  const walkToLight = async () => {
    await page.keyboard.down('ArrowRight');
    await page.waitForFunction(() => window.__kingdomOfTheFairies.S.state.w.x > 635);
    await page.keyboard.up('ArrowRight');
    await page.waitForTimeout(180);
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__kingdomOfTheFairies.S.state.flight === 'hold');
  };
  await walkToLight();
  assert.equal(await page.evaluate(async () => (await import('/src/save.js')).loadSave().endings?.wedding), true);
  const held = await page.evaluate(() => window.__kingdomOfTheFairies.S.state.lift);
  await page.waitForTimeout(350);
  assert.equal(await page.evaluate(() => window.__kingdomOfTheFairies.S.state.lift), held, 'no input preserves the elevated pose');
  await page.locator('#stage').screenshot({ path: `${output}/credits-held.png` });
  // Held aloft until the credits begin to roll; then a direction releases them.
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(120);
  if (await page.evaluate(() => window.__kingdomOfTheFairies.S.state.creditsT < 5)) assert.equal(await page.evaluate(() => window.__kingdomOfTheFairies.S.state.flight), 'hold', 'no release before the roll begins');
  await page.waitForFunction(() => window.__kingdomOfTheFairies.S.state.creditsT >= 5);
  await page.keyboard.press('ArrowUp');
  await page.waitForFunction(() => window.__kingdomOfTheFairies.S.state.flight === 'descend');
  await page.waitForTimeout(550);
  const descending = await page.evaluate(() => window.__kingdomOfTheFairies.S.state.lift);
  assert.ok(descending < held && descending > 0, 'vertical input starts a gradual descent');
  await page.waitForFunction(() => !window.__kingdomOfTheFairies.S.state.flight);
  const beforeReturn = await page.evaluate(() => window.__kingdomOfTheFairies.S.state.creditsT);
  await page.keyboard.down('ArrowLeft');
  await page.waitForFunction(() => window.__kingdomOfTheFairies.S.state.w.x <= 120.5);
  await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => window.__kingdomOfTheFairies.S.state.phase), 'finale', 'backward travel waits for a sustained hold at the exit');
  await page.waitForFunction(() => window.__kingdomOfTheFairies.S.state.phase === 'wedding');
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => !window.__kingdomOfTheFairies.S.state.weddingExit);
  assert.ok(await page.evaluate(() => window.__kingdomOfTheFairies.S.state.w.x) < 872, 'return finishes a short descent even when forward is held immediately');
  await page.keyboard.up('ArrowRight');
  await page.keyboard.down('ArrowLeft');
  await page.waitForFunction(() => window.__kingdomOfTheFairies.S.state.w.x < 690);
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.press('Space');
  await page.waitForTimeout(180);
  assert.ok(await page.evaluate(() => window.__kingdomOfTheFairies.S.state.cheers.length > 0), 'guests still join in during credits');
  assert.ok(await page.evaluate(() => window.__kingdomOfTheFairies.S.state.creditsT) > beforeReturn);
  await page.locator('#stage').screenshot({ path: `${output}/credits-outside-dancing.png` });
  await page.waitForTimeout(700);
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__kingdomOfTheFairies.S.state.phase === 'finale');
  await page.keyboard.up('ArrowRight');
  await walkToLight();
  assert.ok(await page.evaluate(() => window.__kingdomOfTheFairies.S.state.creditsT) > beforeReturn + 5, 'a repeated light jump does not restart the credits');
  const samples = [];
  for (const time of [12, 22, 36, 50]) {
    await page.evaluate(t => { window.__kingdomOfTheFairies.S.state.creditsT = t; }, time);
    await page.waitForTimeout(180);
    const sample = await page.evaluate(() => {
      const q = window.__kingdomOfTheFairies, data = new Float32Array(window.scoreAnalyser.fftSize);
      window.scoreAnalyser.getFloatTimeDomainData(data);
      return { time: q.S.state.creditsT, music: q.audio.musicLevel(), track: q.audio.nowPlaying()?.id,
        rms: Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length),
        starts: window.scoreStarts.filter(d => d > 118 && d < 120).length, mode: q.S.mode };
    });
    assert.equal(sample.track, 'period-wedding'); assert.equal(sample.starts, 1);
    assert.equal(sample.music, 1); assert.equal(sample.mode, 'play');
    assert.ok(sample.rms > 0.0001, 'actual wedding recording remains audible');
    samples.push(sample);
  }
  await page.evaluate(() => { const q = window.__kingdomOfTheFairies; q.S.state.creditsT = 39; q.S.paused = true; });
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => window.__kingdomOfTheFairies.S.state.creditsT), 39);
  await page.evaluate(async () => {
    const { createRenderer } = await import('/src/art.js');
    const { actBurning, weddingFloor } = await import('/src/acts/act5film.js');
    await window.__kingdomOfTheFairies.assets.all;
    const canvas = document.createElement('canvas'); canvas.id = 'ending-review'; canvas.width = 1280; canvas.height = 720;
    canvas.style.cssText = 'position:fixed;inset:0;z-index:99999;width:1280px;height:720px'; document.body.append(canvas);
    window.endingReview = { canvas, createRenderer, actBurning, weddingFloor };
  });
  for (const look of ['original', 'tinted']) for (const x of [790, 820, 850, 880, 900]) {
    await page.evaluate(({ look, x }) => {
      const r = window.endingReview, st = r.actBurning.create({ from: { scene: 4 } });
      Object.assign(st, { phaseT: 8, weddingIntro: false });
      for (const [actor, px] of [[st.w,x],[st.az,x-65]]) Object.assign(actor, { x:px,y:r.weddingFloor(px),stairs:true,vx:240,walk:x });
      r.createRenderer(r.canvas, window.__kingdomOfTheFairies.assets).render({ act: r.actBurning, state: st,
        t: 8, curtain: 1, film: 'off', tinted: look === 'tinted', fade: 0 });
    }, { look, x });
    await page.locator('#ending-review').screenshot({ path: `${output}/stairs-${look}-${x}.png` });
  }
  assert.deepEqual(errors, []);
  await writeFile(`${output}/audio-and-timing.json`, JSON.stringify(samples, null, 2) + '\n');
  console.log('Two-way stairs, held/repeated light jumps, gradual release, continuous audio and credits free play pass');
} finally { await browser.close(); server.close(); }

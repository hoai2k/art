// Exercise court input and review captures/beam through the shipped renderer.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { serve, playwright } from '../../shared/test/lib.mjs';
const output = process.argv[2] || '/tmp/fairies-court-review';
await mkdir(output, { recursive: true });
const server = await serve(new URL('../', import.meta.url).pathname);
const { chromium } = await playwright();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
const evidence = [], scaleBaseline = new Map();
try {
 for (const look of ['original', 'tinted']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(server.url + '/?qa&act=4&scene=1&look=' + look);
  await page.waitForFunction(() => window.__kingdomOfTheFairies);
  await page.evaluate(async () => {
   const { loadAssets, createRenderer } = await import('/src/art.js');
   const { default: act } = await import('/src/acts/act3.js');
   const { drawPerson, personPx } = await import('/src/pose.js');
   const assets = await loadAssets('/assets/'); await assets.all;
   const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
   canvas.id = 'court-review'; canvas.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;width:1280px;height:720px'; document.body.append(canvas);
   window.courtReview = { act, assets, createRenderer, canvas, drawPerson, personPx };
  });
  // Use actual keyboard events through main.js/input.js before freezing a
  // separate canvas for deterministic visual comparisons.
  await page.evaluate(() => {
   const q = window.courtReview, { S } = window.__kingdomOfTheFairies;
   S.act = q.act; S.state = q.act.create({ from: { scene: 1 } });
   S.state.p.grace = 999; S.state.gaze.dur = 999; S.state.courtiers = [];
   S.mode = 'play'; S.card = null; S.curtain = S.curtainTarget = 1; S.paused = false;
  });
  await page.keyboard.down('x'); await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(180);
  assert.equal(await page.evaluate(() => window.__kingdomOfTheFairies.S.state.p.x),955);
  await page.keyboard.up('x'); await page.waitForTimeout(180); await page.keyboard.up('ArrowRight');
  assert.ok(await page.evaluate(() => window.__kingdomOfTheFairies.S.state.p.x > 960));
  await page.keyboard.press('Space'); await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => window.__kingdomOfTheFairies.S.state.p.row),1);
  assert.ok(await page.evaluate(() => window.__kingdomOfTheFairies.S.state.p.jumpT > 0));
  await page.evaluate(() => { window.__kingdomOfTheFairies.S.paused = true; });
  for (const film of ['off', 'gentle', 'full']) for (const extraAnimations of [false]) {   // (Extra Animations retired: stills only)
   for (const phase of ['hall', 'hall-parked', 'bow', 'hall-capture', 'court', 'human-capture', 'lobster-capture', 'jump', 'beam-left', 'beam-right', 'scale']) {
    const result = await page.evaluate(({ look, film, extraAnimations, phase }) => {
     const q = window.courtReview, r = q.createRenderer(q.canvas, q.assets), draws = [], sizes = {};
     for (const method of ['asset', 'idle']) { const original = r.kit[method]; r.kit[method] = (id,...args) => { draws.push(id); return original(id,...args); }; }
     const st = q.act.create(phase.startsWith('hall') || phase === 'bow' ? {} : { from: { scene: 1 } });
     const step = (seconds, input) => { for(let t=0;t<seconds;t+=1/60) q.act.step(st,1/60,{ beat: st.t/.784,...input }); };
     st.events.length = 0;
     if (phase === 'hall') step(2,{moveX:1});
     if (phase === 'hall-parked') {
      for(let i=0;i<1800 && !st.tf.guards.every(g=>g.mode==='parked');i++) {
       const g = st.tf.guards.find(g=>!g.passed);
       q.act.step(st,1/60,g ? Math.abs(g.x-st.tf.x)<175 && g.mode!=='wait' ? {xHeld:true} : {moveX:1} : {});
      }
      if(!st.tf.guards.every(g=>g.mode==='parked' && g.x>=240)) throw Error('guards must remain visibly onstage');
     }
     if (phase === 'bow') { step(1,{moveX:1}); step(5,{xHeld:true}); }
     if (phase === 'hall-capture') { for(let i=0;i<500&&!st.tf.capture;i++) q.act.step(st,1/60,{moveX:1}); }
     if (phase.endsWith('capture') && !phase.startsWith('hall')) {
      const type = phase.split('-')[0]; const guard = st.courtiers.find(c => c.kind === 'guard' && (c.guardType || 'human') === type);
      st.p.x = guard.x-12; st.p.row = st.p.from = guard.row; st.p.grace = 0; st.cam = st.p.x-560;
      q.act.step(st,1/60,{}); assertCapture();
      function assertCapture() { if (!st.capture) throw Error('missing actual capture '+type); }
     }
     if (phase === 'jump') q.act.step(st,1/60,{a:true});
     if (phase === 'jump') step(.18,{});
     if (phase.startsWith('beam')) Object.assign(st.gaze,{ phase:'sweep',aim:st.cam+640,from:st.cam-260,to:st.cam+1540,dir:phase==='beam-left'?1:-1,t:4,dur:8 });
     const view = { act:q.act,state:st,t:8.025,film,tinted:look==='tinted',extraAnimations,curtain:1,hud:false };
     if (phase === 'scale') view.scene = k => {
      k.c.fillStyle = k.col('#80777d'); k.c.fillRect(0,0,1280,720);
      for(const [id,x,y] of [['prince-stand',200,350],['prince-caught-human',650,350],['seahorse-guard',1000,350],['prince-stand',200,665],['prince-caught-lobster',650,665],['lobster-guard-closed',1050,665]]) {
       sizes[id] = q.personPx(k,id);
       if(id==='seahorse-guard') k.asset(id,x,y,120,230);
       else if(id==='lobster-guard-closed') k.asset(id,x,y,230,156);
       else q.drawPerson(k,id,x,y,180);
       k.c.fillStyle=k.col('#ffffff'); k.c.font='14px sans-serif';k.c.textAlign='center';k.c.fillText(id,x,y+20);
      }
     };
     r.render(view);
     return { draws, sizes, capture:st.capture?.kind||st.tf?.capture?.kind, feet:st.tf?652:undefined };
    },{look,film,extraAnimations,phase});
    if(phase.endsWith('capture')) assert.ok(result.draws.includes('prince-caught-'+result.capture), phase);
    if (phase === 'scale') {
     if (!scaleBaseline.has(look)) scaleBaseline.set(look,result.sizes);
     assert.deepEqual(result.sizes,scaleBaseline.get(look),'person calibration must match across all effects and animation settings');
    }
    if(phase==='court') assert.ok(result.draws.includes('seahorse-guard') && result.draws.includes('lobster-guard-closed'));
    const name = `${look}-${film}-${extraAnimations?'animated':'still'}-${phase}`;
    await page.locator('#court-review').screenshot({path:`${output}/${name}.png`}); evidence.push({name,...result});
   }
  }
  assert.deepEqual(errors,[]); await page.close();
 }
 await writeFile(`${output}/review.json`,JSON.stringify(evidence,null,2));
 console.log(`${evidence.length} actual renderer captures passed`);
} finally { await browser.close(); await server.close(); }

const {chromium}=require('/Users/hoai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Users/hoai/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
 const page=await browser.newPage({viewport:{width:1450,height:1000}});const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>{const u=route.request().url();if(u.startsWith('http://127.0.0.1:8765/')||u.startsWith('data:'))route.continue();else route.abort()});
 const root='http://127.0.0.1:8765/widowsbay';
 await page.goto(root+'/design/generated/anims/loops/index.html');await page.waitForFunction(()=>window.loopReview?.ready);
 await page.click('#restart');const first=await page.evaluate(()=>window.loopReview.clock);await page.waitForTimeout(700);const normal=await page.evaluate(()=>window.loopReview.clock);
 await page.selectOption('#speed','.25');const beforeSlow=await page.evaluate(()=>window.loopReview.clock);await page.waitForTimeout(800);const slow=await page.evaluate(()=>window.loopReview.clock);
 if(normal-first<.35||slow-beforeSlow>.35||slow-beforeSlow<.05)throw Error('Playback-speed control failed');
 await page.screenshot({path:'/private/tmp/widowsbay-animation-work/browser-review.png',fullPage:true});
 const cycleChecks=await page.evaluate(async()=>{
  const {animationFrame,animationDuration}=await import('/kingdomofthefairies/src/animation.js');const specs=await(await fetch('manifest.json')).json();const checks=[];
  for(const m of specs.assets){let seen=new Set();const period=animationDuration(m);for(const speed of [1,.25])for(let cycle=0;cycle<10;cycle++)for(let i=0;i<m.frames;i++){
   const wallTime=(cycle+i/m.frames+.0001)*period/speed;const f=animationFrame(m,wallTime*speed);if(f.index<0||f.index>=m.frames)throw Error('Invalid frame '+m.id);seen.add(f.index);
  }checks.push({id:m.id,framesSeen:seen.size,expected:m.frames,tenCycles:true});if(seen.size!==m.frames)throw Error('Not all frames seen '+m.id)}return checks;
 });
 await page.goto(root+'/?qa&act=2&carry=all');await page.waitForFunction(()=>window.__widowsBay);await page.waitForTimeout(1400);
 const integrated=await page.evaluate(async()=>{
  const {loadAssets,createRenderer}=await import('/kingdomofthefairies/src/art.js');const assets=await loadAssets('/kingdomofthefairies/assets/');await assets.all;
  const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;const renderer=createRenderer(canvas,assets);
  const ids=Object.keys(assets.anims);const drawn=ids.map(id=>({id,drawn:renderer.kit.anim(id,.3,400,500,300,400)}));
  if(renderer.kit.anim('missing-loop',0,0,0,10,10)!==false)throw Error('Missing-loop fallback failed');
  if(ids.length!==11||drawn.some(r=>!r.drawn))throw Error('Integrated assets missing');return {loaded:ids.length,drawn,fallback:true};
 });
 await page.screenshot({path:'/private/tmp/widowsbay-animation-work/game-smoke.png'});
 if(errors.length)throw Error(errors.join('\n'));
 const result={pageErrors:errors,normalClockDelta:normal-first,quarterClockDelta:slow-beforeSlow,cycleChecks,integrated};fs.writeFileSync('/private/tmp/widowsbay-animation-work/browser-validation.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});

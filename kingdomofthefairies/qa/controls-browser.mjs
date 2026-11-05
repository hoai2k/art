// Real pointer and keyboard events through the shell, in both editions.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { serve, playwright } from '../../shared/test/lib.mjs';
const output = process.argv[2] || '/tmp/fairies-controls-review';
await mkdir(output, { recursive: true });
const server = await serve(new URL('../', import.meta.url).pathname);
const { chromium } = await playwright();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
 for (const edition of ['off', 'on']) for (const touch of [false, true]) {
  const page = await browser.newPage({ viewport: touch ? {width:844,height:390} : {width:1280,height:720}, hasTouch:touch, isMobile:touch });
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  await page.addInitScript(()=>{
   for (const prefix of ['kingdomofthefairies','widowsbay']) localStorage.setItem(prefix+'.save.v1',JSON.stringify({v:1,unlocked:7,results:{},best:{}}));
   // Keep browser fullscreen changes out of coordinate checks.
   Element.prototype.requestFullscreen=()=>Promise.resolve();
  });
  await page.goto(server.url+'/?qa&widowsbay='+edition);
  await page.waitForFunction(()=>window.__kingdomOfTheFairies && !document.body.classList.contains('booting'));
  await page.locator('#start').click();
  await page.waitForFunction(()=>window.__kingdomOfTheFairies.S.mode==='playbill');
  await page.waitForTimeout(700);
  await page.screenshot({path:`${output}/${edition}-${touch?'touch':'mouse'}-playbill.png`});
  const rows=page.locator('#playbill-controls button');
  assert.equal(await rows.count(),edition==='off'?7:5);
  if(touch) await rows.nth(2).tap(); else await rows.nth(2).click();
  assert.equal(await page.evaluate(()=>window.__kingdomOfTheFairies.S.actIndex),2);
  await page.waitForFunction(()=>window.__kingdomOfTheFairies.S.mode==='intro');
  await page.screenshot({path:`${output}/${edition}-${touch?'touch':'mouse'}-act.png`});
  if(!touch){
   // Return through the actual pause menu, then Tab/Space on native rows.
   await page.keyboard.press('Escape');
   await page.locator('#pause [data-act=title]').click();
   await page.locator('#start').click();
   await page.waitForFunction(()=>window.__kingdomOfTheFairies.S.mode==='playbill');
   await page.waitForTimeout(700);
   await rows.first().focus(); await page.keyboard.press('Tab');
   assert.equal(await rows.nth(1).evaluate(el=>el===document.activeElement),true);
   await page.keyboard.press('Space');
   await page.waitForFunction(()=>window.__kingdomOfTheFairies.S.mode==='intro');
   assert.equal(await page.evaluate(()=>window.__kingdomOfTheFairies.S.actIndex),1);
  }
  assert.deepEqual(errors,[]); await page.close();
 }
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.url+'/?qa');
 await page.waitForFunction(()=>window.__kingdomOfTheFairies && !document.body.classList.contains('booting'));
 await page.evaluate(async()=>{
  await document.fonts.ready;
  const roundRect = CanvasRenderingContext2D.prototype.roundRect;
  CanvasRenderingContext2D.prototype.roundRect = function(x,y,w,h,...args) {
    if (y === 290 && h === 30) window.flowerPromptBox = {x,y,w,h};
    return roundRect.call(this,x,y,w,h,...args);
  };
  const {default:act}=await import('/src/acts/prologue.js');
  const q=window.__kingdomOfTheFairies;
  q.S.act=act; q.S.actIndex=0; q.S.state=act.create();
  q.S.mode='play'; q.S.curtain=q.S.curtainTarget=1;q.S.card=null;q.S.paused=false;
  q.S.state.p.x=211;
  document.querySelector('#title').hidden=true;
 });
 await page.waitForFunction(()=>window.__kingdomOfTheFairies.S.state.near?.label==='Receive the flower' && window.flowerPromptBox);
 // Measure the exact rendered uppercase text including its Space keycap.
 const measured=await page.evaluate(async()=>{
  const {measureRichText}=await import('/src/art.js');
  const c=document.createElement('canvas').getContext('2d'); c.font='700 15px "Josefin Sans", sans-serif';
  const label='[X] RECEIVE THE FLOWER';
  const text=measureRichText(c,label,{px:15,mode:'key'});
  return {text,box:window.flowerPromptBox};
 });
 assert.ok(measured.box, 'the actual gift prompt background was drawn');
 assert.ok(measured.box.w >= measured.text + 30, 'text and Space glyph fit inside the drawn background');
 await page.screenshot({path:output+'/keyboard-flower.png'});
 await page.keyboard.press('Space');
 await page.waitForFunction(()=>window.__kingdomOfTheFairies.S.state.gifts.includes('flower'));
 assert.ok(await page.evaluate(()=>window.__kingdomOfTheFairies.S.state.p.on),'receiving does not jump');
 await page.keyboard.down('KeyW');await page.waitForTimeout(100);
 assert.ok(await page.evaluate(()=>!window.__kingdomOfTheFairies.S.state.p.on),'W jumps in court');
 await page.keyboard.up('KeyW');await page.waitForTimeout(850);
 await page.keyboard.press('ArrowUp');await page.waitForTimeout(100);
 assert.ok(await page.evaluate(()=>!window.__kingdomOfTheFairies.S.state.p.on),'Up also jumps');
 await page.waitForTimeout(850);
 // Let the last gift finish, then show the next goal with its action key.
 await page.evaluate(()=>{
  const fillText=CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText=function(text,...args){
   if(['Space','X','A','↑'].includes(text)) window.lastPromptGlyph=text;
   if(text.includes('TAKE PRINCESS AZURINE')) {
    window.azurineGuideText=text; window.azurineGuideGlyph=window.lastPromptGlyph;
    window.azurineGuideAt=window.__kingdomOfTheFairies.S.state.t;
   }
   return fillText.call(this,text,...args);
  };
 });
 for (let n=1;n<4;n++) {
  await page.evaluate(async n=>{
   const {FAIRIES,HAND,FLOOR}=await import('/src/acts/prologue.js');
   const p=window.__kingdomOfTheFairies.S.state.p,f=FAIRIES[n];
   Object.assign(p,{x:f.x+f.hand-HAND,vx:0,vy:0,on:true,y:FLOOR,face:1});
  },n);
  await page.waitForTimeout(60);await page.keyboard.press('Space');
  await page.waitForFunction(n=>window.__kingdomOfTheFairies.S.state.gifts.length===n+1,n);
 }
 assert.equal(await page.evaluate(()=>window.__kingdomOfTheFairies.S.state.handGuideShown),false);
 assert.equal(await page.evaluate(()=>window.azurineGuideText),undefined,'no instruction during the final gift');
 await page.waitForFunction(()=>window.azurineGuideText);
 assert.equal(await page.evaluate(()=>window.azurineGuideGlyph),'Space');
 assert.ok(await page.evaluate(()=>window.azurineGuideAt>=window.__kingdomOfTheFairies.S.state.handGuideAt),'show only after the gift and pause');
 assert.match(await page.evaluate(()=>window.azurineGuideText),/TAKE PRINCESS AZURINE’S HAND/);
 assert.equal(await page.evaluate(()=>window.__kingdomOfTheFairies.S.state.phase),'court');
 await page.screenshot({path:output+'/keyboard-azurine-guide.png'});
 await page.keyboard.down('KeyD');
 await page.waitForFunction(()=>window.__kingdomOfTheFairies.S.state.phase==='curse');
 await page.keyboard.up('KeyD');
 assert.ok(await page.evaluate(()=>window.__kingdomOfTheFairies.S.state.betrothed),'approach alone triggers the witch');
 // Boat rows must stay independent of jumping; Space still leaps for pearls.
 await page.evaluate(async()=>{
  const {default:act}=await import('/src/acts/act2.js');
  const q=window.__kingdomOfTheFairies;q.S.act=act;q.S.actIndex=2;
  q.S.state=act.create({from:{scene:5}});q.S.mode='play';q.S.curtain=q.S.curtainTarget=1;q.S.paused=false;
 });
 await page.waitForTimeout(60);
 const boatBefore=await page.evaluate(()=>{const s=window.__kingdomOfTheFairies.S.state;return {phase:s.phase,row:s.ride?.row};});
 assert.equal(boatBefore.phase,'ride');
 await page.keyboard.press('KeyW');await page.waitForTimeout(80);
 assert.equal(await page.evaluate(()=>window.__kingdomOfTheFairies.S.state.ride.leapT),0);
 await page.waitForTimeout(500); await page.keyboard.press('Space');await page.waitForTimeout(80);
 assert.ok(await page.evaluate(()=>window.__kingdomOfTheFairies.S.state.ride.leapT>0));
 assert.deepEqual(errors,[]);await page.close();
 console.log('Mouse/touch Act selection in both editions, Tab/Space selection, Space receive, W/Up jumps, the Azurine guide/automatic entrance and independent boat rows pass');
} finally {await browser.close();server.close();}

import assert from 'node:assert/strict';
import { serve, playwright } from '../../shared/test/lib.mjs';
const server=await serve(new URL('../',import.meta.url).pathname),{chromium}=await playwright();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try {
 for(const width of [1280,660,390]) {
  const page=await browser.newPage({viewport:{width,height:800}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
   localStorage.setItem('kingdomofthefairies.save.v1',JSON.stringify({v:1,unlocked:7,results:Object.fromEntries(Array.from({length:7},(_,i)=>[i+1,{}])),best:{}}));
   window.testPad={index:0,id:'QA controller',connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
   Object.defineProperty(navigator,'getGamepads',{value:()=>[window.testPad]});
  });
  await page.goto(server.url+'/?qa');
  await page.waitForFunction(()=>window.__kingdomOfTheFairies?.assets?.all && !document.body.classList.contains('booting'));
  await page.evaluate(()=>window.__kingdomOfTheFairies.assets.all);
  await page.evaluate(()=>window.__kingdomOfTheFairies.open.scenes());
  await page.locator('#scenes').waitFor({state:'visible'});
  const grid=page.locator('.scene-grid').nth(2),buttons=grid.locator('button');
  await buttons.first().focus();
  const rects=await buttons.evaluateAll(elements=>elements.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y};}));
  const columns=rects.filter(r=>Math.abs(r.y-rects[0].y)<2).length;
  assert.ok(rects.length>columns+1,'the act spans at least two grid rows');
  const selected=()=>buttons.evaluateAll(elements=>elements.indexOf(document.activeElement));
  const stick=async direction=>{
   await page.evaluate(direction=>{window.testPad.axes[0]=direction==='left'?-1:direction==='right'?1:0;window.testPad.axes[1]=direction==='up'?-1:direction==='down'?1:0;},direction);
   await page.waitForTimeout(100);
   await page.evaluate(()=>{window.testPad.axes[0]=window.testPad.axes[1]=0;});await page.waitForTimeout(80);
  };
  await stick('down');assert.equal(await selected(),columns,'stick down selects the card below');
  await stick('up');assert.equal(await selected(),0,'stick up returns to the same column');
  if(columns>1){
   await stick('right');assert.equal(await selected(),1);
   await stick('down');assert.equal(await selected(),columns+1,'down keeps the right column');
   await stick('up');assert.equal(await selected(),1);
   await stick('left');assert.equal(await selected(),0);
  }
  await page.evaluate(()=>{window.testPad.buttons[13]={pressed:true,value:1};});await page.waitForTimeout(100);
  await page.evaluate(()=>{window.testPad.buttons[13]={pressed:false,value:0};});await page.waitForTimeout(80);
  assert.equal(await selected(),columns,'D-pad down uses the vertical neighbor');
  await page.keyboard.press('ArrowUp');await page.waitForTimeout(100);assert.equal(await selected(),0);
  await page.keyboard.press('KeyS');await page.waitForTimeout(100);assert.equal(await selected(),columns);
  await page.keyboard.press('KeyW');await page.waitForTimeout(100);assert.equal(await selected(),0);
  await buttons.last().focus();const last=await selected();
  await stick('down');assert.equal(await selected(),-1,'down from the last row reaches the next act');
  await stick('up');assert.ok(await selected()>=last-(columns-1),'up returns to the nearest card in the uneven row');
  if(columns>1){
   await buttons.nth(columns-1).focus();await stick('right');assert.equal(await selected(),columns-1,'right at the row edge does not wrap downward');
  }
  await page.locator('.scene-grid button').first().focus();await stick('up');
  assert.ok(await page.evaluate(()=>document.activeElement.matches('#scenes .card-x')),'close remains reachable above the first scene row');
  assert.deepEqual(errors,[]);console.log(`${width}px (${columns} columns): stick, D-pad, keyboard and act-boundary navigation pass`);
  await page.close();
 }
}finally{await browser.close();server.close();}

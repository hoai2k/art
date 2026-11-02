// Audit real dialog geometry and focus/overflow styles in every edition.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { serve, playwright } from '../../shared/test/lib.mjs';
const output = process.argv[2] || '/tmp/fairies-dialog-review';
await mkdir(output, { recursive: true });
const server = await serve(new URL('../', import.meta.url).pathname);
const { chromium } = await playwright();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
const evidence = [];
try {
 for (const edition of ['off', 'on']) {
  const page = await browser.newPage({viewport:{width:1280,height:720}}), errors=[];
  page.on('pageerror', e=>errors.push(e.message));
  await page.goto(`${server.url}/?qa&edit=local&widowsbay=${edition}`);
  await page.waitForFunction(()=>window.__kingdomOfTheFairies && !document.body.classList.contains('booting'));
  await page.evaluate(()=>document.fonts.ready);
  await page.locator('.unlock-editor[open] .card-x').click();
  for (const size of [{width:1280,height:720},{width:800,height:360},{width:640,height:320},{width:390,height:844},{width:320,height:568},{width:320,height:480}]) {
   await page.setViewportSize(size);
   await page.evaluate(()=>window.__kingdomOfTheFairies.open.credits());
   await page.waitForTimeout(60);
   const credit = await page.evaluate(()=>{
    const card=document.querySelector('#credits .card'), r=card.getBoundingClientRect();
    const texts=[...card.querySelectorAll('h2,.cred-show,dt,dd')].filter(e=>e.checkVisibility());
    return {active:document.activeElement.className, card:{x:r.x,y:r.y,right:r.right,bottom:r.bottom},
     overflow:[...card.querySelectorAll('*'),card].filter(e=>e.clientHeight && e.scrollHeight>e.clientHeight+1 && getComputedStyle(e).overflowY !== 'visible').map(e=>({class:e.className,client:e.clientHeight,scroll:e.scrollHeight})),
     clipped:texts.filter(e=>{const b=e.getBoundingClientRect();return b.top<r.top+8||b.bottom>r.bottom-8||b.left<r.left+8||b.right>r.right-8;}).map(e=>e.textContent),
     focusableBody:document.querySelector('.credits-list').hasAttribute('tabindex')};
   });
   await page.locator('#credits').screenshot({path:`${output}/${edition}-${size.width}x${size.height}-credits.png`});
   assert.ok(credit.active.includes('card-x'),'focus the close action, not static credits');
   assert.equal(credit.focusableBody,false);
   assert.deepEqual(credit.overflow,[],`${edition}/${size.width}×${size.height}: credits need no scrolling`);
   assert.deepEqual(credit.clipped,[],`${edition}/${size.width}×${size.height}: every credit must fit`);
   assert.ok(credit.card.y>=0 && credit.card.bottom<=size.height);
   await page.locator('#credits .card-x').click();
   evidence.push({edition,size,credit});
  }
  await page.setViewportSize({width:800,height:360});
  for (const [button,selector] of [['instructions','#ins-scroll'],['scenes','#scene-list'],['#btn-settings','#settings .stack']]) {
   if (button.startsWith('#')) await page.locator(button).click(); else await page.evaluate(b=>window.__kingdomOfTheFairies.open[b](),button);
   const styles=await page.locator(selector).evaluate(el=>{
    const c=getComputedStyle(el);return {color:c.scrollbarColor,width:c.scrollbarWidth,overflow:c.overflowY,canScroll:el.scrollHeight>el.clientHeight};
   });
   assert.equal(styles.color,'rgb(217, 179, 74) rgb(42, 20, 36)');assert.equal(styles.width,'thin');
   assert.equal(styles.overflow,'auto');
   if(selector==='#ins-scroll') {
    await page.keyboard.press('Tab'); await page.locator(selector).focus();
    const cue=await page.locator(selector).evaluate(el=>{const c=getComputedStyle(el);return{outline:c.outlineStyle,shadow:c.boxShadow};});
    assert.equal(cue.outline,'none');assert.ok(cue.shadow.includes('217, 179, 74'));
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(150);assert.ok(await page.locator(selector).evaluate(el=>el.scrollTop>0),'instructions still scroll with the keyboard');
   }
   // Inspect every visible outline in the active dialog. Magenta control
   // borders are intentional; large content-container outlines are not.
   const red=await page.evaluate(()=>[...document.querySelectorAll('.dialog:not([hidden]) *')].filter(e=>e.checkVisibility()).filter(e=>{
    const c=getComputedStyle(e);return c.outlineStyle!=='none'&&parseFloat(c.outlineWidth)>0&&['rgb(224, 18, 122)','rgb(255, 0, 0)','rgb(255, 0, 85)'].includes(c.outlineColor);
   }).map(e=>e.className));
   assert.deepEqual(red,[]);
   await page.locator('.dialog:not([hidden])').screenshot({path:`${output}/${edition}-${selector.replaceAll(/[^a-z]/g,'')}.png`});
   await page.locator('.dialog:not([hidden]) .card-x').click();
   evidence.push({edition,selector,styles});
  }
  await page.locator('.unlock-btn').click();
  assert.equal(await page.locator('.unlock-editor[open]').evaluate(el=>getComputedStyle(el).scrollbarColor),'rgb(217, 179, 74) rgb(42, 20, 36)');
  await page.locator('.unlock-editor[open] .card-x').click();
  assert.deepEqual(errors,[]);await page.close();
 }
 // Coarse-pointer rules have their own close-button and compact-card sizes.
 for (const edition of ['off','on']) for (const size of [{width:640,height:320},{width:844,height:390}]) {
  const page=await browser.newPage({viewport:size,hasTouch:true,isMobile:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${server.url}/?qa&widowsbay=${edition}`);
  await page.waitForFunction(()=>window.__kingdomOfTheFairies && !document.body.classList.contains('booting'));
  await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>window.__kingdomOfTheFairies.open.credits());
  const mobile=await page.locator('#credits .card').evaluate(card=>{
   const r=card.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:innerHeight,
    clipped:[...card.querySelectorAll('h2,.cred-show,dt,dd')].filter(e=>e.checkVisibility()).filter(e=>{const b=e.getBoundingClientRect();return b.bottom>r.bottom-8||b.top<r.top+8;}).map(e=>e.textContent),
    overflow:card.scrollHeight>card.clientHeight+1};
  });
  assert.deepEqual(mobile.clipped,[]);assert.equal(mobile.overflow,false);assert.ok(mobile.top>=0&&mobile.bottom<=mobile.height);
  await page.locator('#credits').screenshot({path:`${output}/${edition}-${size.width}x${size.height}-touch-credits.png`});
  await page.locator('#credits .card-x').click();assert.deepEqual(errors,[]);
  evidence.push({edition,size,mobile});await page.close();
 }
 await writeFile(`${output}/review.json`,JSON.stringify(evidence,null,2));
 console.log('Credits fit without scrolling at 6 viewport sizes in both editions plus 4 phone configurations; themed scrollbars, focus cues, keyboard scrolling and dialog navigation pass');
} finally {await browser.close();await server.close();}

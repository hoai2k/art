import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { serve, playwright } from '../../shared/test/lib.mjs';
const out = process.argv[2] || '/tmp/fairies-celebration-review';
await mkdir(out, { recursive: true });
const server = await serve(new URL('../', import.meta.url).pathname);
const { chromium } = await playwright();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox','--autoplay-policy=no-user-gesture-required'] });
const evidence = [];
try {
 const page = await browser.newPage({viewport:{width:1280,height:720}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.audioStarts=[];
  const start=AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start=function(...args){window.audioStarts.push(this.buffer?.duration);if(this.buffer?.duration>6.9&&this.buffer?.duration<7.1){window.victoryRate=this.playbackRate.value;this.addEventListener('ended',()=>window.victoryEnded=true);}return start.apply(this,args);};
 });
 await page.goto(server.url+'/?qa&act=7&scene=3');
 await page.waitForFunction(()=>window.__kingdomOfTheFairies?.assets?.sfx);
 await page.locator('#start').evaluate(b=>b.click());
 await page.waitForFunction(()=>{const q=window.__kingdomOfTheFairies;return q.audio.sfxLoaded()>=Object.values(q.assets.sfx).filter(s=>s.status==='delivered'&&s.file).length;});
 await page.evaluate(()=>window.__kingdomOfTheFairies.assets.all);
 const sizes=await page.evaluate(async()=>{
  const {PERSON}=await import('/src/person-size.js'),images=window.__kingdomOfTheFairies.assets.images;
  const result=[];
  for(const look of ['','-tinted'])for(const pose of ['stand','jump']){
   const id='azurine-'+pose+look,im=images[id],c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;
   const x=c.getContext('2d');x.drawImage(im,0,0);const data=x.getImageData(0,0,c.width,c.height).data;let top=c.height,bottom=0;
   for(let y=0;y<c.height;y++)for(let col=0;col<c.width;col++)if(data[(y*c.width+col)*4+3]>40){top=Math.min(top,y);bottom=Math.max(bottom,y);}
   result.push({id,paintedHeight:(bottom-top+1)*160/PERSON[id].px});
  }
  return result;
 });
 for(const size of sizes)assert.ok(Math.abs(size.paintedHeight-160)<0.5,`${size.id} keeps its standing painted height`);
 await page.evaluate(async()=>{
  const q=window.__kingdomOfTheFairies;await q.assets.all;
  const mod=await import('/src/acts/act5film.js');window.celebration=mod;
  const st=mod.actBurning.create({from:{scene:3, introDone: true}});st.duel=null;
  st.barrel={x:mod.BARREL.edge,rot:0,fallT:mod.FILM_T.barrelFall-0.001};
  Object.assign(q.S,{act:mod.actBurning,state:st,mode:'play',card:null,curtain:1,curtainTarget:1,paused:false});
 });
 await page.waitForFunction(()=>window.__kingdomOfTheFairies.S.state.phase==='victory');
 await page.waitForFunction(()=>window.audioStarts.some(d=>d>6.9&&d<7.1));
 await page.waitForTimeout(300);
 assert.equal(await page.evaluate(()=>window.__kingdomOfTheFairies.audio.musicLevel()),0);
 assert.equal(await page.evaluate(()=>window.__kingdomOfTheFairies.S.state.phase),'victory');
 await page.locator('#stage').screenshot({path:out+'/victory-hold.png'});
 assert.equal(await page.evaluate(()=>window.victoryRate),1);
 await page.waitForFunction(()=>{const q=window.__kingdomOfTheFairies;return q.S.state.phaseT>=window.celebration.FILM_T.victory+0.6;});
 assert.equal(await page.evaluate(()=>window.__kingdomOfTheFairies.S.state.phase),'victory');
 assert.equal(await page.evaluate(()=>!!window.victoryEnded),false,'screen fades while the recorded chord is decaying');
 await page.locator('#stage').screenshot({path:out+'/victory-fade.png'});
 await page.waitForFunction(()=>window.__kingdomOfTheFairies.S.state.phase==='wedding');
 await page.waitForFunction(()=>window.__kingdomOfTheFairies.audio.nowPlaying()?.id==='period-wedding');
 assert.equal(await page.evaluate(()=>{const q=window.__kingdomOfTheFairies;return q.S.act.fade(q.S.state);}),1,'the wedding recording begins while the screen is still black');
 await page.waitForTimeout(4100);
 assert.equal(await page.evaluate(()=>window.audioStarts.filter(d=>d>6.9&&d<7.1).length),1);
 for(const look of ['original','tinted']){
  await page.evaluate(({look})=>{
   const q=window.__kingdomOfTheFairies;
   const st=window.celebration.actBurning.create({carry:{sleepers:4},from:{scene:4}});
   st.phaseT=5;st.weddingMusicStarted=true;q.S.state=st;
   q.settings.cast=look;
   // The renderer review below explicitly selects each look as well.
  },{look});
  await page.keyboard.down('Space');await page.waitForTimeout(180);
  const jump=await page.evaluate(()=>{const st=window.__kingdomOfTheFairies.S.state;return {w:{y:st.w.y,on:st.w.on},az:{y:st.az.y,on:st.az.on},wave:st.cheers[0]};});
  assert.equal(jump.w.on,false);assert.equal(jump.az.on,false);assert.ok(Math.abs(jump.w.y-jump.az.y)<0.01);
  await page.locator('#stage').screenshot({path:out+`/wedding-jump-${look}.png`});
  await page.keyboard.up('Space');
  evidence.push({look,...jump});
  await page.waitForTimeout(900);
 }
 await page.keyboard.down('ArrowRight');
 await page.waitForFunction(()=>window.__kingdomOfTheFairies.S.state.phase==='apotheosis', {timeout:15000});
 await page.keyboard.up('ArrowRight');
 await page.keyboard.down('ArrowRight');await page.waitForTimeout(1500);await page.keyboard.up('ArrowRight');
 await page.keyboard.down('ArrowLeft');await page.waitForTimeout(800);await page.keyboard.up('ArrowLeft');
 assert.equal(await page.evaluate(()=>window.__kingdomOfTheFairies.S.state.riseT),null);
 await page.evaluate(()=>{const st=window.__kingdomOfTheFairies.S.state;st.w.x=640;st.w.vx=0;});
 await page.waitForTimeout(350);
 assert.equal(await page.evaluate(()=>window.__kingdomOfTheFairies.S.state.riseT),null);
 await page.locator('#stage').screenshot({path:out+'/jump-into-light-prompt.png'});
 await page.keyboard.press('KeyW');
 await page.waitForFunction(()=>window.__kingdomOfTheFairies.S.state.riseT!=null);
 await page.waitForFunction(()=>window.__kingdomOfTheFairies.S.state.phase==='finale');
 // Start directly at the wedding with an intentionally delayed recording.
 // The black lead must begin at playback, rather than expire during loading.
 const slow = await browser.newPage({viewport:{width:1280,height:720}});
 slow.on('pageerror',e=>errors.push(e.message));
 await slow.route('**/assets/audio/period-wedding.mp3',async route=>{await new Promise(resolve=>setTimeout(resolve,1800));await route.continue();});
 await slow.goto(server.url+'/?qa&act=7&scene=4');
 await slow.waitForFunction(()=>window.__kingdomOfTheFairies?.assets?.sfx && !document.body.classList.contains('booting'));
 await slow.locator('#start').evaluate(b=>b.click());
 await slow.waitForTimeout(300);
 assert.equal(await slow.evaluate(()=>window.__kingdomOfTheFairies.S.mode),'intro');
 const visibleIntro=await slow.locator('#stage').evaluate(canvas=>{const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;for(let i=0;i<data.length;i+=4)if(data[i]+data[i+1]+data[i+2]>90)return true;return false;});
 assert.equal(visibleIntro,true,'the wedding checkpoint intertitle is not hidden by the scene fade');
 await slow.evaluate(()=>{Object.assign(window.__kingdomOfTheFairies.S,{mode:'play',card:null,curtain:1,curtainTarget:1,paused:false});});
 await slow.waitForFunction(()=>window.__kingdomOfTheFairies.audio.periodStates().includes('period-wedding:loading'));
 await slow.waitForTimeout(350);
 const waiting=await slow.evaluate(()=>{const q=window.__kingdomOfTheFairies;return {time:q.S.state.phaseT,fade:q.S.act.fade(q.S.state),track:q.audio.nowPlaying()?.id};});
 assert.ok(waiting.time<0.1);assert.equal(waiting.fade,1);assert.notEqual(waiting.track,'period-wedding');
 await slow.waitForFunction(()=>window.__kingdomOfTheFairies.audio.nowPlaying()?.id==='period-wedding');
 await slow.waitForTimeout(400);
 const prelude=await slow.evaluate(()=>{const q=window.__kingdomOfTheFairies;return {time:q.S.state.phaseT,fade:q.S.act.fade(q.S.state),track:q.audio.nowPlaying()?.id};});
 assert.equal(prelude.track,'period-wedding');assert.equal(prelude.fade,1);assert.ok(prelude.time>0.2&&prelude.time<1.2);
 evidence.push({waiting,prelude,sizes});await slow.close();
 const phone = await browser.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
 phone.on('pageerror',e=>errors.push(e.message));
 await phone.goto(server.url+'/?qa&act=7&scene=4');
 await phone.waitForFunction(()=>window.__kingdomOfTheFairies?.assets?.sfx);
 await phone.locator('#start').evaluate(b=>b.click());
 await phone.evaluate(async()=>{
  const q=window.__kingdomOfTheFairies;await q.assets.all;
  const {actBurning}=await import('/src/acts/act5film.js');
  Object.assign(q.S,{act:actBurning,state:actBurning.create({carry:{sleepers:4},from:{scene:4}}),mode:'play',card:null,curtain:1,curtainTarget:1,paused:false});
  q.S.state.phaseT=5;q.S.state.weddingMusicStarted=true;
 });
 await phone.locator('[data-t="a"]').waitFor({state:'visible'});
 await phone.locator('[data-t="a"]').tap();
 await phone.waitForFunction(()=>!window.__kingdomOfTheFairies.S.state.w.on);
 assert.equal(await phone.evaluate(()=>window.__kingdomOfTheFairies.S.state.az.on),false);
 await phone.locator('#stage').screenshot({path:out+'/phone-wedding-jump.png'});
 await phone.close();
 assert.deepEqual(errors,[]);
 await writeFile(out+'/review.json',JSON.stringify(evidence,null,2)+'\n');
 console.log('Victory hold, single real stinger, fade, wedding score, coupled jumping, guest waves and deliberate final jump pass');
} finally {await browser.close();await server.close();}

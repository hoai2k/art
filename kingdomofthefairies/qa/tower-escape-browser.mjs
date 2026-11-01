import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {serve,playwright} from '../../shared/test/lib.mjs';
const out=process.argv[2]||'/tmp/fairies-tower-escape-review';await mkdir(out,{recursive:true});
const server=await serve(new URL('../',import.meta.url).pathname),{chromium}=await playwright();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.url+'/?qa');await page.waitForFunction(()=>window.__kingdomOfTheFairies?.assets?.all);
 await page.evaluate(()=>window.__kingdomOfTheFairies.assets.all);
 await page.evaluate(async()=>{
  const {createRenderer}=await import('/src/art.js'),mod=await import('/src/acts/act5film.js');
  const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;canvas.id='escape-review';canvas.style.cssText='position:fixed;inset:0;z-index:99999;width:1280px;height:720px';document.body.append(canvas);
  window.escapeReview={canvas,createRenderer,mod};
 });
 const samples=[];
 for(const tinted of [false,true])for(const stage of ['before','fading','clear']){
  const sample=await page.evaluate(({tinted,stage})=>{
   const r=window.escapeReview,act=r.mod.actBurning,st=act.create({from:{scene:stage==='before'?0:1}});
   st.phaseT=10;
   if(stage==='fading'){st.escapeT=3;st.p.y=452;st.p.f=1;}
   if(stage==='clear'){st.escapeT=5;st.p.y=626;st.p.f=0;st.p.x=876;st.p.face=1;}
   const renderer=r.createRenderer(r.canvas,window.__kingdomOfTheFairies.assets),draw=renderer.kit.asset,fire=[],door=[];let teal=0;
   renderer.kit.asset=(id,...args)=>{
    if(id==='flame-flat')fire.push({x:args[0],alpha:renderer.kit.c.globalAlpha,height:args[3]});
    if(id==='tower-escape-door')door.push(args[0]);if(id==='demon-teal')teal++;
    return draw(id,...args);
   };
   renderer.render({act,state:st,t:3,curtain:1,film:'off',tinted});
   return{tinted,stage,level:r.mod.towerEscapeFire(st),left:fire.filter(f=>f.x<400),right:fire.filter(f=>f.x>900),door,teal};
  },{tinted,stage});
  assert.ok(sample.door.every(x=>x>880)&&sample.door.length>0,'painted escape door is on the right');assert.ok(sample.left.length>0,'left fire stays active');
  if(stage==='clear'){assert.equal(sample.level,0);assert.deepEqual(sample.right,[]);assert.equal(sample.teal,0);}
  else{assert.ok(sample.right.length>0);if(stage==='fading')assert.ok(sample.right.every(f=>f.alpha>0&&f.alpha<1));}
  samples.push(sample);await page.locator('#escape-review').screenshot({path:out+`/${tinted?'tinted':'original'}-${stage}.png`});
 }
 await page.evaluate(()=>{
  document.querySelector('#escape-review').remove();const q=window.__kingdomOfTheFairies,act=window.escapeReview.mod.actBurning;
  const st=act.create({from:{scene:0}});st.p.x=830;st.p.f=2;st.p.y=278;st.haz=[];st.nextHaz=999;
  Object.assign(q.S,{act,state:st,mode:'play',card:null,paused:false,curtain:1,curtainTarget:1});
 });
 await page.waitForFunction(()=>window.__kingdomOfTheFairies.S.state.p.carry);
 await page.waitForTimeout(1000);
 assert.ok(await page.evaluate(()=>{const r=window.escapeReview,q=window.__kingdomOfTheFairies;return r.mod.towerEscapeFire(q.S.state)<1;}));
 await page.waitForFunction(()=>window.__kingdomOfTheFairies.S.state.p.liftT<=0);
 await page.keyboard.down('ArrowLeft');await page.waitForFunction(()=>window.__kingdomOfTheFairies.S.state.p.x<733);await page.keyboard.up('ArrowLeft');
 await page.keyboard.down('ArrowDown');await page.waitForFunction(()=>window.__kingdomOfTheFairies.S.state.p.f===1);await page.keyboard.up('ArrowDown');
 await page.keyboard.down('ArrowRight');await page.waitForFunction(()=>window.__kingdomOfTheFairies.S.state.p.conn?.c.id==='slope');await page.keyboard.up('ArrowRight');
 await page.keyboard.down('ArrowDown');await page.waitForFunction(()=>window.__kingdomOfTheFairies.S.state.p.f===0);await page.keyboard.up('ArrowDown');
 assert.equal(await page.evaluate(()=>window.escapeReview.mod.towerEscapeFire(window.__kingdomOfTheFairies.S.state)),0);
 await page.locator('#stage').screenshot({path:out+'/actual-ground-clear.png'});
 await page.keyboard.down('ArrowLeft');await page.waitForTimeout(400);await page.keyboard.up('ArrowLeft');
 assert.equal(await page.evaluate(()=>window.__kingdomOfTheFairies.S.state.phase),'house');
 await page.keyboard.down('ArrowRight');await page.waitForFunction(()=>window.__kingdomOfTheFairies.S.state.phase==='quay');await page.keyboard.up('ArrowRight');
 assert.equal(await page.evaluate(()=>window.__kingdomOfTheFairies.S.state.p.face),1);assert.deepEqual(errors,[]);
 await writeFile(out+'/checks.json',JSON.stringify(samples,null,2)+'\n');console.log('Right-side painted exit, gradual fire clearance, and actual pickup/ladder/slope/right-door traversal pass');
}finally{await browser.close();server.close();}

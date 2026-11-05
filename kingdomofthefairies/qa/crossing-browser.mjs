import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {serve,playwright} from '../../shared/test/lib.mjs';
const out=process.argv[2]||'/tmp/fairies-crossing-review';await mkdir(out,{recursive:true});
const server=await serve(new URL('../',import.meta.url).pathname),{chromium}=await playwright();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try {
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.url+'/?qa');
 await page.waitForFunction(()=>window.__kingdomOfTheFairies&&!document.body.classList.contains('booting'));
 await page.evaluate(async()=>{
  const q=window.__kingdomOfTheFairies;await q.assets.all;await document.fonts.ready;
  const {createRenderer}=await import('/src/art.js'),{default:act}=await import('/src/acts/act1.js');
  const {TUNING}=await import('/src/board.js');
  const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
  canvas.id='crossing-review';canvas.style.cssText='position:fixed;inset:0;z-index:99999;width:1280px;height:720px';document.body.append(canvas);
  const renderer=createRenderer(canvas,q.assets),asset=renderer.kit.asset;
  window.crossing={act,canvas,renderer,TUNING,witches:[],halves:[]};
  renderer.kit.asset=(id,x,y,w,h,...rest)=>{
   if(id==='witch-storm')window.crossing.witches.push({x,y,w,h});
   if(id==='ship-wreck-bow'||id==='ship-wreck-stern'){
    const m=renderer.kit.c.getTransform();window.crossing.halves.push({id,x:m.a*x+m.c*y+m.e,flipped:m.a<0});
   }
   return asset(id,x,y,w,h,...rest);
  };
 });
 const evidence=[];
 for(const tinted of [false,true]){
  // A witch left onscreen by an earlier voyage warning must not leak into the party.
  const hidden=await page.evaluate(tinted=>{
   const q=window.crossing,st=q.act.create({seed:5,from:{scene:4}});
   st.phaseT=3;st.board.wind.warn=1;
   const view={act:q.act,state:st,curtain:1,film:'off',tinted,t:3};
   for(let n=0;n<100;n++)q.renderer.tick(.05,view);
   q.witches=[];q.renderer.render(view);
   const a=q.canvas.getContext('2d').getImageData(0,0,1280,720).data;
   q.renderer.clearFx();q.renderer.render(view);
   const b=q.canvas.getContext('2d').getImageData(0,0,1280,720).data;
   return {witches:q.witches,difference:a.reduce((n,v,i)=>n+(v!==b[i]),0)};
  },tinted);
  assert.deepEqual(hidden.witches,[],'no storm witch during the celebration');
  assert.equal(hidden.difference,0,'cached voyage witch stays hidden during the celebration');
  for(const [phase,time] of [['party',.8],['party',5.9],['turn',0],['turn',.4],['turn',.8],['turn',1.3]]){
   const sample=await page.evaluate(({phase,time,tinted})=>{
    const q=window.crossing,st=q.act.create({seed:5,from:{scene:4}});st.phase=phase;st.phaseT=time;st.party.lit=4;
    q.witches=[];q.renderer.render({act:q.act,state:st,curtain:1,film:'off',tinted,t:10+time});
    return {phase,time,tinted,witches:q.witches};
   },{phase,time,tinted});
   if(phase==='party')assert.deepEqual(sample.witches,[]);
   else {
    assert.ok(sample.witches.length>0);
    if(time===0)assert.ok(sample.witches.every(w=>w.x-w.w/2>1280),'entrance begins fully offscreen');
    if(time===.4)assert.ok(sample.witches.every(w=>w.x>640&&w.x<1480),'sweeps toward the deck');
    if(time===.8)assert.ok(sample.witches.every(w=>Math.abs(w.x-640)<20),'reaches centre before the strike');
   }
   await page.locator('#crossing-review').screenshot({path:`${out}/${tinted?'tinted':'original'}-${phase}-${time}.png`});
   evidence.push(sample);
  }
  for(const time of [2.2,2.6,3]){
   const halves=await page.evaluate(({time,tinted})=>{
    const q=window.crossing,st=q.act.create({seed:5,from:{scene:5}});st.phase='wreck';st.phaseT=time;
    q.halves=[];q.renderer.render({act:q.act,state:st,curtain:1,film:'off',tinted,t:20});return q.halves;
   },{time,tinted});
   const stern=halves.filter(h=>h.id==='ship-wreck-stern'),bow=halves.filter(h=>h.id==='ship-wreck-bow');
   assert.ok(stern.length&&bow.length,'both delivered halves are drawn');
   assert.ok(stern.every(s=>bow.every(b=>s.x<b.x)),'stern left and bow right put the broken edges in the middle');
   assert.ok(halves.every(h=>!h.flipped),'swap the sprites without mirroring their artwork');
   await page.locator('#crossing-review').screenshot({path:`${out}/${tinted?'tinted':'original'}-wreck-${time}.png`});
  }
  for(const row of [0,1,2]) for(const side of ['back','forward']){
   await page.evaluate(({row,side,tinted})=>{
    const q=window.crossing,st=q.act.create({seed:5});
    Object.assign(st.board.ship,{row,rowFrom:row,x:side==='back'?q.TUNING.shipMin:q.TUNING.shipMax});
    st.board.progress=.4;st.board.hazards=[];st.board.pickups=[];
    q.renderer.clearFx();q.renderer.render({act:q.act,state:st,curtain:1,film:'off',tinted,t:20});
   },{row,side,tinted});
   await page.locator('#crossing-review').screenshot({path:`${out}/${tinted?'tinted':'original'}-reach-${row}-${side}.png`});
  }
  for(const progress of [.97,.985,.995,1]){
   await page.evaluate(({progress,tinted})=>{
    const q=window.crossing,st=q.act.create({seed:5});st.board.progress=progress;st.board.hazards=[];st.board.pickups=[];
    q.renderer.clearFx();q.renderer.render({act:q.act,state:st,curtain:1,film:'off',tinted,t:20});
   },{progress,tinted});
   await page.locator('#crossing-review').screenshot({path:`${out}/${tinted?'tinted':'original'}-approach-${progress}.png`});
  }
 }
 assert.deepEqual(errors,[]);await writeFile(out+'/checks.json',JSON.stringify(evidence,null,2)+'\n');
 console.log('Both looks: no witch throughout celebration, no cached voyage witch, entrance fully offscreen and continuous sweep to centre before striking; lighthouse approach captures complete');
}finally{await browser.close();server.close();}

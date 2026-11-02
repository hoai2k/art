import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { serve, playwright } from '../../shared/test/lib.mjs';
const out=process.argv[2]||'/tmp/fairies-coast-review';await mkdir(out,{recursive:true});
const server=await serve(new URL('../',import.meta.url).pathname),{chromium}=await playwright();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try {
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.url+'/?qa&act=6&scene=1');
 await page.waitForFunction(()=>window.__kingdomOfTheFairies?.assets?.all);await page.evaluate(()=>window.__kingdomOfTheFairies.assets.all);
 const audit=await page.evaluate(async()=>{
  const q=window.__kingdomOfTheFairies,{ACTS}=await import('/src/acts/index.js'),{createRenderer}=await import('/src/art.js');
  const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;canvas.id='review';canvas.style.cssText='position:fixed;inset:0;z-index:99999;width:1280px;height:720px';document.body.append(canvas);
  const renderer=createRenderer(canvas,q.assets),missing=[],drawn=new Set();let context='',frames=0;
  for(const method of ['asset','assetCrop','idle']){
   const draw=renderer.kit[method];renderer.kit[method]=(...args)=>{const ok=draw(...args);if(!ok)missing.push({context,method,id:args[0]});else drawn.add(args[0]);return ok;};
  }
  for(const act of ACTS)for(let scene=0;scene<act.scenes.length;scene++)for(const tinted of [false,true]){
   const st=act.create({carry:{tea:3,pearl:true,stone:true,sleepers:4},from:{scene}});
   for(let n=0;n<3;n++){
    context=`${act.key||act.id}/${scene}/${tinted?'tinted':'original'}/${n}`;
    renderer.render({act,state:st,t:n*3,curtain:1,film:'off',tinted});frames++;
    for(let i=0;i<120;i++)act.step(st,1/60,{beat:i/30,moveX:.3});
   }
  }
  window.coastReview={canvas,renderer,act:(await import('/src/acts/act5film.js')).actTower,mod:await import('/src/acts/act5film.js')};
  return {frames,drawn:drawn.size,missing,requested:Object.entries(q.assets.slots).filter(([,s])=>s.status!=='delivered').map(([id])=>id),failedLoads:Object.keys(q.assets.slots).filter(id=>q.assets.slots[id].status==='delivered'&&!q.assets.images[id])};
 });
 await writeFile(out+'/artwork-audit.json',JSON.stringify(audit,null,2)+'\n');
 console.log(JSON.stringify({frames:audit.frames,drawn:audit.drawn,missing:audit.missing.length,requested:audit.requested.length,failedLoads:audit.failedLoads.length}));
 // art requested and not yet delivered (the game draws its stand-in meanwhile)
 const OPEN=['prince-swim-surface-a','prince-swim-surface-a-tinted','prince-swim-surface-b','prince-swim-surface-b-tinted'];
 assert.deepEqual(audit.requested.filter(id=>!OPEN.includes(id)),[]);assert.deepEqual(audit.failedLoads,[]);assert.deepEqual(audit.missing,[]);
 for(const look of ['original','tinted'])for(const phase of ['cliff','dive','swim-start','swim-middle','swim-far','swim-shore']){
  await page.evaluate(({look,phase})=>{
   const r=window.coastReview,st=r.act.create({carry:{tea:3},from:{scene:phase==='cliff'?0:2}});
   if(phase==='cliff')st.rocks=[{x:670,y:null,wait:.4,warn:1,omen:true,spin:1}];
   else if(phase==='dive'){st.phase='dive';st.w={x:320,y:r.mod.diveFloor(320),vx:240,vy:0,on:true,face:1,walk:90};st.dv=null;}
   else {st.sw.x=phase==='swim-start'?0:phase==='swim-middle'?1200:2400;if(phase==='swim-shore')st.sw.arrivalT=.95;}
   r.renderer.render({act:r.act,state:st,t:3,curtain:1,film:'off',tinted:look==='tinted'});
  },{look,phase});
  await page.locator('#review').screenshot({path:out+`/${phase}-${look}.png`});
 }
 await page.evaluate(()=>document.querySelector('#review').remove());
 // Run real keyboard movement through the automatic dive and crossing.
 await page.evaluate(()=>{
  const q=window.__kingdomOfTheFairies,r=window.coastReview,st=r.act.create({from:{scene:2}});
  st.phase='dive';st.w={x:r.mod.DIVE.start,y:r.mod.diveFloor(r.mod.DIVE.start),vx:0,vy:0,on:true,face:1,walk:0};st.dv=null;
  Object.assign(q.S,{act:r.act,state:st,mode:'play',card:null,paused:false,curtain:1,curtainTarget:1});
 });
 await page.keyboard.down('ArrowRight');
 await page.waitForFunction(()=>window.__kingdomOfTheFairies.S.state.phase==='swim');
 await page.waitForFunction(()=>window.__kingdomOfTheFairies.S.state.sw.arrivalT!=null);
 await page.waitForTimeout(900);assert.equal(await page.evaluate(()=>window.__kingdomOfTheFairies.S.state.phase),'swim');
 await page.waitForFunction(()=>window.__kingdomOfTheFairies.S.state.phase==='tower');await page.keyboard.up('ArrowRight');
 const failedPage=await browser.newPage({viewport:{width:1280,height:720}});
 await failedPage.route('**/assets/coast-gap.webp',route=>route.abort());
 await failedPage.goto(server.url+'/?qa&act=6&scene=1');
 await failedPage.waitForFunction(()=>window.__kingdomOfTheFairies?.assets?.all);
 await failedPage.evaluate(()=>window.__kingdomOfTheFairies.assets.all);
 await failedPage.locator('#start').evaluate(b=>b.click());
 await failedPage.waitForFunction(()=>window.__kingdomOfTheFairies.S.card?.error);
 assert.equal(await failedPage.evaluate(()=>window.__kingdomOfTheFairies.S.mode),'intro','failed artwork cannot fall through to procedural gameplay');
 await failedPage.close();
 assert.deepEqual(errors,[]);console.log('Coast route, natural rockfall and full film artwork audit passed');
}finally{await browser.close();server.close();}

import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { serve, playwright } from '../../shared/test/lib.mjs';
const out=process.argv[2]||'/tmp/fairies-barrel-review';await mkdir(out,{recursive:true});
const server=await serve(new URL('../',import.meta.url).pathname);
const {chromium}=await playwright();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.url+'/?qa&act=7&scene=3');
 await page.waitForFunction(()=>window.__kingdomOfTheFairies?.assets?.sfx);
 await page.evaluate(async()=>{
  const q=window.__kingdomOfTheFairies;await q.assets.all;
  const mod=await import('/src/acts/act5film.js');const {createRenderer}=await import('/src/art.js');
  const canvas=document.createElement('canvas');canvas.id='barrel-review';canvas.width=1280;canvas.height=720;
  canvas.style.cssText='position:fixed;inset:0;z-index:99999;width:1280px;height:720px';document.body.append(canvas);
  window.barrelReview={mod,createRenderer,canvas};
 });
 const evidence=[];
 for(const look of ['original','tinted'])for(const pose of ['a','b']){
  const sample=await page.evaluate(({look,pose})=>{
   const {mod,canvas,createRenderer}=window.barrelReview;
   const st=mod.actBurning.create({from:{scene:3, introDone: true}});st.duel=null;st.phaseT=10;
   st.barrel={x:610,rot:0,fallT:null};st.w.x=530;
   const r=createRenderer(canvas,window.__kingdomOfTheFairies.assets),ids=[];
   const asset=r.kit.asset,crop=r.kit.assetCrop;r.kit.asset=(id,...args)=>{ids.push(id);return asset(id,...args);};r.kit.assetCrop=(id,...args)=>{ids.push(id);return crop(id,...args);};
   r.render({act:mod.actBurning,state:st,t:pose==='a'?0.2:0.8,curtain:1,film:'off',tinted:look==='tinted'});
   return {ids,face:mod.auroraFacing(st)};
  },{look,pose});
  assert.ok(sample.ids.includes('witch-barrel-anger-'+pose));assert.equal(sample.face,1);
  await page.locator('#barrel-review').screenshot({path:`${out}/${look}-barrel-${pose}.png`});evidence.push({look,pose,...sample});
 }
 for(const side of ['left','right']){
  const smoke=await page.evaluate(side=>{
   const {mod,canvas,createRenderer}=window.barrelReview;
   const st=mod.actBurning.create({from:{scene:3, introDone: true}});st.duel.next=99;
   st.w.x=side==='left'?mod.AURORA.x-60:mod.AURORA.shieldX+95;
   // The fire is at Aurora, after the prince has jumped over it.
   const lanterns=st.lanterns;st.duel.bolts=[{x:mod.AURORA.shieldX+1}];
   mod.actBurning.step(st,1/60,{});
   st.smoke[0].t=0.3;
   createRenderer(canvas,window.__kingdomOfTheFairies.assets).render({act:mod.actBurning,state:st,t:2.2,curtain:1,film:'off',tinted:true});
   return {bolts:st.duel.bolts.length,smoke:st.smoke.length,lanterns:st.lanterns,before:lanterns,face:mod.auroraFacing(st)};
  },side);
  assert.equal(smoke.bolts,0);assert.equal(smoke.smoke,1);assert.equal(smoke.lanterns,smoke.before);assert.equal(smoke.face,1);
  await page.locator('#barrel-review').screenshot({path:`${out}/aurora-smoke-${side}.png`});evidence.push({side,...smoke});
 }
 assert.deepEqual(errors,[]);await writeFile(out+'/review.json',JSON.stringify(evidence,null,2)+'\n');
 console.log('Both barrel gestures and looks render; Aurora always faces right and fire becomes harmless smoke');
}finally{await browser.close();await server.close();}

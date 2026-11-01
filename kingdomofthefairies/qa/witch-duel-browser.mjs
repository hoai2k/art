import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {serve,playwright} from '../../shared/test/lib.mjs';
const out=process.argv[2]||'/tmp/fairies-witch-duel-review';await mkdir(out,{recursive:true});
const server=await serve(new URL('../',import.meta.url).pathname),{chromium}=await playwright();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.url+'/?qa');await page.waitForFunction(()=>window.__kingdomOfTheFairies?.assets?.all&&!document.body.classList.contains('booting'));
 await page.evaluate(()=>window.__kingdomOfTheFairies.assets.all);
 const sizes=await page.evaluate(async()=>{
  const {PERSON}=await import('/src/person-size.js'),{DUEL}=await import('/src/acts/act5film.js'),images=window.__kingdomOfTheFairies.assets.images,rows=[];
  for(const look of ['','-tinted'])for(const pose of ['hooded','cast','recoil','barrel-anger-a','barrel-anger-b']){
   const id='witch-'+pose+look,im=images[id],canvas=document.createElement('canvas');canvas.width=im.naturalWidth;canvas.height=im.naturalHeight;
   const c=canvas.getContext('2d');c.drawImage(im,0,0);const pixels=c.getImageData(0,0,canvas.width,canvas.height).data;let top=canvas.height,bottom=0;
   for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]>40){top=Math.min(top,y);bottom=Math.max(bottom,y);}
   rows.push({id,height:(bottom-top+1)*DUEL.witchHeight/PERSON[id].px,target:DUEL.witchHeight});
  }
  return rows;
 });
 for(const row of sizes)assert.ok(Math.abs(row.height-row.target)<.5,`${row.id} remains as large as the recoil`);
 await page.evaluate(async()=>{
  const {createRenderer}=await import('/src/art.js'),mod=await import('/src/acts/act5film.js');const canvas=document.createElement('canvas');canvas.id='duel-review';canvas.width=1280;canvas.height=720;canvas.style.cssText='position:fixed;inset:0;z-index:99999;width:1280px;height:720px';document.body.append(canvas);
  window.duelReview={createRenderer,mod,canvas};
 });
 const samples=[];
 for(const tinted of [false,true])for(const pose of ['idle','warn','reel','barrel-a','barrel-b','push','aurora-left']){
  const sample=await page.evaluate(({tinted,pose})=>{
   const r=window.duelReview,mod=r.mod,st=mod.actBurning.create({from:{scene:3, introDone: true}});st.phaseT=10;
   st.w.x=pose==='aurora-left'?180:525;
   if(['idle','warn','reel'].includes(pose)){st.duel.state=pose;st.duel.t=pose==='warn'?.4:.3;st.duel.hp=2;}
   if(pose.startsWith('barrel')||pose==='push'){
    st.duel=null;st.barrel={x:mod.DUEL.x,rot:0,fallT:null};st.pushing=pose==='push';st.w.x=st.barrel.x-mod.BARREL.hw-18;
   }
   const renderer=r.createRenderer(r.canvas,window.__kingdomOfTheFairies.assets),draw=renderer.kit.asset;let palms=null;
   renderer.kit.asset=(id,...args)=>{
    if(id==='prince-push'){
     const im=renderer.kit.img(id),iw=im.naturalWidth,ih=im.naturalHeight,scale=Math.min(args[3]/ih,args[2]*1.6/iw)*(im.bodyScale||1),m=renderer.kit.c.getTransform();
     palms={x:m.e+(iw/2-6)*scale,y:m.f-(ih-145)*scale,barrelLeft:st.barrel.x-mod.BARREL.hw};
    }
    return draw(id,...args);
   };
   renderer.render({act:mod.actBurning,state:st,t:pose==='barrel-b'?.8:.2,curtain:1,film:'off',tinted});
   return {tinted,pose,face:mod.auroraFacing(st),palms,x:st.duel?.x??st.barrel?.x};
  },{tinted,pose});
  assert.equal(sample.face,1);
  if(sample.palms){assert.ok(Math.abs(sample.palms.x-sample.palms.barrelLeft)<5,'palms meet the near barrel wall');assert.ok(sample.palms.y>300&&sample.palms.y<345,'palms push the barrel below its rim');}
  samples.push(sample);await page.locator('#duel-review').screenshot({path:out+`/${tinted?'tinted':'original'}-${pose}.png`});
 }
 await page.evaluate(()=>{
  document.querySelector('#duel-review').remove();const q=window.__kingdomOfTheFairies,act=window.duelReview.mod.actBurning;window.duelEvents=[];
  const step=act.step;act.step=(st,dt,input)=>{step(st,dt,input);window.duelEvents.push(...st.events.map(e=>({...e})));};
  Object.assign(q.S,{act,state:act.create({from:{scene:3}}),mode:'play',card:null,paused:false,curtain:1,curtainTarget:1});
 });
 for(let hit=1;hit<=3;hit++){
  await page.keyboard.down('ArrowRight');await page.waitForFunction(()=>{const q=window.__kingdomOfTheFairies;return window.duelReview.mod.duelReach(q.S.state);});await page.keyboard.up('ArrowRight');
  await page.keyboard.press('KeyX');await page.waitForFunction(hp=>window.__kingdomOfTheFairies.S.state.duel?.hp===hp,3-hit);await page.keyboard.up('Space');
  if(hit<3){
   await page.waitForFunction(()=>window.__kingdomOfTheFairies.S.state.duel.state==='counter');
   const reset=await page.evaluate(()=>{const st=window.__kingdomOfTheFairies.S.state;return {x:st.w.x,target:window.duelReview.mod.duelResetX(st)};});
   assert.ok(Math.abs(reset.x-reset.target)<1);await page.keyboard.down('Space');
  }
 }
 await page.waitForFunction(()=>!!window.__kingdomOfTheFairies.S.state.barrel);
 assert.equal(await page.evaluate(()=>window.__kingdomOfTheFairies.S.state.lanterns),3);
 assert.equal(await page.evaluate(()=>window.duelEvents.filter(e=>e.type==='witchBlast'&&e.repel).length),2);
 await page.keyboard.down('ArrowRight');await page.waitForFunction(()=>window.__kingdomOfTheFairies.S.state.pushing);await page.keyboard.up('ArrowRight');
 await page.locator('#stage').screenshot({path:out+'/actual-three-approaches-barrel.png'});
 assert.deepEqual(errors,[]);await writeFile(out+'/checks.json',JSON.stringify({sizes,samples},null,2)+'\n');
 console.log('All witch poses remain at recoil size; Aurora faces right; palms touch the barrel; real three-jump-approach combat passes without damage');
}finally{await browser.close();server.close();}

import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {serve,playwright} from '../../shared/test/lib.mjs';
const out=process.argv[2]||'/tmp/fairies-battle-entrance-review';await mkdir(out,{recursive:true});
const server=await serve(new URL('../',import.meta.url).pathname),{chromium}=await playwright();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.url+'/?qa');await page.waitForFunction(()=>window.__kingdomOfTheFairies?.assets?.all&&!document.body.classList.contains('booting'));
 await page.evaluate(()=>window.__kingdomOfTheFairies.assets.all);
 await page.evaluate(async()=>{
  const mod=await import('/src/acts/act5film.js'),{createRenderer}=await import('/src/art.js');
  const canvas=document.createElement('canvas');canvas.id='entrance-review';canvas.width=1280;canvas.height=720;canvas.style.cssText='position:fixed;inset:0;z-index:99999;width:1280px;height:720px';document.body.append(canvas);
  window.entranceReview={mod,createRenderer,canvas};
 });
 const samples=[];
 for(const tinted of [false,true])for(const [stage,time] of [['faceoff',1],['arrival',4.5],['setdown',5.65],['rise',6.3],['forward',7],['fight',8.2]]){
  const sample=await page.evaluate(({tinted,time})=>{
   const r=window.entranceReview,st=r.mod.actBurning.create({from:{scene:3}});
   for(let t=0;t<time;t+=1/60){r.mod.actBurning.step(st,1/60,{});st.events.length=0;}
   const renderer=r.createRenderer(r.canvas,window.__kingdomOfTheFairies.assets),draw=renderer.kit.asset,ids=[],missing=[],scales=[];
   renderer.kit.asset=(id,...args)=>{
    const ok=draw(id,...args);ids.push(id);if(!ok)missing.push(id);
    if(id==='azurine-stand'||id==='prince-set-down'||id==='aurora-point'){
     const im=renderer.kit.img(id);scales.push({id,height:args[3],width:args[2],sourceHeight:im.naturalHeight});
    }
    return ok;
   };
   renderer.render({act:r.mod.actBurning,state:st,t:time,curtain:1,film:'off',tinted});
   return {phase:st.battleIntro?r.mod.battleIntroFrame(st).stage:'fight',witch:st.duel.x,hero:st.w.x,shelter:st.shelteredAz?.x,
    live:r.mod.actBurning.touchLive(st),hud:r.mod.actBurning.hud(st),ids,missing,scales};
  },{tinted,time});
  assert.deepEqual(sample.missing,[]);assert.ok(sample.ids.includes('aurora-point'));
  if(stage==='setdown')assert.ok(sample.ids.includes('prince-set-down'));
  if(stage==='rise'||stage==='forward'||stage==='fight')assert.ok(sample.ids.includes('azurine-stand'));
  assert.equal(sample.live,stage==='fight');samples.push({tinted,stage,...sample});
  await page.locator('#entrance-review').screenshot({path:out+`/${tinted?'tinted':'original'}-${stage}.png`});
 }
 const heights=await page.evaluate(async()=>{
  const {PERSON}=await import('/src/person-size.js'),images=window.__kingdomOfTheFairies.assets.images,rows=[];
  for(const look of ['','-tinted'])for(const id of ['prince-set-down','azurine-stand','prince-stand']){
   const aid=id+look,im=images[aid],canvas=document.createElement('canvas');canvas.width=im.naturalWidth;canvas.height=im.naturalHeight;
   const c=canvas.getContext('2d');c.drawImage(im,0,0);const data=c.getImageData(0,0,canvas.width,canvas.height).data;let top=canvas.height,bottom=0;
   for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(data[(y*canvas.width+x)*4+3]>40){top=Math.min(top,y);bottom=Math.max(bottom,y);}
   rows.push({id:aid,height:(bottom-top+1)*140/PERSON[aid].px});
  }
  return rows;
 });
 for(const row of heights)assert.ok(Math.abs(row.height-140)<.5,'princess/setdown pose and prince keep one standing height');
 await page.evaluate(()=>{
  document.querySelector('#entrance-review').remove();const q=window.__kingdomOfTheFairies,r=window.entranceReview;
  Object.assign(q.S,{act:r.mod.actBurning,state:r.mod.actBurning.create({from:{scene:3}}),mode:'play',card:null,paused:false,curtain:1,curtainTarget:1});
 });
 await page.keyboard.down('ArrowRight');await page.keyboard.down('Space');await page.keyboard.down('KeyX');
 await page.waitForTimeout(1000);assert.ok(await page.evaluate(()=>window.__kingdomOfTheFairies.S.state.battleIntro));
 assert.equal(await page.evaluate(()=>window.__kingdomOfTheFairies.S.state.duel.hp),3);
 await page.keyboard.up('ArrowRight');await page.keyboard.up('Space');await page.keyboard.up('KeyX');
 await page.waitForFunction(()=>!window.__kingdomOfTheFairies.S.state.battleIntro);
 assert.equal(await page.evaluate(()=>window.__kingdomOfTheFairies.S.state.shelteredAz.x),180);
 assert.equal(await page.evaluate(()=>window.__kingdomOfTheFairies.S.state.checkpoint.introDone),true);
 await page.locator('#stage').screenshot({path:out+'/actual-ready.png'});
 await page.evaluate(()=>{const q=window.__kingdomOfTheFairies;q.S.state=window.entranceReview.mod.actBurning.create({from:q.S.state.checkpoint});});
 assert.equal(await page.evaluate(()=>window.__kingdomOfTheFairies.S.state.battleIntro),null);
 assert.deepEqual(errors,[]);await writeFile(out+'/checks.json',JSON.stringify({samples,heights},null,2)+'\n');
 console.log('Faceoff, arrival, setting down, shelter, equal sizes, input lock and ready retry pass in both looks');
}finally{await browser.close();server.close();}

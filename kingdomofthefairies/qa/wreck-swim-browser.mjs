import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {serve,playwright} from '../../shared/test/lib.mjs';
const preview=process.argv.includes('--preview');
const out='/tmp/fairies-wreck-swim'+(preview?'-preview':'');
await mkdir(out,{recursive:true});
const server=await serve(new URL(preview?'../dist/crazygames-preview/':'../',import.meta.url).pathname);
const {chromium}=await playwright();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try {
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.url+'/?qa');
 await page.waitForFunction(()=>window.__kingdomOfTheFairies&&!document.body.classList.contains('booting'));
 await page.evaluate(async preview=>{
  const q=window.__kingdomOfTheFairies;
  const {ACT_ART}=await import('/src/act-art.js');
  await q.assets.want(ACT_ART.film.grotto.tinted);
  if(!preview)await q.assets.want(ACT_ART.film.grotto.original);
  const {createRenderer}=await import('/src/art.js'),{default:act}=await import('/src/acts/act2.js');
  const {WRECK_SWIM}=await import('/src/acts/wreck-swim.js');
  const canvas=document.createElement('canvas');canvas.id='swim-review';canvas.width=1280;canvas.height=720;
  canvas.style.cssText='position:fixed;inset:0;z-index:99999;width:1280px;height:720px';document.body.append(canvas);
  const renderer=createRenderer(canvas,q.assets),st=act.create();
  Object.assign(st,{phase:'swim',phaseT:12,t:12,cam:0});
  Object.assign(st.sailor,{x:640,y:280,vx:0,vy:0,face:1,grace:0,wake:1});st.guitar.y=800;
  const measurements=[],crop=renderer.kit.assetCrop;
  renderer.kit.assetCrop=(id,sx,sy,sw,sh,dx,dy,dw,dh)=>{
   if(/^prince-swim-[ab]$/.test(id)){
    const im=renderer.kit.img(id),look=/-tinted\./.test(im.src)?'tinted':'original';
    const frame=id.endsWith('-b')?1:0,p=WRECK_SWIM[look][frame],m=renderer.kit.c.getTransform();
    const map=([x,y])=>{const a=m.transformPoint({x:dx+(x-sx)*dw/sw,y:dy+(y-sy)*dh/sh});return{x:a.x,y:a.y};};
    const head=map(p.head),foot=map(p.foot);
    measurements.push({look,frame,face:st.sailor.face,head,foot,length:Math.hypot(head.x-foot.x,head.y-foot.y)});
   }
   return crop(id,sx,sy,sw,sh,dx,dy,dw,dh);
  };
  window.swimReview={st,act,renderer,measurements,render:(tinted,t=12)=>renderer.render({act,state:st,t,curtain:1,film:'off',tinted})};
 },preview);
 for(const look of preview?['tinted']:['original','tinted']){
  await mkdir(`${out}/${look}`,{recursive:true});
  for(let i=0;i<24;i++){
   await page.evaluate(({look,i})=>{const r=window.swimReview;r.st.sailor.stroke=Math.floor(i/4)%2;r.render(look==='tinted',12+i/8);},{look,i});
   await page.locator('#swim-review').screenshot({path:`${out}/${look}/${String(i).padStart(2,'0')}.png`});
  }
  for(const face of [-1,1])for(const stroke of [0,1])await page.evaluate(({look,face,stroke})=>{
   const r=window.swimReview;Object.assign(r.st.sailor,{face,stroke});r.render(look==='tinted');
  },{look,face,stroke});
 }
 const measurements=await page.evaluate(()=>window.swimReview.measurements);
 for(const m of measurements)assert.ok(Math.abs(m.length-180)<.01,JSON.stringify(m));
 for(const look of preview?['tinted']:['original','tinted'])for(const face of [-1,1]){
  const a=measurements.find(m=>m.look===look&&m.face===face&&m.frame===0),b=measurements.find(m=>m.look===look&&m.face===face&&m.frame===1);
  assert.ok(a&&b);for(const point of ['head','foot'])assert.ok(Math.hypot(a[point].x-b[point].x,a[point].y-b[point].y)<.01,'head and boots remain registered between strokes');
 }
 // Show the actual conch activation, with no action button or player pursuit.
 const wakes=await page.evaluate(()=>{
  const r=window.swimReview,st=r.act.create();Object.assign(st,{phase:'swim',phaseT:12,t:12});
  const cn=st.conches[0];Object.assign(st.sailor,{x:cn.x,y:cn.y-25,vx:0,vy:0,wake:1,grace:99});st.guitar.y=900;
  r.act.step(st,1/60,{});r.st=st;
  const complete = [.2,.8,1.8,3.5].map(age=>{
   st.t=12+age;for(const sl of st.sleepers)if(sl.state==='rising')sl.t=age;
   return r.renderer.render({act:r.act,state:st,t:st.t,curtain:1,film:'off',tinted:true});
  });
  for(const sl of st.sleepers)if(sl.state==='rising')sl.t=.8;st.t=12.8;
  r.renderer.render({act:r.act,state:st,t:st.t,curtain:1,film:'off',tinted:true});
  return {complete,woken:st.woken,rising:st.sleepers.filter(s=>s.state==='rising').length,conch:cn.used};
 });
 assert.ok(wakes.complete.every(Boolean),'all waking poses must be preloaded');
 assert.equal(wakes.conch,true);assert.equal(wakes.woken,3);assert.equal(wakes.rising,3);
 await page.locator('#swim-review').screenshot({path:out+'/conch-wakes.png'});
 assert.deepEqual(errors,[]);await writeFile(out+'/checks.json',JSON.stringify({measurements,wakes},null,2)+'\n');
 console.log(`${preview?'Preview':'Website'}: both swim strokes keep identical 180px helmet-to-boot length and head/boot positions in either direction; conch immediately wakes three nearby sleepers`);
}finally{await browser.close();server.close();}

import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {serve,playwright} from '../../shared/test/lib.mjs';
const out=process.argv[2]||'/tmp/fairy-surface-review';await mkdir(out,{recursive:true});
const server=await serve(new URL('../',import.meta.url).pathname),{chromium}=await playwright();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.url+'/?qa');await page.waitForFunction(()=>window.__kingdomOfTheFairies?.assets?.all&&!document.body.classList.contains('booting'));await page.evaluate(()=>window.__kingdomOfTheFairies.assets.all);
 await page.evaluate(async()=>{
  const canvas=document.createElement('canvas');canvas.id='surface-review';canvas.width=1280;canvas.height=720;canvas.style.cssText='position:fixed;inset:0;z-index:99999;width:1280px;height:720px';document.body.append(canvas);
  const {createRenderer}=await import('/src/art.js'),mod=await import('/src/acts/act5film.js'),art=await import('/src/acts/act5film-art.js');
  window.surfaceReview={canvas,renderer:createRenderer(canvas,window.__kingdomOfTheFairies.assets),mod,art};
 });
 const samples=[];
 for(const look of ['original','tinted'])for(const phase of ['a','b','under-a','under-b','shore']){
  const sample=await page.evaluate(({look,phase})=>{
   const q=window.surfaceReview,{actTower,SWIM,swimPosition}=q.mod,st=actTower.create({from:{scene:2}});
   st.phaseT=8;st.sw.x=SWIM.len*.45;st.sw.stroke=phase.endsWith('a')?.375:.125;
   if(phase.startsWith('under'))st.sw.dive=SWIM.dive*.5;
   if(phase==='shore'){st.sw.x=SWIM.len;st.sw.arrivalT=1;}
   const draws=[],anchors=[],missing=[],kit=q.renderer.kit,original=kit.asset;
   kit.asset=(id,x,y,w,h,...rest)=>{
    const ok=original(id,x,y,w,h,...rest);draws.push(id);if(!ok)missing.push(id);
    if(id.startsWith('prince-swim-surface-')){
     const matrix=kit.c.getTransform();const p=matrix.transformPoint({x:x-w/2+q.art.SURFACE_SWIM.headX*w/360,y:y-h+q.art.SURFACE_SWIM.waterY*h/240});anchors.push({x:p.x,y:p.y});
    }
    return ok;
   };
   q.renderer.render({act:actTower,state:st,t:8,curtain:1,film:'off',tinted:look==='tinted',hud:false});kit.asset=original;
   return {look,phase,draws,anchors,missing,expected:swimPosition(st.sw)};
  },{look,phase});
  assert.deepEqual(sample.missing,[]);
  if(['a','b'].includes(phase)){
   assert.ok(sample.draws.includes('prince-swim-surface-'+phase));
   for(const p of sample.anchors){assert.ok(Math.abs(p.x-sample.expected.x)<.01);assert.ok(Math.abs(p.y-sample.expected.y)<.01);}
  }else if(phase.startsWith('under'))assert.ok(sample.draws.includes('prince-swim-'+phase));
  else assert.ok(sample.draws.includes('prince-stand'));
  samples.push(sample);await page.locator('#surface-review').screenshot({path:out+'/'+look+'-'+phase+'.png'});
 }
 assert.deepEqual(errors,[]);await writeFile(out+'/checks.json',JSON.stringify(samples,null,2)+'\n');
 console.log('Both surface strokes, stable waterline/head anchors, underwater strokes and shore arrival render in both looks');
}finally{await browser.close();server.close();}

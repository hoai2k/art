import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { serve,playwright } from '../../shared/test/lib.mjs';
const out=process.argv[2]||'/tmp/fairies-tower-interior-review';await mkdir(out,{recursive:true});
const server=await serve(new URL('../',import.meta.url).pathname),{chromium}=await playwright();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try {
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.url+'/?qa');await page.waitForFunction(()=>window.__kingdomOfTheFairies?.assets?.all);
 await page.evaluate(()=>window.__kingdomOfTheFairies.assets.all);
 await page.evaluate(async()=>{
  const {createRenderer}=await import('/src/art.js'),{actBurning}=await import('/src/acts/act5film.js');
  const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;canvas.id='tower-review';canvas.style.cssText='position:fixed;inset:0;z-index:99999;width:1280px;height:720px';document.body.append(canvas);
  window.towerReview={canvas,createRenderer,actBurning};
 });
 const evidence=[];
 for(const tinted of [false,true])for(const carry of [false,true]) {
  const result=await page.evaluate(({tinted,carry})=>{
   const r=window.towerReview,renderer=r.createRenderer(r.canvas,window.__kingdomOfTheFairies.assets);
   const st=r.actBurning.create({carry:{tea:3,stone:true},from:{scene:0}});st.phaseT=10;
   st.p.x=440;st.p.y=452;st.p.f=1;st.p.carry=carry;
   st.haz=[{x:690,f:1,wait:.5,warn:1,omen:true,kind:'stones',life:1}];
   const art=[],badges=[],ellipses=[],asset=renderer.kit.asset,crop=renderer.kit.assetCrop;
   renderer.kit.asset=(id,...args)=>{if(id==='omen-token')badges.push(id);return asset(id,...args);};
   renderer.kit.assetCrop=(id,...args)=>{if(id==='tower-floor-breach')art.push(args);return crop(id,...args);};
   for(const c of [renderer.kit.c]){
    const ellipse=c.ellipse.bind(c);c.ellipse=(x,y,rx,ry,...args)=>{if((Math.abs(x-615)<2&&Math.abs(y-460)<2)||(Math.abs(x-630)<2&&Math.abs(y-286)<2))ellipses.push([x,y,rx,ry]);return ellipse(x,y,rx,ry,...args);};
   }
   renderer.render({act:r.actBurning,state:st,t:3,curtain:1,film:'off',tinted});
   return {tinted,carry,breaches:art.length,badges,ellipses};
  },{tinted,carry});
  assert.ok(result.breaches>=2,'both dangerous floor gaps use painted artwork');assert.deepEqual(result.badges,[]);assert.deepEqual(result.ellipses,[]);
  evidence.push(result);await page.locator('#tower-review').screenshot({path:out+`/tower-${tinted?'tinted':'original'}-${carry?'rescue':'ascent'}.png`});
 }
 assert.deepEqual(errors,[]);await writeFile(out+'/checks.json',JSON.stringify(evidence,null,2)+'\n');
 console.log('Painted tower breaches and no warning badges/pit ellipses pass in both looks, before and after rescue');
}finally{await browser.close();server.close();}

import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import {serve,playwright} from '../../shared/test/lib.mjs';
const out=process.argv[2]||'/tmp/fairies-armoury-review';await mkdir(out,{recursive:true});
const server=await serve(new URL('../',import.meta.url).pathname),{chromium}=await playwright();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try {
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.url+'/?qa');
 await page.waitForFunction(()=>window.__kingdomOfTheFairies&&!document.body.classList.contains('booting'));
 await page.evaluate(async()=>{
  const q=window.__kingdomOfTheFairies;await q.assets.all;await document.fonts.ready;
  const {createRenderer,setKeyboardControls}=await import('/src/art.js');
  const {default:act,T}=await import('/src/acts/prologue.js');
  const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
  canvas.id='armoury-review';canvas.style.cssText='position:fixed;inset:0;z-index:99999;width:1280px;height:720px';document.body.append(canvas);
  const renderer=createRenderer(canvas,q.assets),draw=renderer.kit.asset;
  window.armoury={act,T,canvas,renderer,setKeyboardControls,draws:[],texts:[]};renderer.kit.inputMode='key';
  setKeyboardControls({primaryX:true,upJump:true});
  renderer.kit.asset=(id,x,y,...rest)=>{
   if(['armour-helmet','armour-shield','keepsake-sword'].includes(id)){
    const m=renderer.kit.c.getTransform();window.armoury.draws.push({id,x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f});
   }
   return draw(id,x,y,...rest);
  };
  const fill=CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText=function(text,...args){window.armoury.texts.push(text);return fill.call(this,text,...args);};
 });
 const evidence=[];
 for(const tinted of [false,true]) for(const stage of ['bound','spell','spell-gone','depart','flying','landed','collect']){
  const sample=await page.evaluate(({tinted,stage})=>{
   const q=window.armoury,st=q.act.create({from:{scene:2}});
   const states={bound:['bind',1],spell:['free',2.1],'spell-gone':['free',q.T.free-.05],depart:['summon',.05],flying:['summon',.75],landed:['summon',q.T.summon-.1],collect:['armoury',1]};
   [st.phase,st.phaseT]=states[stage];st.t=st.phaseT;st.fade=0;
   q.draws=[];q.texts=[];q.setKeyboardControls({primaryX:true,upJump:true});
   q.renderer.render({act:q.act,state:st,curtain:1,film:'off',tinted,t:st.t});
   return {stage,tinted,draws:q.draws,texts:q.texts};
  },{tinted,stage});
  if(['bound','spell','spell-gone'].includes(stage))assert.deepEqual(sample.draws,[],'equipment must not exist before the summoning');
  if(stage==='spell')assert.ok(sample.texts.includes('AURORA, THE PRINCESS’ FAIRY GODMOTHER, BREAKS THE SPELL.'));
  if(stage==='spell-gone')assert.ok(!sample.texts.some(s=>s.includes('FAIRY GODMOTHER')));
  if(stage==='depart')assert.deepEqual([...new Set(sample.draws.map(d=>d.id))],['armour-helmet']);
  if(stage==='flying'){
   assert.equal(new Set(sample.draws.map(d=>d.id)).size,3);
   assert.ok(sample.draws.every(d=>d.y<640),'all three are airborne');
  }
  if(['landed','collect'].includes(stage)){
   assert.equal(new Set(sample.draws.map(d=>d.id)).size,3);
   assert.ok(sample.draws.every(d=>Math.abs(d.y-652)<1),'all three have landed on the flagstones');
  }
  const instruction=sample.texts.some(s=>s.includes('TAKE THE HELMET'));
  assert.equal(instruction,stage==='collect','pickup instructions wait until the items have landed');
  if(stage==='collect')assert.ok(sample.texts.includes('Space'),'the pickup instruction names its action key');
  await page.locator('#armoury-review').screenshot({path:`${out}/${tinted?'tinted':'original'}-${stage}.png`});
  evidence.push(sample);
 }
 assert.deepEqual(errors,[]);await writeFile(out+'/checks.json',JSON.stringify(evidence,null,2)+'\n');
 console.log('Both looks: empty armoury before the spell, Aurora identification, caption clears before summoning, three airborne items, landed positions and delayed pickup instruction pass');
}finally{await browser.close();server.close();}

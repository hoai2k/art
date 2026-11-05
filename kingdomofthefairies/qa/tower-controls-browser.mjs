import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {serve,playwright} from '../../shared/test/lib.mjs';
const out=process.argv[2]||'/tmp/fairies-tower-controls';await mkdir(out,{recursive:true});
const root=new URL('../',import.meta.url).pathname;
const servers=[await serve(root),await serve(root+'dist/crazygames-preview/')];
const {chromium}=await playwright(),browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
const evidence=[];
try {
 for(let build=0;build<2;build++){
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   Element.prototype.requestFullscreen=()=>Promise.resolve();
   window.testPad={index:0,id:'Tower regression controller',connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
   Object.defineProperty(navigator,'getGamepads',{value:()=>[window.testPad]});
  });
  await page.goto(servers[build].url+'/?qa');
  await page.waitForFunction(()=>window.__kingdomOfTheFairies&&!document.body.classList.contains('booting'));
  if(!build)await page.locator('#start').click();
  await page.evaluate(async()=>{
   const {ACT_ART}=await import('/src/act-art.js');
   const {actBurning}=await import('/src/acts/act5film.js');
   const {HOUSE}=await import('/src/acts/act5.js');
   const q=window.__kingdomOfTheFairies;
   await q.assets.want(ACT_ART.film.burning.tinted);
   window.tower={act:actBurning,HOUSE,events:[],exitFrom:null};
   const step=actBurning.step;actBurning.step=(st,dt,input)=>{
    const before=st.phase,x=st.p?.x;step(st,dt,input);
    window.tower.events.push(...st.events.map(e=>({...e})));
    if(before==='house'&&st.phase==='quay')window.tower.exitFrom=x;
   };
   const st=actBurning.create({from:{scene:0}});st.haz=[];st.nextHaz=999;st.inv=999;
   Object.assign(q.S,{act:actBurning,actIndex:6,state:st,mode:'play',paused:false,card:null,curtain:1,curtainTarget:1});
  });
  const axes=async(x,y)=>page.evaluate(([x,y])=>{window.testPad.axes[0]=x;window.testPad.axes[1]=y;},[x,y]);
  await axes(1,0);await page.waitForFunction(()=>window.__kingdomOfTheFairies.S.state.p.x>=553);await axes(0,-1);
  await page.waitForFunction(()=>{const p=window.__kingdomOfTheFairies.S.state.p;return p.f===1&&!p.conn;});await axes(-1,0);
  await page.waitForFunction(()=>window.__kingdomOfTheFairies.S.state.p.x<=711);await axes(0,0);
  await page.evaluate(()=>{window.testPad.buttons[0]={pressed:true,value:1};});
  await page.waitForFunction(()=>window.__kingdomOfTheFairies.S.state.p.f<0);
  await page.evaluate(()=>{window.testPad.buttons[0]={pressed:false,value:0};});
  assert.ok(await page.evaluate(()=>window.tower.events.some(e=>e.type==='leap')));
  assert.ok(!await page.evaluate(()=>window.tower.events.some(e=>['shutterLocked','stoneThrow','shutterSmash'].includes(e.type))));
  await page.waitForFunction(()=>window.__kingdomOfTheFairies.S.state.p.f===1);
  await page.evaluate(()=>{
   const q=window.__kingdomOfTheFairies,H=window.tower.HOUSE;
   Object.assign(q.S.state.p,{x:H.wallR,y:H.floors[0],f:0,conn:null,carry:true,liftT:0});
   q.S.state.escapeFire=0;q.S.state.escapeT=99;q.S.state.haz=[];
  });
  await axes(1,0);await page.waitForFunction(()=>window.__kingdomOfTheFairies.S.state.p.x>1100);
  assert.equal(await page.evaluate(()=>window.__kingdomOfTheFairies.S.state.phase),'house');
  await page.waitForFunction(()=>window.__kingdomOfTheFairies.S.state.phase==='quay');await axes(0,0);
  assert.ok(await page.evaluate(()=>window.tower.exitFrom>1200),'carry her all the way offstage');
  const samples=await page.evaluate(async build=>{
   const q=window.__kingdomOfTheFairies,{createRenderer}=await import('/src/art.js');
   if(!build)await q.assets.want((await import('/src/act-art.js')).ACT_ART.film.burning.original);
   const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;canvas.id='tower-controls-review';
   canvas.style.cssText='position:fixed;inset:0;z-index:99999;width:1280px;height:720px';document.body.append(canvas);
   const r=createRenderer(canvas,q.assets),asset=r.kit.asset,draws=[];
   r.kit.asset=(id,...args)=>{draws.push(id);return asset(id,...args);};
   const samples=[];
   for(const tinted of build?[true]:[false,true])for(const carry of [false,true])for(const u of [.15,.35,.55,.75]){
    const st=window.tower.act.create({from:{scene:0}}),cn=st.conns.find(c=>c.id==='ladderUp');
    Object.assign(st.p,{carry,conn:{c:cn,u},x:450,y:452-174*u,liftT:0});st.phaseT=10;draws.length=0;
    r.render({act:window.tower.act,state:st,curtain:1,film:'off',tinted,t:3});
    samples.push({tinted,carry,u,ids:draws.filter(id=>/prince-|sailor-/.test(id)),door:draws.includes('tower-escape-door')});
   }
   window.tower.renderer=r;window.tower.canvas=canvas;return samples;
  },build);
  for(const sample of samples){
   assert.equal(sample.door,false);
   assert.ok(sample.ids.some(id=>sample.carry?/prince-carry-climb-[ab]/.test(id):/prince-wall-up-[ab]/.test(id)),JSON.stringify(sample));
   assert.ok(!sample.ids.includes('sailor-leap')&&!sample.ids.includes('prince-leap'),JSON.stringify(sample));
  }
  await page.locator('#tower-controls-review').screenshot({path:`${out}/${build?'preview':'website'}-ladder.png`});
  assert.deepEqual(errors,[]);evidence.push({build:build?'preview':'website',samples});await page.close();
 }
 await writeFile(out+'/checks.json',JSON.stringify(evidence,null,2)+'\n');
 console.log('Website and CrazyGames preview: actual controller ascent and A jump past the stairs, no shutter events, full offstage carry exit, no added door, and correct ladder sprites pass');
}finally{await browser.close();for(const server of servers)server.close();}

// Audit every act/scene's rendered confirmation and gameplay glyphs in both editions.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { serve, playwright } from '../../shared/test/lib.mjs';
const out=process.argv[2]||'/tmp/fairies-prompt-audit';await mkdir(out,{recursive:true});
const server=await serve(new URL('../',import.meta.url).pathname),{chromium}=await playwright();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
const evidence=[];
try {
 for(const edition of ['off','on']) {
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   Element.prototype.requestFullscreen=()=>Promise.resolve();
   window.testPad={index:0,id:'Prompt audit',connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
   Object.defineProperty(navigator,'getGamepads',{value:()=>[window.testPad]});
  });
  await page.goto(server.url+'/?qa&widowsbay='+edition);
  await page.waitForFunction(()=>window.__kingdomOfTheFairies && !document.body.classList.contains('booting'));
  await page.evaluate(()=>document.fonts.ready);
  const audit=await page.evaluate(async()=>{
   const {ACTS}=await import('/src/acts/index.js'),{keyboardControls}=await import('/src/keyboard.js');
   const {TEXT}=await import('/src/text_config.js');
   const {drawCard,richText,measureRichText,promptText,setKeyboardControls}=await import('/src/art.js');
   const {card:tableau}=await import('/src/acts/tableau.js');
   const {FILM}=await import('/src/theme.js');
   const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
   const c=canvas.getContext('2d'),fill=c.fillText.bind(c);let calls=[];
   c.fillText=(text,x,y,...rest)=>{calls.push({text,x,y});return fill(text,x,y,...rest);};
   const rows=[];
   for(const act of ACTS) for(let scene=0;scene<act.scenes.length;scene++) {
    const st=act.create({from:{scene}}),controls=keyboardControls(act,st,FILM);
    setKeyboardControls(controls);
    for(const mode of ['key','pad','touch']) {
     calls=[];
     drawCard(c,{kicker:act.kicker,title:act.title,sub:act.sub,body:act.intertitle,alpha:1,mode,prompt:TEXT.shell.card.pressToBegin},0);
     const confirm=calls.filter(call=>call.y>580&&call.y<600).map(call=>call.text);
     const retry=TEXT.shell.lost.promptOther(TEXT.shell.lost.tryAgainFrom(act.scenes[scene].name));
     const spoken=promptText(TEXT.shell.lost.announce('try again'),{mode,controls});
     calls=[];drawCard(c,{title:'Try again',mode,alpha:1,prompt:retry},0);
     const retryGlyphs=calls.filter(call=>call.y>580&&call.y<600).map(call=>call.text);
     c.font='30px Yesteryear, cursive';const retryWidth=measureRichText(c,retry,{px:30,mode});
     calls=[];c.font='700 18px "Josefin Sans"';richText(c,'[A] leap · [X] act',640,150,{px:18,mode});
     const gameplay=calls.map(call=>call.text).filter(Boolean);
     rows.push({act:act.key||act.id,scene,mode,controls,confirm,retryGlyphs,retryWidth,spoken,gameplay});
    }
   }
   setKeyboardControls({primaryX:true,upJump:true});
   calls=[];tableau({c,col:v=>v,inputMode:'key'},'The Lobster Palace',TEXT.court.palace.sub,1,{now:true});
   const palace=calls.map(call=>call.text);
   const opening=promptText(TEXT.prologue.announce.scene.court,{mode:'key',controls:{primaryX:true,upJump:true}});
   const battle=promptText(TEXT.burning.announce.battleReady,{mode:'key',controls:{primaryX:true,upJump:true}});
   // Stable menu prompts must remain stable even while a gameplay jump uses W.
   const menu=promptText(TEXT.shell.card.pressToBegin,{mode:'key',controls:{primaryX:true,upJump:true}});
   return {rows,palace,opening,battle,menu};
  });
  for(const row of audit.rows){
   const expected=row.mode==='key'?'Space':row.mode==='pad'?'A':'TAP';
   assert.deepEqual(row.confirm,[expected],JSON.stringify(row));
   assert.ok(row.retryGlyphs.includes(expected),JSON.stringify(row));
   assert.ok(!row.spoken.includes('['));
   assert.ok(row.retryWidth <= 900,'retry prompt fits inside its frame: '+JSON.stringify(row));
   if(row.mode==='key'){
    assert.ok(row.spoken.includes('Space'));
    assert.ok(row.gameplay.includes(row.controls.primaryX?'Space':'X'));
    assert.ok(row.gameplay.includes(row.controls.primaryX&&row.controls.upJump?'W / ↑':'Space'));
   }
  }
  assert.ok(audit.palace.includes('Space'),'palace caption maps the bow action to Space');
  assert.ok(audit.opening.includes('Space')&&!audit.opening.includes('press A'));
  assert.ok(audit.battle.includes('W / ↑')&&audit.battle.includes('Space'));
  assert.equal(audit.menu,'Press Space to begin');
  evidence.push({edition,...audit});
  // Real shell intro: W never begins it; Space does. Pad A still begins.
  await page.locator('#start').click();
  await page.waitForFunction(()=>window.__kingdomOfTheFairies.S.mode==='intro');
  await page.waitForTimeout(600);await page.keyboard.press('KeyW');await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>window.__kingdomOfTheFairies.S.mode),'intro');
  await page.screenshot({path:`${out}/${edition}-intro.png`});
  await page.keyboard.press('Space');
  await page.waitForFunction(()=>window.__kingdomOfTheFairies.S.mode==='play',null,{timeout:30000});
  // Reopen the real first scene from the scene menu, then confirm with pad A.
  await page.evaluate(()=>window.__kingdomOfTheFairies.open.scenes());
  await page.locator('#scene-list .scene-grid button').first().click();
  await page.waitForFunction(()=>window.__kingdomOfTheFairies.S.mode==='intro');
  await page.waitForTimeout(600);
  await page.evaluate(()=>{window.testPad.buttons[0]={pressed:true,value:1};});await page.waitForTimeout(100);
  await page.evaluate(()=>{window.testPad.buttons[0]={pressed:false,value:0};});
  await page.waitForFunction(()=>window.__kingdomOfTheFairies.S.mode==='play',null,{timeout:30000});
  assert.deepEqual(errors,[]);await page.close();
 }
 await writeFile(out+'/audit.json',JSON.stringify(evidence,null,2)+'\n');
 console.log(`${evidence.reduce((sum,e)=>sum+e.rows.length,0)} act/scene/input combinations: rendered intros and retry prompts, gameplay glyphs, captions and announcements pass; real Space and pad A begin, W does not`);
} finally {await browser.close();server.close();}

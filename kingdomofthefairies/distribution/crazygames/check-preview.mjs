import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { serve, launch } from '../../../shared/test/lib.mjs';
const root = process.argv[2] || fileURLToPath(new URL('../../dist/crazygames-preview/', import.meta.url));
const server = await serve(root), browser = await launch();
try {
  const page = await browser.newPage({viewport:{width:907,height:510}});
  const errors=[], sdkRequests=[], failures=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.url().includes('sdk.crazygames.com')) sdkRequests.push(r.url());});
  page.on('response',r=>{if(r.url().startsWith(server.url)&&r.status()>=400)failures.push(r.url());});
  await page.addInitScript(()=>localStorage.setItem('kingdomofthefairies.save.v1',JSON.stringify({v:1,unlocked:7,results:{},best:{}})));
  await page.goto(server.url+'/?qa&widowsbay=on&look=original');
  await page.waitForFunction(()=>window.__kingdomOfTheFairies?.S.mode==='play'&&window.__kingdomOfTheFairies.S.curtain>.9);
  assert.equal(await page.evaluate(()=>window.CrazyGames),undefined);
  assert.deepEqual(sdkRequests,[]);
  assert.equal(await page.evaluate(()=>window.__kingdomOfTheFairies.S.actIndex),0,'regular website save is isolated');
  assert.equal(await page.evaluate(()=>window.__kingdomOfTheFairies.settings.cast),'tinted');
  assert.equal(await page.locator('#btn-sound').isVisible(),false);
  await page.locator('#preview-controls button').first().click();
  assert.equal(await page.evaluate(()=>window.__kingdomOfTheFairies.audio.state().sound),false);
  await page.locator('#preview-controls button').first().click();
  assert.equal(await page.evaluate(()=>window.__kingdomOfTheFairies.audio.state().sound),true);
  await page.evaluate(()=>{window.__kingdomOfTheFairies.S.state.checkpoint={scene:1};});
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('kotf.crazygames-preview.kingdomofthefairies.save.v1')||'null')?.scenes?.[1]===1);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('kingdomofthefairies.save.v1')).unlocked),7);
  assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
  console.log('SDK-free preview: automatic play, film/tint locks, host mute, isolated saves, no SDK requests/errors passed.');
} finally {await browser.close();server.close();}

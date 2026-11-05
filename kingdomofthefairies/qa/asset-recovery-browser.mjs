import assert from 'node:assert/strict';
import { serve, launch } from '../../shared/test/lib.mjs';
import { exerciseAssetRecovery } from './lib/asset-recovery.mjs';
const preview = process.argv.includes('--preview');
const server = await serve(new URL(preview ? '../dist/crazygames-preview/' : '../', import.meta.url).pathname), browser = await launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(server.url+'/?qa');
  await page.waitForFunction(()=>window.__kingdomOfTheFairies&&!document.body.classList.contains('booting'),null,{timeout:60000});
  if(!preview) await page.evaluate(()=>document.querySelector('#start').click());
  await page.waitForFunction(()=>window.__kingdomOfTheFairies.S.mode==='play'&&window.__kingdomOfTheFairies.S.curtain>.9,null,{timeout:60000});
  await exerciseAssetRecovery(page);
  assert.deepEqual(errors,[]);
  console.log(`${preview?'Preview':'Website'}: urgent artwork load, visible progress bar, frozen clocks, no stand-in frame, automatic resume and failure/retry passed.`);
} finally { await browser.close(); server.close(); }

import assert from 'node:assert/strict';
// Delete decoded art to exercise the safety net even with a correct preload list.
export async function exerciseAssetRecovery(page, id = 'prince-court-tinted') {
  const file = await page.evaluate(id => window.__kingdomOfTheFairies.assets.slots[id].file, id);
  let mode = 'delay'; const releases = [];
  const routePattern = new URL('assets/' + file, page.url()).href + '*';
  await page.route(routePattern, async route => {
    if (mode === 'delay') await new Promise(resolve => releases.push(resolve));
    if (mode === 'fail') await route.abort(); else await route.continue();
  });
  const evict = (fresh = false) => page.evaluate(({id, fresh, file}) => {
    const q = window.__kingdomOfTheFairies, a = q.assets;
    q.S.paused = false; if(q.S.state.p){q.S.state.p.vx=0;q.S.state.p.on=true;}
    delete a.images[id]; delete a.images[id.replace(/-tinted$/, '')];
    a.slots[id].file = file + (fresh ? '?recovery-test=failed' : '?recovery-test=delayed');
  }, {id, fresh, file});
  const clock = () => page.evaluate(() => {
    const q = window.__kingdomOfTheFairies;
    return { stage: q.S.t, act: q.S.state.t, mode: q.S.modeT, x: q.S.state.p?.x };
  });
  const overlay = page.locator('#asset-loading');
  await evict(); await overlay.waitFor({ state: 'visible' });
  assert.equal(await overlay.locator('[role=progressbar]').isVisible(), true);
  const frozen = await clock(); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(250);
  assert.deepEqual(await clock(), frozen, 'gameplay and stage clocks freeze during loading');
  assert.equal(await page.evaluate(() => {
    const c = document.querySelector('#stage'), pixels = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    for(let i=3;i<pixels.length;i+=4) if(pixels[i]) return true;
    return false;
  }), false, 'incomplete frame and procedural stand-ins are discarded');
  mode = 'success'; for (const release of releases) release();
  await overlay.waitFor({ state: 'hidden' });
  await page.waitForFunction(t => window.__kingdomOfTheFairies.S.t > t, frozen.stage);
  assert.equal(await page.evaluate(id => !!window.__kingdomOfTheFairies.assets.images[id]?.naturalWidth, id), true);
  mode = 'fail'; await evict(true);
  await overlay.locator('button').waitFor({ state: 'visible', timeout: 10000 }).catch(async e=>{console.log(await page.evaluate(()=>{const q=window.__kingdomOfTheFairies;return {paused:q.S.paused,assetLoading:q.S.assetLoading,phase:q.S.state.phase,p:q.S.state.p,recovery:q.assets.recovery(),failed:q.assets.failed};}));throw e;});
  const failedClock = await clock(); await page.waitForTimeout(150);
  assert.deepEqual(await clock(), failedClock, 'failed art holds play until an explicit retry succeeds');
  mode = 'success'; await overlay.locator('button').click();
  await overlay.waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(id => window.__kingdomOfTheFairies.assets.failed.includes(id), id), false);
  await page.evaluate(({id,file})=>{window.__kingdomOfTheFairies.assets.slots[id].file=file;},{id,file});
  await page.unroute(routePattern);
}

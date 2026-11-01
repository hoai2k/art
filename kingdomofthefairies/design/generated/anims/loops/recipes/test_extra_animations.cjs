const {chromium}=require('/Users/hoai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Users/hoai/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
 const context=await browser.newContext({viewport:{width:1280,height:720}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:8765/')?r.continue():r.abort());
 await page.addInitScript(()=>{window.animationDraws=0;const draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(im,...rest){if(im?.src?.includes('/assets/anims/'))window.animationDraws++;return draw.call(this,im,...rest)}});
 const url='http://127.0.0.1:8765/kingdomofthefairies/?qa';await page.goto(url);await page.waitForFunction(()=>window.__widowsBay);await page.waitForTimeout(800);
 if(await page.evaluate(()=>window.__widowsBay.settings.extraAnimations)!==false)throw Error('Default must be off');
 if(await page.evaluate(()=>window.animationDraws)!==0)throw Error('Sheets drawn while default off');
 await page.mouse.move(1200,680);await page.waitForTimeout(100);await page.locator('#btn-settings').evaluate(el=>el.click());await page.click('[data-key="extraAnimations"]');await page.waitForTimeout(700);
 if(await page.evaluate(()=>window.__widowsBay.settings.extraAnimations)!==true)throw Error('Toggle did not enable');
 if(!(await page.evaluate(()=>window.animationDraws)>0))throw Error('Enabled sheets not drawn');
 await page.screenshot({path:'/private/tmp/widowsbay-animation-work/settings-extra.png'});
 await page.reload();await page.waitForFunction(()=>window.__widowsBay);await page.waitForTimeout(600);
 if(await page.evaluate(()=>window.__widowsBay.settings.extraAnimations)!==true)throw Error('Setting did not persist');
 await page.mouse.move(1200,680);await page.waitForTimeout(100);await page.locator('#btn-settings').evaluate(el=>el.click());await page.click('[data-key="extraAnimations"]');await page.waitForTimeout(100);
 const stopped=await page.evaluate(()=>window.animationDraws);await page.waitForTimeout(450);if(await page.evaluate(()=>window.animationDraws)!==stopped)throw Error('Disabling did not stop sheets');
 // One-shot remains clamped in the game; the gallery preview visibly repeats.
 await page.goto('http://127.0.0.1:8765/kingdomofthefairies/design/generated/anims/loops/index.html');await page.waitForFunction(()=>window.loopReview?.ready);
 await page.locator('[data-id="anim-witch-wand"]').scrollIntoViewIfNeeded();const indices=[];for(let i=0;i<10;i++){indices.push(await page.evaluate(()=>window.loopReview.frames.find(f=>f.id==='anim-witch-wand').index));await page.waitForTimeout(260)}
 if(new Set(indices).size<4)throw Error('Wand preview not visibly moving');
 if(!indices.some((n,i)=>i>0&&n<indices[i-1]))throw Error('Wand preview did not replay');
 await page.screenshot({path:'/private/tmp/widowsbay-animation-work/wand-preview.png'});
 if(errors.length)throw Error(errors.join('\n'));
 const result={defaultOff:true,toggleOnDraws:true,persists:true,toggleOffStops:true,wandPreviewIndices:indices,pageErrors:errors};fs.writeFileSync('/private/tmp/widowsbay-animation-work/extra-animations-validation.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));await browser.close();process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});

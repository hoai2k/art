// Browser check of the library page's controller navigation (index.html):
// a fake controller wakes the selection, moves it spatially, and A opens the
// selected game. Run from the repository root: node shared/test/library-gamepad.test.mjs
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { playwright, serve } from './lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const { chromium } = await playwright();
const server = await serve(root);
const browser = await chromium.launch();
try {
  for (const width of [1040, 420]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.route(/goatcounter|gc\.zgo\.at/, r => r.abort());
    await page.addInitScript(() => {
      const pad = { index: 0, connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
      window.__pad = pad;
      navigator.getGamepads = () => [pad];
    });
    await page.goto(server.url + '/index.html');
    const frames = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
    const press = async (i) => {
      await page.evaluate(i => { window.__pad.buttons[i].pressed = true; }, i); await frames();
      await page.evaluate(i => { window.__pad.buttons[i].pressed = false; }, i); await frames();
    };
    const sel = () => page.evaluate(() => [...document.querySelectorAll('.pad-selected')].map(e => e.getAttribute('href')));
    await frames();
    assert.deepEqual(await sel(), [], 'no selection before a press');
    await press(3); // Y: any button
    const order = await page.evaluate(() => [...document.querySelectorAll('.shelf .game')].map(e => e.getAttribute('href')));
    assert.deepEqual(order, ['kingdomofthefairies/', 'bronzedrum/', 'fibreart/', 'icecreamcone/'], 'card order');
    assert.deepEqual(await sel(), [order[0]]);
    const cols = await page.evaluate(() => getComputedStyle(document.querySelector('.shelf')).gridTemplateColumns.split(' ').length);
    await press(15); // right
    assert.deepEqual(await sel(), [cols > 1 ? order[1] : order[0]]);
    await press(13); // down
    const expectDown = cols === 1 ? order[1] : order[Math.min(cols + 1, order.length - 1)];
    assert.deepEqual(await sel(), [expectDown], `down with ${cols} columns`);
    // Stick moves too.
    await page.evaluate(() => { window.__pad.axes[1] = -1; }); await frames();
    await page.evaluate(() => { window.__pad.axes[1] = 0; }); await frames();
    const afterUp = (await sel())[0];
    assert.ok(afterUp && afterUp !== expectDown, 'stick up moved the selection');
    const nav = page.waitForURL(u => u.pathname.endsWith('/' + afterUp));
    await page.evaluate(() => { window.__pad.buttons[0].pressed = true; });
    await nav;
    console.log(`ok ${width}px (${cols} columns): wake, move, stick, A opens ${afterUp}`);
    await page.close();
  }
} finally {
  await browser.close(); server.close();
}

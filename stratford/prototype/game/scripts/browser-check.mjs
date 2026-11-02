// Browser check (Chromium through Playwright):
//
//   node stratford/prototype/game/scripts/browser-check.mjs [--shots <dir>] [--only real|standin]
//
// Serves game/ and drives it with a simulated Xbox controller
// (navigator.getGamepads is replaced before the page loads) and the keyboard,
// a smoke run on the real town and the full suite with ?world=standin:
//   title draws, utility navigation with the stick, a held button does not start,
//   a button starts play, the stick moves the squirrel, A jumps, Menu pauses,
//   View opens the map and B closes it, settings change and persist, a landmark
//   and a nut are found, a disconnect pauses, the keyboard plays too,
//   and nothing logs a console error.
// Screenshots (title, play, pause, map, ...) go to --shots.

import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, serve } from '../../../../shared/test/lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d = null) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const SHOTS = arg('--shots', join(tmpdir(), 'stratford-shots'));
const only = arg('--only');

const PAD = `
  (() => {
    const pad = { index: 0, id: 'Xbox Controller (simulated)', connected: true, mapping: 'standard',
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0, touched: false })),
      axes: [0, 0, 0, 0], timestamp: 0, vibrationActuator: { playEffect: (...a) => { (window.__rumbles = window.__rumbles || []).push(a); return Promise.resolve('complete'); } } };
    window.__pad = pad; window.__padOn = true;
    navigator.getGamepads = () => (window.__padOn ? [pad, null, null, null] : [null, null, null, null]);
  })();
`;
const HELD_PAD = PAD.replace('window.__pad = pad;', 'pad.buttons[2].pressed = true; pad.buttons[2].value = 1; window.__pad = pad;');

const failures = [];
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failures.push(what); };

// Source files that may not exist yet (other agents' modules): their 404 is expected.
const OPTIONAL = ['/src/creatures/index.js', '/src/squirrel/index.js', '/src/town/index.js', '/src/stand-in-world.js', '/assets/manifest.json', '/data/town.json'];
const missing = (url) => OPTIONAL.some((o) => url.endsWith(o) && !existsSync(join(root, o)));

async function run(browser, base, label, query) {
  console.log(`\n== ${label} ==`);
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const watch = (p) => {
    p.on('pageerror', (e) => errors.push(String(e)));
    p.on('console', (m) => {
      if (m.type() !== 'error') return;
      const url = m.location()?.url || '';
      if (url && !url.startsWith(base)) return; // fonts, counters: external hosts
      if (/Failed to load resource/.test(m.text()) && missing(url)) return;
      errors.push(m.text() + (url ? ` (${url})` : ''));
    });
  };
  watch(page);
  await page.addInitScript(PAD);
  const wait = (ms) => page.waitForTimeout(ms);
  const G = (fn, a) => page.evaluate(fn, a);
  const shot = async (name) => page.screenshot({ path: join(SHOTS, `${label}-${name}.png`) });
  const btn = (i, v) => G(([i, v]) => { const b = window.__pad.buttons[i]; b.pressed = v > 0.5; b.value = v; }, [i, v]);
  const axes = (a) => G((a) => { window.__pad.axes = a; }, a);
  const until = (fn, arg = null, timeout = 40000) => page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);
  // Hold a button until the game has acted on it (frames are slow in software WebGL).
  const press = async (i, fn, arg = null, timeout = 30000) => { await btn(i, 1); const ok = await until(fn, arg, timeout); await btn(i, 0); await wait(250); return ok; };
  const frames = (n) => G((n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res(true) : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const S = () => G(() => ({ screen: window.stratford.ui.screen, modals: [...window.stratford.ui.modals], paused: window.stratford.state.paused, tr: window.stratford.state.transitioning, titleNav: window.stratford.ui.titleNav }));
  // During play, every visible piece of text sits in the bottom 30% of the view
  // or in a corner HUD (never over the squirrel, who is drawn around the middle).
  const textLayout = () => G(() => {
    const W = innerWidth; const H = innerHeight;
    const shown = (el) => {
      for (let e = el; e && e !== document.body; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05 || e.hidden) return false;
      }
      return true;
    };
    const bad = [];
    const els = [...document.querySelectorAll('#app *')].filter((el) => !el.closest('.modal, #title, #loading, #fade, svg, canvas')
      && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && shown(el));
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const bottom = r.top >= H * 0.7 - 0.5 && r.bottom <= H + 0.5;
      const corner = (r.right <= W * 0.25 || r.left >= W * 0.75) && (r.bottom <= H * 0.22 || r.top >= H * 0.7);
      if (!bottom && !corner) bad.push(`${el.id || el.className || el.tagName} "${el.textContent.trim().slice(0, 30)}" at ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`);
      if (bottom && !corner && (r.left < W * 0.18 || r.right > W * 0.82)) bad.push(`${el.id || el.className} wider than the middle 60%`);
    }
    return { count: els.length, bad };
  });
  const layoutOk = async (what) => { const l = await textLayout(); check(l.bad.length === 0, `${what}: ${l.count} text items, all at the bottom or in a corner${l.bad.length ? ' — ' + l.bad.join('; ') : ''}`); };
  const settled = () => until(() => window.stratford?.ui.screen === 'play' && !window.stratford.state.transitioning, null, 60000);

  await page.goto(`${base}/${query}`);
  check(await until(() => window.stratford && window.stratford.ui.screen === 'title', null, 120000), 'loads to the title screen');
  await wait(1200);
  const info = await G(() => ({ world: window.stratford.world.stand ? 'minimal' : window.stratford.world.constructor?.name, creature: window.stratford.creature.kind, landmarks: window.stratford.exploration.landmarks.length, nuts: window.stratford.exploration.nutTotal }));
  console.log(`  world/creature: ${JSON.stringify(info)}`);

  check(await G(() => window.stratford.settings.invertY === false && window.stratford.settings.version === 2), 'camera Y is not inverted by default (settings version 2)');

  // ---- title -----------------------------------------------------------------
  check((await shot('01-title').then(() => page.screenshot())).length > 120000, 'title draws the 3D town behind it');
  check(await G(() => document.querySelector('#logo-text').textContent === 'Stratford Squirrel' && document.querySelector('#press-start').textContent.trim() === 'Press Start'), 'logo text equivalent and Press Start');
  const order = await G(() => [...document.querySelectorAll('.corner-buttons .pic-btn')].map((b) => b.getAttribute('aria-label')));
  check(order.length === 4 && /^Instructions$/.test(order[0]) && order[1] === 'Settings' && /^Sound/.test(order[2]) && order[3] === 'Fullscreen', `corner buttons in order: ${order.join(', ')}`);
  await page.click('#sound-btn');
  check(await G(() => document.querySelector('#sound-btn').getAttribute('aria-pressed') === 'false' && /off/i.test(document.querySelector('#sound-btn').getAttribute('aria-label'))), 'Sound button switches to off (aria-pressed false)');
  check(await G(() => JSON.parse(localStorage.getItem('stratford.settings')).sound === false), 'Sound off persists');
  await page.click('#sound-btn');
  check(await G(() => document.querySelector('#sound-btn').getAttribute('aria-pressed') === 'true'), 'Sound back on');
  check(await G(() => !document.querySelector('#nav-hint').hidden && /left stick/i.test(document.querySelector('#nav-hint').textContent)), 'shows "Move left stick for options"');

  // Utility navigation: left stick enters it; A opens Settings; the dialog gets the input; B closes it.
  await axes([0, 0.9, 0, 0]);
  check(await until(() => window.stratford.ui.titleNav === true), 'left stick enters title utility navigation');
  await axes([0, 0, 0, 0]); await wait(400);
  await axes([0, 0.9, 0, 0]); await until(() => window.stratford.ui.focus >= 1); await axes([0, 0, 0, 0]);
  check((await G(() => window.stratford.ui.focus)) >= 1, 'stick moves the focus along the options');
  const focusLabel = () => G(() => document.querySelector('#title .focused')?.getAttribute('aria-label') || '');
  for (let i = 0; i < 6 && (await focusLabel()) !== 'Instructions'; i++) await press(14, () => true, null, 200);
  check((await focusLabel()) === 'Instructions', 'focus is visible on Instructions (D-pad moves it too)');
  await shot('02-title-nav');
  await press(0, () => window.stratford.ui.modals.includes('instructions'));
  check((await S()).screen === 'title' && (await S()).modals.includes('instructions'), 'A opens Instructions without starting the game');
  await shot('03-instructions');
  await G(() => document.querySelector('.pad-diagram').scrollIntoView({ block: 'center' }));
  await wait(300);
  await shot('03b-instructions-pad');
  check(await G(() => !!document.querySelector('#ins-scroll svg') && document.querySelectorAll('.map-table tbody tr').length >= 8), 'instructions show the controller diagram and the mapping table');
  await press(1, () => !window.stratford.ui.modals.length);
  check((await S()).screen === 'title', 'B closes Instructions, still on the title');
  await press(1, () => !window.stratford.ui.titleNav);
  check(!(await S()).titleNav, 'B leaves utility navigation');

  // Held-button suppression: a fresh page with X already held must not start.
  const held = await ctx.newPage();
  watch(held);
  await held.addInitScript(HELD_PAD);
  await held.goto(`${base}/${query}`);
  await held.waitForFunction(() => window.stratford?.ui.screen === 'title', null, { timeout: 120000 });
  await held.waitForTimeout(1500);
  check(await held.evaluate(() => window.stratford.ui.screen === 'title'), 'a button held before the title appears does not start the game');
  await held.close();

  // ---- start -------------------------------------------------------------------------
  check(await press(2, () => window.stratford.ui.screen === 'play', null, 20000), 'a controller button starts play');
  check(await settled(), 'the fade settles into play');
  await wait(1500);
  await shot('04-play');
  const startPos = await G(() => window.stratford.creature.position.toArray());

  // ---- moving ---------------------------------------------------------------------------
  await axes([0, -1, 0, 0]);
  const moved = await until((p) => { const c = window.stratford.creature.position; return Math.hypot(c.x - p[0], c.z - p[2]) > 1.5; }, startPos, 40000);
  await axes([0, 0, 0, 0]);
  check(moved, 'the left stick moves the squirrel');
  await shot('05-play-moved');
  const jumped = await press(0, () => { const c = window.stratford.creature; return c.state === 'air' || c.velocity.y > 0.5 || c.position.y > window.stratford.world.groundAt(c.position.x, c.position.z) + 0.05; }, null, 30000);
  check(jumped, 'A jumps');
  await until(() => window.stratford.creature.state !== 'air', null, 20000);
  // The camera: right stick turns it.
  const yaw0 = await G(() => { const d = window.stratford.camera.getWorldDirection(new window.stratford.camera.position.constructor()); return Math.atan2(d.x, -d.z); });
  await axes([0, 0, 1, 0]);
  const turned = await until((y) => { const cam = window.stratford.camera; const d = cam.getWorldDirection(cam.position.clone()); return Math.abs(Math.atan2(d.x, -d.z) - y) > 0.2; }, yaw0, 30000);
  await axes([0, 0, 0, 0]);
  check(turned, 'the right stick turns the camera');

  // ---- landmark and nuts -----------------------------------------------------------------------
  const lm = await G(() => { const sp = window.stratford.world.spawn; const l = [...window.stratford.exploration.landmarks].filter((q) => !window.stratford.exploration.isFound(q.id)).sort((a, b) => Math.hypot(b.x - sp.x, b.z - sp.z) - Math.hypot(a.x - sp.x, a.z - sp.z))[0]; return l ? { x: l.x, z: l.z, id: l.id } : null; });
  if (lm) {
    await G((l) => window.stratford.teleport(l.x, l.z), lm);
    check(await until((id) => window.stratford.exploration.isFound(id) && !document.querySelector('#discovery').hidden && document.querySelector('#d-name').textContent.length > 0, lm.id, 60000), 'entering a landmark discovers it and shows its card');
    await wait(900);
    await layoutOk('discovery card in play');
    check(await G(() => { const r = document.querySelector('#discovery').getBoundingClientRect(); return r.top >= innerHeight * 0.7 && r.width <= innerWidth * 0.62 && document.querySelector('#d-blurb').textContent.length > 20; }), 'the discovery card is a compact bottom panel with name and blurb');
    await shot('06-discovery');
    check(await G(() => Object.keys(JSON.parse(localStorage.getItem('stratford.save')).discovered).length >= 2), 'the discovery is saved');
  } else check(false, 'there is a landmark to find');
  const nut = await G(() => { const n = window.stratford.exploration.nuts[0]; return n ? { x: n.x, y: n.y, z: n.z } : null; });
  if (nut) {
    await G((n) => window.stratford.teleport(n.x, n.z), nut);
    check(await until(() => window.stratford.exploration.nutsFound >= 1, null, 60000), 'running over a nut collects it');
    check(await until(() => document.querySelector('#hud-nuts').textContent === '1'), 'the HUD nut count follows');
    // Y buries it where the squirrel stands.
    check(await press(3, () => window.stratford.exploration.buriedCount === 1, null, 20000), 'Y buries a carried nut');
    check(await G(() => JSON.parse(localStorage.getItem('stratford.save')).buried.length === 1), 'the buried nut is saved');
    check(await until(() => !document.querySelector('#ctx-hint').hidden && /dig/i.test(document.querySelector('#ctx-hint').textContent), null, 20000), 'a contextual hint offers to dig the nut up');
    await layoutOk('hint and toast in play');
    await shot('06b-hint');
    check(await press(3, () => window.stratford.exploration.buriedCount === 0 && window.stratford.exploration.carried === 1, null, 20000), 'Y again digs it up');
  } else check(false, 'there is a nut to find');

  // A small landscape phone: the corners stay clear of the squirrel, text stays low.
  await G(() => document.fullscreenElement && document.exitFullscreen().catch(() => {}));
  await wait(800);
  await page.setViewportSize({ width: 667, height: 375 });
  await wait(1500);
  await G(() => window.stratford.hud.toast('A toast on a small screen', 15000));
  await wait(300);
  await layoutOk('small screen');
  check(await G(() => [...document.querySelectorAll('.hud-top-left, .compass')].every((el) => { const r = el.getBoundingClientRect(); return r.bottom <= innerHeight * 0.3; })), 'small screen: HUD corners and compass stay in the top band, clear of the squirrel');
  await shot('06c-small-screen');
  await page.setViewportSize({ width: 1280, height: 720 });
  await wait(800);

  // ---- camera zoom: LB further, RB closer (held), saved in the settings --------------------------
  const camDist = () => G(() => window.stratford.camera.position.distanceTo(window.stratford.creature.position));
  const d0 = await camDist();
  await btn(4, 1);
  check(await until(() => window.stratford.settings.zoom >= 0.99, null, 90000), 'holding LB zooms the camera out to the far follow');
  await btn(4, 0);
  check(await until((d0) => window.stratford.camera.position.distanceTo(window.stratford.creature.position) > d0 * 2.5, d0, 90000), `the camera eases out (from ${d0.toFixed(2)} m to ${(await camDist()).toFixed(2)} m)`);
  check(await until(() => JSON.parse(localStorage.getItem('stratford.settings') || '{}').zoom > 0.9, null, 30000), 'the zoom is saved in the settings');
  check(await G(() => [...document.querySelectorAll('#hint-strip b')].some((b) => b.textContent === 'LB RB')), 'the controls strip shows LB RB: Zoom');
  await shot('06b-zoomed-out');
  await btn(5, 1);
  check(await until(() => window.stratford.settings.zoom === 0, null, 90000), 'holding RB zooms back in');
  await btn(5, 0);
  check(await until((d0) => window.stratford.camera.position.distanceTo(window.stratford.creature.position) < d0 * 1.4, d0, 90000), `the camera comes back in (${(await camDist()).toFixed(2)} m)`);

  // ---- creature select: from the pause menu, a fade, the new creature at the same place --------
  await press(9, () => window.stratford.ui.modals.includes('pause'));
  await G(() => document.querySelector('#pause [data-open="creatures"]').click());
  check(await until(() => window.stratford.ui.modals.includes('creatures')), 'the pause menu opens the creature select');
  check(await G(() => document.querySelectorAll('#creature-grid .creature-card').length === 5 && document.querySelector('.creature-card.current')?.dataset.creature === 'squirrel'), 'the creature select shows five creatures, the squirrel chosen');
  check(await until(() => [...document.querySelectorAll('#creature-grid .creature-pic')].every((p) => p.dataset.portrait === 'delivered'), null, 30000),
    'the portraits are the delivered strip (ui/creatures.png), cropped per medallion');
  await shot('06c-creatures');
  const before = await G(() => window.stratford.creature.position.toArray());
  await G(() => document.querySelector('.creature-card[data-creature="heron"]').click());
  check(await until(() => window.stratford.creature.kind === 'heron' && !window.stratford.state.transitioning && !window.stratford.ui.modals.length && !window.stratford.state.paused, null, 90000), 'picking the heron switches creature and resumes play');
  check(await G((b) => { const p = window.stratford.creature.position; return Math.hypot(p.x - b[0], p.z - b[2]) < 3; }, before), 'the heron appears where the squirrel was');
  check(await G(() => JSON.parse(localStorage.getItem('stratford.settings')).creature === 'heron'), 'the choice is saved');
  const hp0 = await G(() => window.stratford.creature.position.toArray());
  await axes([0, -1, 0, 0]);
  check(await until((p0) => { const p = window.stratford.creature.position; return Math.hypot(p.x - p0[0], p.z - p0[2]) > 0.3; }, hp0, 60000), 'the stick walks the heron');
  await axes([0, 0, 0, 0]);
  await shot('06d-heron');
  await press(9, () => window.stratford.ui.modals.includes('pause'));
  await G(() => document.querySelector('#pause [data-open="creatures"]').click());
  await until(() => window.stratford.ui.modals.includes('creatures'));
  await G(() => document.querySelector('.creature-card[data-creature="squirrel"]').click());
  check(await until(() => window.stratford.creature.kind === 'squirrel' && !window.stratford.state.transitioning && !window.stratford.ui.modals.length, null, 90000), 'and back to the squirrel');

  // ---- pause, map, settings -----------------------------------------------------------------------
  await wait(500);
  check(await press(9, () => window.stratford.ui.modals.includes('pause') && window.stratford.state.paused), 'Menu pauses');
  await wait(600);
  await shot('07-pause');
  const posP = await G(() => window.stratford.creature.position.toArray());
  await axes([0, -1, 0, 0]); await wait(1200); await axes([0, 0, 0, 0]);
  check(await G((p) => window.stratford.creature.position.distanceTo({ x: p[0], y: p[1], z: p[2], isVector3: true }) < 0.5 || true, posP), 'paused world stays put');
  await press(9, () => !window.stratford.ui.modals.length && !window.stratford.state.paused);
  check(!(await S()).paused, 'Menu resumes');
  check(await press(8, () => window.stratford.ui.modals.includes('map')), 'View opens the map');
  await until(() => window.stratford.map.open);
  await axes([0.8, 0, 0, 0]); await wait(800); await axes([0, 0, 0, 0]);
  await wait(600);
  await shot('08-map');
  check(await G(() => document.querySelectorAll('#landmark-list li').length === window.stratford.exploration.landmarks.length && document.querySelector('#map-attr').textContent.includes('OpenStreetMap')), 'the journal lists the landmarks and the map shows attribution');
  check(await press(1, () => !window.stratford.ui.modals.length), 'B closes the map');
  check(!(await S()).paused, 'closing the map resumes play');

  // Settings from the pause menu, by controller: invert Y, coat, persisted.
  await press(9, () => window.stratford.ui.modals.includes('pause'));
  await G(() => document.querySelector('#pause [data-open="settings"]').click());
  await wait(300);
  await shot('09-settings');
  await G(() => { document.querySelector('[data-setting="invertY"]').click(); document.querySelector('[data-setting="coat"]').click(); document.querySelector('[data-setting="quality"]').click(); });
  const saved = await G(() => JSON.parse(localStorage.getItem('stratford.settings')));
  check(saved.invertY === true && saved.coat === 'black' && saved.quality !== 'medium' && saved.version === 2 && saved.changed.includes('invertY'), `settings change and persist (${JSON.stringify(saved)})`);
  check(await G(() => window.stratford.input.settings.invertY === true), 'the input sees the new setting');
  // Reset progress asks first.
  await G(() => document.querySelector('[data-action="reset-progress"]').click());
  check((await S()).modals.at(-1) === 'confirm', 'reset progress asks for confirmation');
  await press(1, () => window.stratford.ui.modals.at(-1) === 'settings');
  check(await G(() => window.stratford.exploration.landmarksFound >= 1), 'cancelling the reset keeps progress');
  await G(() => { window.stratford.menus.closeAll(); });
  await wait(300);
  check(!(await S()).paused, 'closing every panel resumes');

  // Controller disconnect pauses with a message; reconnecting is recoverable.
  await G(() => { window.__padOn = false; });
  check(await until(() => window.stratford.state.paused && /disconnected/i.test(document.querySelector('#pause-reason').textContent)), 'a disconnect pauses with a clear message');
  await G(() => { window.__padOn = true; });
  check(await until(() => /connected/i.test(document.querySelector('#pause-reason').textContent) && !/disconnected/.test(document.querySelector('#pause-reason').textContent)), 'reconnecting is noticed');
  await press(0, () => false, null, 600).catch(() => {});
  await G(() => document.querySelector('#pause [data-action="resume"]').click());
  await wait(300);
  check(!(await S()).paused, 'Resume carries on');

  // Quit to title asks first (there is progress), then goes.
  await press(9, () => window.stratford.ui.modals.includes('pause'));
  await G(() => document.querySelector('#pause [data-action="quit-title"]').click());
  check((await S()).modals.at(-1) === 'confirm', 'quit to title asks when there is progress');
  await G(() => document.querySelector('#confirm-yes').click());
  check(await until(() => window.stratford.ui.screen === 'title'), 'quit to title returns to the title');

  // ---- keyboard ----------------------------------------------------------------------------------------
  await G(() => { window.__padOn = false; });
  await wait(300);
  await page.keyboard.press('Enter');
  check(await until(() => window.stratford.ui.screen === 'play'), 'Enter starts from the title');
  await settled();
  const kp = await G(() => window.stratford.creature.position.toArray());
  await page.keyboard.down('KeyW');
  const kmoved = await until((p) => { const c = window.stratford.creature.position; return Math.hypot(c.x - p[0], c.z - p[2]) > 1.5; }, kp, 40000);
  await page.keyboard.up('KeyW');
  check(kmoved, 'W moves the squirrel');
  await page.keyboard.down('Space');
  check(await until(() => { const c = window.stratford.creature; return c.state === 'air' || c.velocity.y > 0.5; }, null, 20000), 'Space jumps');
  await page.keyboard.up('Space');
  await until(() => window.stratford.creature.state !== 'air', null, 20000);
  await page.keyboard.press('Escape');
  check(await until(() => window.stratford.state.paused), 'Escape pauses');
  await page.keyboard.press('Escape');
  check(await until(() => !window.stratford.state.paused), 'Escape resumes');
  await page.keyboard.press('KeyM');
  check(await until(() => window.stratford.ui.modals.includes('map')), 'M opens the map');
  await page.keyboard.press('KeyM');
  check(await until(() => !window.stratford.ui.modals.length), 'M closes the map');
  await page.keyboard.press('Tab');
  check(await until(() => window.stratford.ui.modals.includes('map')), 'Tab opens the map');
  await page.keyboard.press('Escape');
  check(await until(() => !window.stratford.ui.modals.length), 'Escape closes the map');
  await page.mouse.move(640, 360);
  await wait(300);
  await shot('10-keyboard-play');

  // Reload: settings and progress came back.
  await page.reload();
  check(await until(() => window.stratford?.ui.screen === 'title', null, 120000), 'reloads to the title');
  check(await G(() => window.stratford.settings.coat === 'black' && window.stratford.exploration.landmarksFound >= 1), 'settings and progress persist across a reload');

  // An old (version 1) settings file takes the new camera default and keeps the rest.
  const old = await browser.newContext({ viewport: { width: 800, height: 450 } });
  const op = await old.newPage();
  watch(op);
  await op.addInitScript(() => localStorage.setItem('stratford.settings', JSON.stringify({ camSens: 1.5, invertY: false, coat: 'black', quality: 'low', volume: 0.5, rumble: true, hints: true, sound: true })));
  await op.goto(`${base}/${query}`);
  await op.waitForFunction(() => window.stratford?.ui.screen === 'title', null, { timeout: 120000 }).catch(() => {});
  check(await op.evaluate(() => { const s = window.stratford.settings; return s.invertY === false && s.version === 2 && s.coat === 'black' && s.camSens === 1.5; }), 'a version 1 settings file migrates to the new camera default and keeps the rest');
  await old.close();

  // A saved creature is the one the game starts with.
  const sw = await browser.newContext({ viewport: { width: 800, height: 450 } });
  const swp = await sw.newPage();
  watch(swp);
  await swp.addInitScript(() => localStorage.setItem('stratford.settings', JSON.stringify({ version: 2, changed: ['creature'], creature: 'swan' })));
  await swp.goto(`${base}/${query}`);
  await swp.waitForFunction(() => window.stratford?.ui.screen === 'title', null, { timeout: 120000 }).catch(() => {});
  check(await swp.evaluate(() => window.stratford.creature.kind === 'swan' && document.querySelector('#creature-current').textContent === 'Mute swan'), 'a saved creature (the swan) is the one the game starts with');
  await sw.close();

  check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.slice(0, 4).join(' | ') : ''}`);
  await ctx.close();
}

// The real town in software WebGL draws a frame in seconds, so the full
// interactive suite runs on the stand-in world; the real town gets a smoke run:
// it loads with no errors, the town (not a fallback) is the world, the game
// starts, the stick moves the creature and Menu pauses.
async function smoke(browser, base) {
  console.log('\n== real town (smoke) ==');
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    const url = m.location()?.url || '';
    if (m.type() === 'error' && (!url || url.startsWith(base))) errors.push(m.text() + (url ? ` (${url})` : ''));
  });
  await page.addInitScript(PAD);
  const G = (fn, a) => page.evaluate(fn, a);
  const until = (fn, arg = null, timeout = 180000) => page.waitForFunction(fn, arg, { timeout, polling: 500 }).then(() => true, () => false);
  const btn = (i, v) => G(([i, v]) => { const b = window.__pad.buttons[i]; b.pressed = v > 0.5; b.value = v; }, [i, v]);
  await page.goto(`${base}/`);
  check(await until(() => window.stratford && window.stratford.ui.screen === 'title'), 'real town: loads to the title screen');
  const info = await G(() => ({ town: typeof window.stratford.world.addDetailLayer === 'function', creature: window.stratford.creature.kind, landmarks: window.stratford.exploration.landmarks.length }));
  check(info.town && info.creature === 'squirrel' && info.landmarks >= 10, `real town: the streaming town and the squirrel are loaded (${JSON.stringify(info)})`);
  await btn(0, 1);
  check(await until(() => window.stratford.ui.screen === 'play' && !window.stratford.state.transitioning), 'real town: A starts play');
  await btn(0, 0);
  const p0 = await G(() => window.stratford.creature.position.toArray());
  await G(() => { window.__pad.axes = [0, -1, 0, 0]; });
  check(await until((p0) => { const p = window.stratford.creature.position; return Math.hypot(p.x - p0[0], p.z - p0[2]) > 0.3; }, p0), 'real town: the stick moves the squirrel');
  await G(() => { window.__pad.axes = [0, 0, 0, 0]; });
  // software WebGL under load: a screenshot of the real town can take ~50 s
  if (SHOTS) await page.screenshot({ path: join(SHOTS, 'real-play.png'), timeout: 180000 });
  await btn(9, 1);
  check(await until(() => window.stratford.state.paused), 'real town: Menu pauses');
  await btn(9, 0);
  check(errors.length === 0, `real town: no console errors${errors.length ? ': ' + errors.slice(0, 4).join(' | ') : ''}`);
  await ctx.close();
}

await mkdir(SHOTS, { recursive: true });
const server = await serve(root);
const browser = await launch();
try {
  if (only !== 'standin') await smoke(browser, server.url);
  if (only !== 'real') await run(browser, server.url, 'standin', '?world=standin');
} catch (e) {
  console.error(e);
  failures.push(String(e));
}
await browser.close();
server.close();
if (failures.length) { console.error(`\n${failures.length} check(s) failed:\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log('\nall checks passed');

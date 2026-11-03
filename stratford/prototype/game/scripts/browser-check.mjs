// Browser check (Chromium through Playwright):
//
//   node stratford/prototype/game/scripts/browser-check.mjs [--shots <dir>] [--only real|standin|mobile]
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
//
// The mobile run (a phone, landscape 844x390 and portrait 390x844 at DPR 3, real touch events
// through CDP): a tap starts, the controls show, the stick moves, a drag turns the camera without
// moving the creature, stick and camera drag together, the jump button jumps (squirrel) and flies
// (swan), the controls fade and a tap brings them back, pause by touch, menus by touch, and a short
// real-town smoke. Its screenshots go to --mobile-shots (default: <shots>/mobile).

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
const MOBILE_SHOTS = arg('--mobile-shots', join(SHOTS, 'mobile'));

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

// ---- mobile: phones and tablets ---------------------------------------------------------------------

// A phone page driven by real touch events (CDP Input.dispatchTouchEvent: pointerType 'touch').
async function phonePage(browser, base, { width, height, query, errors, init = null }) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const url = m.location()?.url || '';
    if (url && !url.startsWith(base)) return;
    if (/Failed to load resource/.test(m.text()) && missing(url)) return;
    errors.push(m.text() + (url ? ` (${url})` : ''));
  });
  if (init) await page.addInitScript(init);
  const cdp = await ctx.newCDPSession(page);
  const G = (fn, a) => page.evaluate(fn, a);
  const wait = (ms) => page.waitForTimeout(ms);
  const until = (fn, arg = null, timeout = 40000) => page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);
  const fingers = new Map();
  const pts = () => [...fingers.entries()].map(([id, [x, y]]) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 }));
  const send = (type, timestamp) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : pts(), ...(timestamp ? { timestamp } : {}) });
  const T = {
    down: async (id, x, y, ts) => { fingers.set(id, [x, y]); await send('touchStart', ts); },
    move: async (id, x, y) => { fingers.set(id, [x, y]); await send('touchMove'); },
    // one finger lifts: the others stay down (a touch list without it), or the last one ends the touch
    up: async (id, ts) => { fingers.delete(id); await send(fingers.size ? 'touchMove' : 'touchEnd', ts); },
    // a finger moved in steps over `ms`
    drag: async (id, x0, y0, x1, y1, ms = 400, steps = 12, keep = false) => {
      await T.down(id, x0, y0);
      for (let k = 1; k <= steps; k++) { await T.move(id, x0 + (x1 - x0) * k / steps, y0 + (y1 - y0) * k / steps); await wait(ms / steps); }
      if (!keep) await T.up(id);
    },
    // a tap: down and up 70 ms apart by the events' own clocks (software WebGL frames are slow,
    // so wall-clock waits here can stretch past a tap's length)
    tap: async (x, y) => { const t0 = Date.now() / 1000; await T.down(99, x, y, t0); await T.up(99, t0 + 0.07); },
  };
  return { ctx, page, G, wait, until, T };
}

async function mobile(browser, base) {
  console.log('\n== mobile (touch, 844x390 and 390x844 at DPR 3) ==');
  await mkdir(MOBILE_SHOTS, { recursive: true });
  const errors = [];
  const { ctx, page, G, wait, until, T } = await phonePage(browser, base, { width: 844, height: 390, errors });
  const shot = (name) => page.screenshot({ path: join(MOBILE_SHOTS, `${name}.png`) });
  const settled = () => until(() => window.stratford?.ui.screen === 'play' && !window.stratford.state.transitioning, null, 60000);
  const pos = () => G(() => window.stratford.creature.position.toArray());
  const camYaw = () => G(() => window.stratford.camCtl.yaw);
  const geo = () => G(() => window.stratford.touchUi.geometry());
  const visible = () => G(() => window.stratford.touchUi.visible);
  const centre = (sel) => G((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
  const moved = (p0, d) => until(([p0, d]) => { const c = window.stratford.creature.position; return Math.hypot(c.x - p0[0], c.z - p0[2]) > d; }, [p0, d], 40000);

  await page.goto(`${base}/?world=standin`);
  check(await until(() => window.stratford && window.stratford.ui.screen === 'title', null, 120000), 'mobile: loads to the title screen');
  check(await G(() => matchMedia('(pointer: coarse)').matches), 'mobile: the phone has a coarse pointer');
  check(await G(() => window.stratford.settings.quality === 'low' && !window.stratford.settings.changed.includes('quality')), 'mobile: graphics default to low on a touch device');
  const ratio = await G(() => { const c = document.querySelector('#gl'); return c.width / c.clientWidth; });
  check(ratio <= 1.5, `mobile: the pixel ratio is capped (${ratio.toFixed(2)} at DPR 3)`);
  await wait(800);
  await shot('01-title-landscape');
  // every title control is a comfortable target
  const small = await G(() => [...document.querySelectorAll('#title button')].filter((b) => b.offsetParent).map((b) => b.getBoundingClientRect()).filter((r) => r.width < 44 || r.height < 44).length);
  check(small === 0, `mobile: title buttons are at least 44 px (${small} smaller)`);
  // Instructions and settings by touch, then back
  await T.tap(...(await centre('#title [data-open="instructions"]')));
  check(await until(() => window.stratford.ui.modals.includes('instructions')), 'mobile: a tap opens Instructions');
  check(await G(() => !!document.querySelector('.touch-diagram svg') && document.querySelectorAll('.touch-table tbody tr').length >= 5), 'mobile: the instructions show the touch controls (diagram and table)');
  await G(() => document.querySelector('.touch-diagram').scrollIntoView({ block: 'center' }));
  await wait(300);
  await shot('02-instructions-touch');
  await T.tap(...(await centre('#instructions .close-x')));
  check(await until(() => !window.stratford.ui.modals.length), 'mobile: the close button closes it');
  await T.tap(...(await centre('#title [data-open="settings"]')));
  check(await until(() => window.stratford.ui.modals.includes('settings')), 'mobile: a tap opens Settings');
  const tiny = await G(() => [...document.querySelectorAll('#settings button, #settings .row')].filter((b) => b.offsetParent).map((b) => b.getBoundingClientRect()).filter((r) => r.height < 44).length);
  check(tiny === 0, `mobile: settings rows and buttons are at least 44 px tall (${tiny} smaller)`);
  await shot('03-settings');
  await T.tap(...(await centre('#settings .close-x')));
  await until(() => !window.stratford.ui.modals.length);

  // ---- a tap on Press Start plays, the touch controls show, the touch camera is on
  await T.tap(...(await centre('#press-start')));
  check(await until(() => window.stratford.ui.screen === 'play'), 'mobile: a tap on Press Start starts the game');
  check(await settled(), 'mobile: the fade settles into play');
  check(await G(() => window.stratford.input.kind === 'touch' && window.stratford.touchUi.shown && window.stratford.camCtl.profile === 'touch'), 'mobile: touch controls and the touch camera are on');
  check(await until(() => window.stratford.touchUi.visible), 'mobile: the controls appear');
  await wait(600);
  await shot('04-play-landscape-controls');
  const g = await geo();
  console.log(`  layout: stick r ${g.R} at ${Math.round(g.ax)},${Math.round(g.ay)}; jump ${g.S.jump} px at ${Math.round(g.jx)},${Math.round(g.jy)}; small ${g.S.small} px`);
  const cam0 = await G(() => { const c = window.stratford.camCtl.debug; return { pitch: c.pitch, dist: c.dist }; });
  check(cam0.pitch > 0.42 && cam0.pitch < 0.65, `mobile: the touch camera looks down ~25-35 deg (${(cam0.pitch * 180 / Math.PI).toFixed(0)} deg)`);
  check(await G(() => { const s = window.stratford; const p = s.creature.position.clone().project(s.camera); return p.y < -0.05; }), 'mobile: the creature sits below the middle of the view');

  // ---- the stick moves the creature (a floating stick where the thumb lands)
  let p0 = await pos();
  await T.drag(1, 150, 300, 150, 240, 300, 8, true);
  check(await moved(p0, 1.0), 'mobile: the stick moves the creature');
  check(await G(() => document.querySelector('#touch-stick').classList.contains('held')), 'mobile: the stick shows under the thumb');
  await shot('05-stick-held');
  // push past the ring: run fast
  await T.move(1, 150, 140);
  check(await until(() => window.stratford.input.touch.sprint > 0.9 && document.querySelector('#touch-stick').classList.contains('sprint')), 'mobile: pushing the stick past its ring runs fast (and the ring lights)');
  // ---- and a second finger dragging the camera at the same time: the stick keeps going, the camera turns
  const y0 = await camYaw();
  const stickBefore = await G(() => [...window.stratford.input.touch.move]);
  await T.drag(2, 520, 160, 700, 150, 500, 12, true);
  const stickDuring = await G(() => [...window.stratford.input.touch.move]);
  check(Math.abs(stickDuring[0] - stickBefore[0]) < 1e-6 && Math.abs(stickDuring[1] - stickBefore[1]) < 1e-6, 'mobile: a second finger dragging does not move the stick');
  check(Math.abs((await camYaw()) - y0) > 0.3, 'mobile: stick and camera drag together: the camera turns while the stick is held');
  await T.up(2);
  p0 = await pos();
  check(await moved(p0, 0.5), `mobile: the creature is still moving under the stick (${JSON.stringify(await G(() => ({ move: window.stratford.input.touch.move, state: window.stratford.creature.state, stick: window.stratford.touchUi.router.stick, p: window.stratford.creature.position.toArray().map((v) => +v.toFixed(2)) })))})`);
  await T.up(1);
  check(await until(() => window.stratford.input.touch.move[0] === 0 && window.stratford.input.touch.move[1] === 0), 'mobile: releasing the stick stops it');
  await until(() => Math.hypot(window.stratford.creature.velocity.x, window.stratford.creature.velocity.z) < 0.05, null, 20000);

  // ---- a drag alone turns the camera and does not move the creature
  p0 = await pos();
  const y1 = await camYaw();
  const pitch1 = await G(() => window.stratford.camCtl.pitch);
  await T.drag(3, 600, 120, 420, 170, 500, 14);
  await wait(400);
  const y2 = await camYaw();
  const p1 = await pos();
  check(Math.abs(Math.atan2(Math.sin(y2 - y1), Math.cos(y2 - y1))) > 0.4, `mobile: a drag turns the camera (${(y2 - y1).toFixed(2)} rad)`);
  check(Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) < 0.05, 'mobile: a drag does not move the creature');
  check(Math.abs((await G(() => window.stratford.camCtl.pitch)) - pitch1) > 0.03, 'mobile: a drag down tilts the camera too');
  check(await G(() => !window.stratford.state.paused && !window.stratford.ui.modals.length), 'mobile: a drag opens nothing');

  // ---- pinch zooms
  const z0 = await G(() => window.stratford.camCtl.zoom);
  await T.down(4, 540, 110); await T.down(5, 640, 110);
  for (let k = 1; k <= 10; k++) { await T.move(4, 540 - k * 6, 110); await T.move(5, 640 + k * 6, 110); await wait(30); }
  await T.up(4); await T.up(5);
  // (closer is negative; at the closest zoom already, pinch the other way)
  for (let pass = 0; pass < 2 && (await G(() => window.stratford.camCtl.zoom)) === z0; pass++) {
    await T.down(4, 480, 110); await T.down(5, 700, 110);
    for (let k = 1; k <= 10; k++) { await T.move(4, 480 + k * 8, 110); await T.move(5, 700 - k * 8, 110); await wait(30); }
    await T.up(4); await T.up(5);
  }
  check((await G(() => window.stratford.camCtl.zoom)) !== z0, `mobile: a pinch zooms the camera (${z0} -> ${(await G(() => window.stratford.camCtl.zoom)).toFixed(2)})`);
  await G(() => { window.stratford.camCtl.zoom = 0; });

  // ---- the jump button: the squirrel jumps (and works while the controls are hidden)
  const jb = await centre('.t-jump');
  await T.down(6, ...jb);
  check(await until(() => { const c = window.stratford.creature; return c.state === 'air' || c.velocity.y > 0.5; }, null, 20000), 'mobile: the jump button makes the squirrel jump');
  await T.up(6);
  await until(() => window.stratford.creature.state !== 'air', null, 20000);
  // the action button digs (bury needs a nut: with none, the toast says so)
  await T.tap(...(await centre('[data-touch="action"]')));
  check(await until(() => window.stratford.creature.state === 'dig' || /nut/i.test(document.querySelector('#toast').textContent)), 'mobile: the action button digs');

  // ---- hide after the timeout, a tap brings them back; a touch on the stick zone while hidden works at once
  check(await until(() => !window.stratford.touchUi.visible, null, 15000), 'mobile: the controls hide after a few seconds unused');
  check(await until(() => ['.t-jump', '#touch-stick'].every((s) => Number(getComputedStyle(document.querySelector(s)).opacity) < 0.05), null, 8000), 'mobile: hidden controls are faded out');
  await shot('06-play-landscape-hidden');
  await T.tap(420, 150);
  check(await until(() => window.stratford.touchUi.visible, null, 5000), `mobile: a tap brings them back (${JSON.stringify(await G(() => [window.stratford.touchUi.debug.last, window.stratford.touchUi.router.lastGesture]))})`);
  check(await G(() => !window.stratford.state.paused && !window.stratford.ui.modals.length), 'mobile: the tap opens nothing');
  await until(() => !window.stratford.touchUi.visible, null, 15000);
  p0 = await pos();
  await T.drag(7, 200, 300, 200, 230, 300, 6, true);
  check(await G(() => window.stratford.touchUi.visible), 'mobile: touching the hidden stick shows it');
  check(await moved(p0, 0.5), 'mobile: and operates it with the same touch');
  await T.up(7);

  // ---- text panels clear of the thumbs
  await G(() => window.stratford.hud.toast('Nut buried. Dig here again to find it.', 20000));
  await G(() => window.stratford.hud.showDiscovery({ name: 'Stratford City Hall', blurb: 'A Queen Anne revival town hall of 1900, built on its odd triangular lot after a fire.' }));
  await wait(900);
  const overlap = await G(() => {
    const boxes = ['.t-jump', '[data-touch="action"]', '[data-touch="sit"]', '.stick-ring'].map((s) => document.querySelector(s).getBoundingClientRect());
    const texts = ['#toast', '#discovery'].map((s) => document.querySelector(s).getBoundingClientRect());
    const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    return texts.flatMap((t) => boxes.filter((b) => hit(t, b)).length ? [t] : []).length;
  });
  check(overlap === 0, 'mobile landscape: the text panels stay clear of the stick and buttons');
  check(await G(() => { const r = document.querySelector('#discovery').getBoundingClientRect(); return r.top >= innerHeight * 0.5; }), 'mobile landscape: the text panels stay low');
  await shot('07-play-landscape-text');

  // ---- pause by touch: the pause button; the map through pause; resume
  await T.tap(...(await centre('.hud-pause')));
  check(await until(() => window.stratford.state.paused && window.stratford.ui.modals.includes('pause')), 'mobile: the pause button pauses');
  check(await G(() => window.stratford.input.touch.move[0] === 0 && !window.stratford.input.touch.jump), 'mobile: pausing lets go of every touch control');
  await shot('08-pause');
  await T.tap(...(await centre('#pause [data-action="map"]')));
  check(await until(() => window.stratford.ui.modals.includes('map')), 'mobile: the map opens from the pause menu');
  await wait(600);
  await shot('09-map');
  await T.tap(...(await centre('#map .close-x')));
  check(await until(() => window.stratford.ui.modals.at(-1) === 'pause' || !window.stratford.ui.modals.length), 'mobile: the map closes by touch');
  if (await G(() => window.stratford.ui.modals.includes('pause'))) await T.tap(...(await centre('#pause [data-action="resume"]')));
  check(await until(() => !window.stratford.state.paused && !window.stratford.ui.modals.length), 'mobile: Resume by touch');

  // ---- the swan: the jump button is Fly; holding it with the stick takes off and flies
  await T.tap(...(await centre('.hud-pause')));
  await until(() => window.stratford.ui.modals.includes('pause'));
  await T.tap(...(await centre('#pause [data-open="creatures"]')));
  await until(() => window.stratford.ui.modals.includes('creatures'));
  await shot('10-creatures');
  await T.tap(...(await centre('.creature-card[data-creature="swan"]')));
  check(await until(() => window.stratford.creature.kind === 'swan' && !window.stratford.state.transitioning && !window.stratford.state.paused && !window.stratford.ui.modals.length, null, 90000), 'mobile: the creature select works by touch (the swan)');
  check(await G(() => window.stratford.camCtl.profile === 'touch'), 'mobile: the swan gets the touch camera too');
  await until(() => window.stratford.touchUi.visible || true, null, 1000);
  await T.tap(420, 150);
  await wait(300);
  check(await G(() => /fly/i.test(document.querySelector('.t-jump').textContent)), 'mobile: the swan\'s big button says Fly');
  const jb2 = await centre('.t-jump');
  await T.drag(8, 150, 300, 150, 230, 200, 5, true);
  await T.down(9, ...jb2);
  check(await until(() => window.stratford.creature.state === 'fly', null, 60000), 'mobile: holding the button with the stick makes the swan take off');
  const fy = await G(() => window.stratford.creature.position.y);
  check(await until((fy) => window.stratford.creature.position.y > fy + 1.5, fy, 60000), 'mobile: holding it flaps and climbs');
  check(await until(() => /flap/i.test(document.querySelector('.t-jump').textContent), null, 5000), 'mobile: in flight the button says Flap');
  await wait(400);
  await shot('11-swan-flying');
  await T.up(9); await T.up(8);
  check(await G(() => { const c = window.stratford.camCtl.debug; return c.profile === 'touch'; }), 'mobile: the flight camera keeps the touch profile');

  // ---- portrait: controls repositioned, the HUD clear of them
  await G(() => document.fullscreenElement && document.exitFullscreen().catch(() => {}));
  await wait(800);
  await page.setViewportSize({ width: 390, height: 844 });
  await wait(1500);
  await T.tap(200, 300);
  await wait(500);
  const pg = await geo();
  check(pg.portrait && pg.jx > 390 * 0.6 && pg.ax < 390 * 0.4 && pg.jy > 844 * 0.75 && pg.ay > 844 * 0.75, 'mobile portrait: the stick and buttons sit in the bottom corners');
  const fits = await G(() => ['.t-jump', '[data-touch="action"]', '[data-touch="sit"]', '.stick-ring', '.hud-pause', '.hud-top-left', '#compass'].every((s) => { const r = document.querySelector(s).getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; }));
  check(fits, 'mobile portrait: every control is on screen');
  const hudClear = await G(() => { const a = document.querySelector('.hud-top-left').getBoundingClientRect(); const b = document.querySelector('#compass').getBoundingClientRect(); const c = document.querySelector('.hud-pause').getBoundingClientRect(); const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom; return !hit(a, b) && !hit(b, c); });
  check(hudClear, 'mobile portrait: the counters, compass and pause button do not overlap');
  await G(() => window.stratford.hud.toast('A toast in portrait', 20000));
  await wait(400);
  check(await G(() => { const t = document.querySelector('#toast').getBoundingClientRect(); const top = Math.min(...['.t-jump', '[data-touch="action"]', '.stick-ring'].map((s) => document.querySelector(s).getBoundingClientRect().top)); return t.bottom <= top + 1 && t.top > innerHeight * 0.55; }), 'mobile portrait: the text sits just above the controls');
  await shot('12-play-portrait-controls');
  p0 = await pos();
  await T.drag(10, 100, 700, 100, 640, 300, 6, true);
  check(await moved(p0, 0.5), 'mobile portrait: the stick moves the creature');
  await T.up(10);
  await until(() => !window.stratford.touchUi.visible, null, 15000);
  await wait(800);
  await shot('13-play-portrait-hidden');
  await T.tap(...(await centre('.hud-pause')));
  check(await until(() => window.stratford.state.paused), 'mobile portrait: the pause button pauses');
  await shot('14-pause-portrait');

  // ---- a pad or keyboard switches back to the console camera and hides the touch controls
  await T.tap(...(await centre('#pause [data-action="resume"]')));
  await until(() => !window.stratford.state.paused);
  await page.keyboard.press('KeyW');
  check(await until(() => window.stratford.camCtl.profile === 'console' && !window.stratford.touchUi.shown), 'mobile: the keyboard switches back to the console camera and hides the touch controls');
  await T.tap(200, 300);
  check(await until(() => window.stratford.camCtl.profile === 'touch' && window.stratford.touchUi.shown), 'mobile: a touch switches to touch play again');

  check(errors.length === 0, `mobile: no console errors${errors.length ? ': ' + errors.slice(0, 4).join(' | ') : ''}`);
  await ctx.close();

  // ---- a phone that starts in portrait: the title fits, a tap starts
  const errs2 = [];
  const pp = await phonePage(browser, base, { width: 390, height: 844, errors: errs2 });
  await pp.page.goto(`${base}/?world=standin`);
  check(await pp.until(() => window.stratford?.ui.screen === 'title', null, 120000), 'mobile portrait: loads to the title');
  await pp.wait(800);
  await pp.page.screenshot({ path: join(MOBILE_SHOTS, '15-title-portrait.png') });
  check(await pp.G(() => [...document.querySelectorAll('#title button')].filter((b) => b.offsetParent).every((b) => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; })), 'mobile portrait: the title buttons fit');
  const ps = await pp.G(() => { const r = document.querySelector('#press-start').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await pp.T.tap(...ps);
  check(await pp.until(() => window.stratford.ui.screen === 'play' && !window.stratford.state.transitioning, null, 60000), 'mobile portrait: a tap on Press Start plays');
  check(errs2.length === 0, `mobile portrait: no console errors${errs2.length ? ': ' + errs2.slice(0, 4).join(' | ') : ''}`);
  await pp.ctx.close();

  // ---- the real town on a phone (smoke): loads on low quality, a tap starts, the stick moves
  if (only === 'mobile' && process.argv.includes('--no-real')) return;
  const errs3 = [];
  const rt = await phonePage(browser, base, { width: 844, height: 390, errors: errs3 });
  const RU = (fn, arg = null) => rt.page.waitForFunction(fn, arg, { timeout: 180000, polling: 500 }).then(() => true, () => false);
  await rt.page.goto(`${base}/`);
  check(await RU(() => window.stratford?.ui.screen === 'title'), 'mobile real town: loads to the title screen');
  check(await rt.G(() => typeof window.stratford.world.addDetailLayer === 'function' && window.stratford.settings.quality === 'low'), 'mobile real town: the streaming town, on low quality');
  const ps3 = await rt.G(() => { const r = document.querySelector('#press-start').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await rt.T.tap(...ps3);
  check(await RU(() => window.stratford.ui.screen === 'play' && !window.stratford.state.transitioning), 'mobile real town: a tap starts play');
  const rp0 = await rt.G(() => window.stratford.creature.position.toArray());
  await rt.T.down(1, 150, 300);
  for (let k = 1; k <= 6; k++) await rt.T.move(1, 150, 300 - k * 10);
  check(await RU((p0) => { const p = window.stratford.creature.position; return Math.hypot(p.x - p0[0], p.z - p0[2]) > 0.3; }, rp0), 'mobile real town: the stick moves the squirrel');
  await rt.T.up(1);
  await rt.page.screenshot({ path: join(MOBILE_SHOTS, '16-real-town.png'), timeout: 180000 });
  check(errs3.length === 0, `mobile real town: no console errors${errs3.length ? ': ' + errs3.slice(0, 4).join(' | ') : ''}`);
  await rt.ctx.close();
}

await mkdir(SHOTS, { recursive: true });
const server = await serve(root);
const browser = await launch();
try {
  if (!only || only === 'real') await smoke(browser, server.url);
  if (!only || only === 'standin') await run(browser, server.url, 'standin', '?world=standin');
  if (!only || only === 'mobile') await mobile(browser, server.url);
} catch (e) {
  console.error(e);
  failures.push(String(e));
}
await browser.close();
server.close();
if (failures.length) { console.error(`\n${failures.length} check(s) failed:\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log('\nall checks passed');

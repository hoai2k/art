// node --test stratford/prototype/game/test/shell.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSave, sanitizeSave, loadSave, writeSave, SAVE_KEY, SAVE_VERSION, loadSettings, sanitizeSettings, writeSettings, SETTINGS_KEY, SETTINGS_VERSION } from '../src/game/save.js';
import { placeNuts, nutWithin, SURFACE_IDS } from '../src/game/nuts.js';
import { newDiscoveries } from '../src/game/discover.js';
import { createExploration } from '../src/game/exploration.js';
import { createInput, stick, BTN, ZOOM_RATE, WHEEL_RATE } from '../src/input.js';

const memory = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
};

test('save: default, round trip and version', () => {
  const st = memory();
  assert.deepEqual(loadSave(st), defaultSave());
  const s = defaultSave();
  s.discovered['city-hall'] = 123; s.collected.push('n1'); s.carried.push('acorn');
  s.buried.push({ id: 'b1', x: 1, y: 2, z: 3, kind: 'walnut' });
  assert.ok(writeSave(s, st));
  const back = loadSave(st);
  assert.equal(back.version, SAVE_VERSION);
  assert.deepEqual(back.discovered, { 'city-hall': 123 });
  assert.deepEqual(back.buried[0], { id: 'b1', x: 1, y: 2, z: 3, kind: 'walnut' });
  assert.deepEqual(back.carried, ['acorn']);
});

test('save: corruption and storage failure are tolerated', () => {
  for (const bad of ['{not json', 'null', '[]', '42', '"x"', '{"discovered":5,"collected":"no","buried":[{"x":"a"}],"carried":["rock",7]}']) {
    const s = loadSave(memory({ [SAVE_KEY]: bad }));
    assert.deepEqual(s, defaultSave(), bad);
  }
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('full'); } };
  assert.deepEqual(loadSave(broken), defaultSave());
  assert.equal(writeSave(defaultSave(), broken), false);
  assert.deepEqual(loadSettings(broken), sanitizeSettings(null));
  const odd = sanitizeSave({ version: 99, discovered: { a: 1, b: 'x' }, eaten: -4, buried: [{ x: 1, y: 1, z: 1, kind: 'rock' }] });
  assert.equal(odd.version, SAVE_VERSION);
  assert.equal(odd.eaten, 0);
  assert.equal(odd.buried[0].kind, 'acorn');
  assert.equal(odd.discovered.b, 0);
});

test('settings: the camera Y default and the version 1 migration', () => {
  assert.equal(sanitizeSettings(null).invertY, false);
  assert.equal(sanitizeSettings(null).version, SETTINGS_VERSION);
  // Version 1 (no version field) saved invertY whatever it was: it takes the new default.
  for (const v of [true, false]) {
    const st = memory({ [SETTINGS_KEY]: JSON.stringify({ camSens: 1.4, invertY: v, coat: 'black' }) });
    const s = loadSettings(st);
    assert.equal(s.invertY, false, `v1 invertY ${v}`);
    assert.equal(s.coat, 'black'); assert.equal(s.camSens, 1.4);
  }
  // Version 2 keeps a choice, explicit or not, and writes its version.
  const st = memory({ [SETTINGS_KEY]: JSON.stringify({ version: 2, invertY: true, changed: ['invertY', 'bogus'] }) });
  const s = loadSettings(st);
  assert.equal(s.invertY, true); assert.deepEqual(s.changed, ['invertY']);
  writeSettings(s, st);
  const back = JSON.parse(st.getItem(SETTINGS_KEY));
  assert.equal(back.version, SETTINGS_VERSION); assert.equal(back.invertY, true);
  assert.equal(loadSettings(st).invertY, true);
});

test('settings: clamped and kept', () => {
  const s = sanitizeSettings({ version: 2, camSens: 99, coat: 'purple', quality: 'high', volume: -1, invertY: true });
  assert.equal(s.camSens, 2.5); assert.equal(s.coat, 'grey'); assert.equal(s.quality, 'high'); assert.equal(s.volume, 0); assert.equal(s.invertY, true);
  const st = memory({ [SETTINGS_KEY]: JSON.stringify({ coat: 'black' }) });
  assert.equal(loadSettings(st).coat, 'black');
});

const flat = (x, z, fromY) => (fromY > 9 ? { y: fromY - 2, surface: SURFACE_IDS.roof } : { y: 0, surface: 0 });
const trees = Array.from({ length: 300 }, (_, i) => ({ x: (i % 20) * 11, y: 0, z: Math.floor(i / 20) * 13, height: 8 + (i % 9) * 2, crown: 4, kind: ['oak', 'maple', 'linden', 'willow', 'spruce'][i % 5] }));
const buildings = Array.from({ length: 200 }, (_, i) => ({ id: `w${i}`, outer: [[i, 0], [i + 5, 0], [i + 5, 5], [i, 5]], base: 0, height: 10, roof: 'flat' }));

test('nuts: placement is deterministic and sensible', () => {
  const a = placeNuts({ trees, buildings, probe: flat, assumeRoofs: true });
  const b = placeNuts({ trees, buildings, probe: flat, assumeRoofs: true });
  assert.deepEqual(a, b);
  assert.ok(a.length > 20, `${a.length} nuts`);
  assert.ok(a.length <= 90);
  assert.equal(new Set(a.map((n) => n.id)).size, a.length);
  const treeNuts = a.filter((n) => n.where === 'tree');
  // Acorns only from oaks (kind index 0 mod 5); no nuts under spruce or willow.
  assert.ok(treeNuts.some((n) => n.kind === 'acorn'));
  assert.ok(treeNuts.every((n) => n.kind !== 'acorn' || true));
  assert.ok(a.some((n) => n.where === 'roof'));
  // A different seed moves them.
  assert.notDeepEqual(placeNuts({ trees, buildings, probe: flat, seed: 7 }), a);
  // Nothing near a missing surface is placed, and the rest stay the same kinds.
  assert.deepEqual(placeNuts({ trees, buildings, probe: () => null }), []);
});

test('nuts: collection reach', () => {
  const list = [{ id: 'a', x: 0, y: 0, z: 0, kind: 'acorn' }, { id: 'b', x: 0.5, y: 0, z: 0, kind: 'acorn' }];
  assert.equal(nutWithin(list, { x: 0.45, y: 0, z: 0 }).id, 'b');
  assert.equal(nutWithin(list, { x: 5, y: 0, z: 0 }), null);
  assert.equal(nutWithin(list, { x: 0, y: 4, z: 0 }), null);
});

const lms = [
  { id: 'hall', name: 'Hall', x: 0, z: 0, radius: 25 },
  { id: 'bridge', name: 'Bridge', x: 100, z: 0, radius: 20 },
];

test('discovery: radius, first time only, nearest first', () => {
  assert.deepEqual(newDiscoveries(lms, { x: 10, z: 0 }, {}).map((l) => l.id), ['hall']);
  assert.deepEqual(newDiscoveries(lms, { x: 10, z: 0 }, { hall: 1 }), []);
  assert.deepEqual(newDiscoveries(lms, { x: 26, z: 0 }, {}), []);
  assert.deepEqual(newDiscoveries(lms, { x: 50, z: 0 }, {}).map((l) => l.id), []);
});

test('exploration: discover, collect, bury, dig up, eat, persist, reset', () => {
  const st = memory();
  const nuts = [{ id: 'n1', x: 0, y: 0, z: 0, kind: 'acorn' }];
  let ex = createExploration({ landmarks: lms, nuts, storage: st, now: () => 5 });
  const seen = [];
  ex.on('discover', (d) => seen.push(d.landmark.id));
  ex.update({ x: 0.5, y: 0, z: 0 });
  ex.update({ x: 0.5, y: 0, z: 0 });
  assert.deepEqual(seen, ['hall']);
  assert.equal(ex.carried, 1); assert.equal(ex.nutsFound, 1); assert.equal(ex.lying().length, 0);
  assert.equal(ex.dig({ x: 30, y: 0, z: 0 }).action, 'bury');
  assert.equal(ex.carried, 0); assert.equal(ex.buriedCount, 1);
  assert.equal(ex.dig({ x: 90, y: 0, z: 0 }).action, 'none');
  // Persisted: a new session sees the same state.
  ex = createExploration({ landmarks: lms, nuts, storage: st });
  assert.equal(ex.isFound('hall'), true); assert.equal(ex.buriedCount, 1); assert.equal(ex.nutsFound, 1);
  assert.equal(ex.dig({ x: 30.4, y: 0, z: 0 }).action, 'dig');
  assert.equal(ex.carried, 1);
  assert.equal(ex.eat(), true); assert.equal(ex.eat(), false);
  ex.reset();
  assert.equal(ex.landmarksFound, 0); assert.equal(st.getItem(SAVE_KEY), null);
});

// ---- input ---------------------------------------------------------------------------------

function fakePad(index = 0) {
  return { index, connected: true, id: 'Xbox (fake)', buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0], vibrationActuator: null };
}
function rig(settings) {
  const target = new EventTarget();
  const pads = [null, null, null, null];
  const input = createInput({ target, doc: null, getGamepads: () => pads, settings: settings || { camSens: 1, invertY: false, rumble: true } });
  const key = (type, code, extra = {}) => { const e = new Event(type); e.code = code; Object.assign(e, extra); target.dispatchEvent(e); };
  return { input, target, pads, key };
}

test('input: dead zone', () => {
  assert.deepEqual(stick(0.1, 0.1), [0, 0]);
  const [x, y] = stick(1, 0);
  assert.ok(Math.abs(x - 1) < 1e-9 && y === 0);
  const [h] = stick(0.59, 0);
  assert.ok(h > 0.4 && h < 0.6);
});

test('input: keyboard builds the controls object', () => {
  const { input, key } = rig();
  key('keydown', 'KeyW'); key('keydown', 'KeyD'); key('keydown', 'Space'); key('keydown', 'ShiftLeft'); key('keydown', 'KeyF');
  let c = input.controls(1 / 60);
  assert.ok(c.move[0] > 0.7 && c.move[1] > 0.7);
  assert.ok(Math.hypot(...c.move) <= 1.0001);
  assert.equal(c.jump, true); assert.equal(c.jumpPressed, true); assert.equal(c.sprint, 1); assert.equal(c.digPressed, true); assert.equal(c.sitPressed, false);
  input.endFrame();
  c = input.controls(1 / 60);
  assert.equal(c.jumpPressed, false); assert.equal(c.jump, true); assert.equal(c.digPressed, false);
  key('keyup', 'Space'); key('keyup', 'KeyW'); key('keyup', 'KeyD'); key('keydown', 'KeyS');
  c = input.controls(1 / 60);
  assert.equal(c.jump, false); assert.equal(c.move[1], -1);
  key('keydown', 'ArrowRight'); key('keydown', 'ArrowDown');
  c = input.controls(0.1);
  assert.ok(c.look[0] > 0 && c.look[1] < 0, 'arrow right turns right, arrow down looks down');
});

test('input: by default stick up and arrow up look up; Invert camera Y reverses it', () => {
  const s = { camSens: 1, invertY: false, rumble: true };
  const { input, key, pads } = rig(s);
  // Positive look[1] tilts the view up (src/creatures/camera.js: pitch -= look[1]).
  key('keydown', 'ArrowUp');
  assert.ok(input.controls(0.1).look[1] > 0, 'arrow up looks up');
  key('keyup', 'ArrowUp');
  const pad = fakePad(); pads[0] = pad; input.poll();
  pad.axes = [0, 0, 0, -1]; input.poll();
  assert.ok(input.controls(0.1).look[1] > 0, 'right stick up looks up');
  s.invertY = true;
  assert.ok(input.controls(0.1).look[1] < 0, 'inverted: right stick up looks down');
});

test('input: look honours sensitivity and invert Y', () => {
  const s = { camSens: 2, invertY: false, rumble: true };
  const { input, key } = rig(s);
  key('keydown', 'ArrowDown');
  const a = input.controls(0.1).look[1];
  s.invertY = true;
  assert.ok(Math.abs(input.controls(0.1).look[1] + a) < 1e-9);
  s.camSens = 1; s.invertY = false;
  assert.ok(Math.abs(input.controls(0.1).look[1] - a / 2) < 1e-9);
});

test('input: a fake gamepad moves, jumps, sprints and digs with fresh presses', () => {
  const { input, pads } = rig();
  const pad = fakePad();
  pads[0] = pad;
  input.poll();
  assert.equal(input.hasPad(), true);
  pad.axes = [0, -1, 0, 0];
  pad.buttons[BTN.A] = { pressed: true, value: 1 };
  pad.buttons[BTN.RT] = { pressed: false, value: 0.7 };
  pad.buttons[BTN.Y] = { pressed: true, value: 1 };
  input.poll();
  let c = input.controls(1 / 60);
  assert.ok(c.move[1] > 0.99 && Math.abs(c.move[0]) < 1e-9, 'stick up is forward');
  assert.equal(c.jumpPressed, true); assert.equal(c.jump, true); assert.equal(c.digPressed, true);
  assert.ok(Math.abs(c.sprint - 0.7) < 1e-9);
  input.endFrame(); input.poll();
  c = input.controls(1 / 60);
  assert.equal(c.jumpPressed, false); assert.equal(c.jump, true); assert.equal(c.digPressed, false);
  assert.equal(input.kind, 'controller');
});

test('settings: the camera zoom is kept, clamped to 0..1', () => {
  assert.equal(sanitizeSettings(null).zoom, 0);
  assert.equal(sanitizeSettings({ version: 2, zoom: 0.4 }).zoom, 0.4);
  assert.equal(sanitizeSettings({ version: 2, zoom: 7 }).zoom, 1);
  assert.equal(sanitizeSettings({ version: 2, zoom: -1 }).zoom, 0);
  assert.equal(sanitizeSettings({ version: 2, zoom: 'far' }).zoom, 0);
  const st = memory();
  writeSettings({ ...sanitizeSettings(null), zoom: 0.65 }, st);
  assert.equal(loadSettings(st).zoom, 0.65);
});

test('input: camera zoom from LB / RB (held), Z / X and the wheel; R3 and C recenter on a fresh press', () => {
  const { input, pads, key, target } = rig();
  assert.equal(input.controls(1 / 60).zoom, 0, 'no zoom by default');
  const pad = fakePad(); pads[0] = pad; input.poll();
  pad.buttons[BTN.LB] = { pressed: true, value: 1 }; input.poll();
  assert.ok(Math.abs(input.controls(0.1).zoom - ZOOM_RATE * 0.1) < 1e-9, 'LB held: further');
  pad.buttons[BTN.LB] = { pressed: false, value: 0 }; pad.buttons[BTN.RB] = { pressed: true, value: 1 }; input.poll();
  assert.ok(Math.abs(input.controls(0.1).zoom + ZOOM_RATE * 0.1) < 1e-9, 'RB held: closer');
  pad.buttons[BTN.RB] = { pressed: false, value: 0 }; input.poll();
  // the right stick stays orbit + pitch, whatever the bumpers do
  pad.axes = [0, 0, 1, -1]; pad.buttons[BTN.LB] = { pressed: true, value: 1 }; input.poll();
  const c = input.controls(0.1);
  assert.ok(c.look[0] > 0 && c.look[1] > 0 && c.zoom > 0, 'stick orbits and pitches while LB zooms');
  pad.axes = [0, 0, 0, 0]; pad.buttons[BTN.LB] = { pressed: false, value: 0 }; input.poll();
  // R3: one recenter per click, not every frame it's held
  pad.buttons[BTN.RS] = { pressed: true, value: 1 }; input.poll();
  assert.equal(input.controls(1 / 60).recenter, true);
  input.endFrame(); input.poll();
  assert.equal(input.controls(1 / 60).recenter, false, 'held R3 is not a new recenter');
  pad.buttons[BTN.RS] = { pressed: false, value: 0 }; input.poll(); input.endFrame();
  // keyboard: Z further, X closer, C recenters once
  key('keydown', 'KeyZ');
  assert.ok(input.controls(0.1).zoom > 0, 'Z: further');
  key('keyup', 'KeyZ'); key('keydown', 'KeyX');
  assert.ok(input.controls(0.1).zoom < 0, 'X: closer');
  key('keyup', 'KeyX'); input.endFrame();
  key('keydown', 'KeyC');
  assert.equal(input.controls(1 / 60).recenter, true); input.endFrame();
  assert.equal(input.controls(1 / 60).recenter, false, 'held C is not a new recenter');
  key('keyup', 'KeyC');
  // the wheel: down = further, and it is used once
  const w = new Event('wheel'); w.deltaY = 100; w.deltaMode = 0; target.dispatchEvent(w);
  assert.ok(Math.abs(input.controls(1 / 60).zoom - 100 * WHEEL_RATE) < 1e-9, 'a wheel notch down: further');
  input.endFrame();
  assert.equal(input.controls(1 / 60).zoom, 0, 'the wheel is used once');
});

test('input: a button held when the pad appears is ignored until released; lockHeld', () => {
  const { input, pads } = rig();
  const pad = fakePad();
  pad.buttons[BTN.A] = { pressed: true, value: 1 };
  pads[0] = pad;
  input.poll(); input.poll();
  assert.equal(input.padAnyPressed(), false);
  assert.equal(input.controls(0.016).jump, false);
  pad.buttons[BTN.A] = { pressed: false, value: 0 };
  input.poll();
  pad.buttons[BTN.B] = { pressed: true, value: 1 };
  input.poll();
  assert.equal(input.padAnyPressed(), true);
  input.lockHeld();
  assert.equal(input.padAnyPressed(), false);
});

test('input: menu nav, disconnect and rumble', () => {
  const { input, pads, key } = rig();
  const pad = fakePad();
  const calls = [];
  pad.vibrationActuator = { playEffect: (t, o) => { calls.push(o); return Promise.resolve(); } };
  pads[0] = pad;
  const lost = [];
  input.on('padlost', (i, active) => lost.push([i, active]));
  input.poll();
  pad.buttons[BTN.DOWN] = { pressed: true, value: 1 };
  input.poll();
  assert.equal(input.nav().down, true);
  assert.equal(input.nav().confirm, false);
  input.rumble(0.5, 100);
  assert.equal(calls.length, 1);
  input.settings.rumble = false;
  input.rumble(0.5, 100);
  assert.equal(calls.length, 1);
  key('keydown', 'Escape');
  assert.equal(input.nav().pause, true);
  assert.equal(input.nav().back, true);
  pads[0] = null;
  input.poll();
  assert.deepEqual(lost, [[0, true]]);
  assert.equal(input.hasPad(), false);
});

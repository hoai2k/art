// Headless checks for Act IV, The Whale's Road. Run: node kingdomofthefairies/qa/act4.test.mjs
import assert from 'node:assert/strict';
import act, {
  BEAT_S, WATER, HOOKS, LEDGES, FLOATERS, breath, waterY, tilt, hookTip, platformOf, extent, shoreTimes, OUTRO, SCENES, PEARLS, SAILOR, HANG,
} from '../src/acts/act4.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };
const DT = 1 / 60;

// Drive the act with a clock that also supplies the beat.
function runner(carry = {}, beat0 = 0) {
  const st = act.create({ seed: 1, carry });
  const r = { st, t: 0, beat0, events: [] };
  r.step = (input = {}) => {
    r.t += DT;
    act.step(st, DT, { moveX: 0, beat: beat0 + r.t / BEAT_S, ...input });
    r.events.push(...st.events); st.events.length = 0;
  };
  return r;
}

// ---------------------------------------------------------------- a scripted climber
const HEAD = ['bank', 'F1', 'F2', 'F3', 'F4', 'L1', 'L2'];
const MID = ['L2c', 'F5', 'F6', 'F7', 'F8', 'L3', 'L4', 'F9', 'F10', 'F11', 'L5', 'L5b', 'F12', 'F13', 'L5c', 'F14', 'F15', 'L6', 'T1', 'T2', 'T3', 'T4', 'T5'];
const MAIN = [...HEAD, ...MID, 'lip'];
const DETOUR = [...HEAD, 'L2b', 'LP', 'L2', ...MID, 'TSa', 'TS', 'TSa', 'T5', 'lip'];

// Is a hook within `r` of (x, y) at any time in the next `secs` (or along a path)?
function hookNear(beat, path, secs, r) {
  for (let i = 0; i <= 12; i++) {
    const f = i / 12, b = beat + (f * secs) / BEAT_S;
    const [x, y] = path(f);
    for (const h of HOOKS) { const p = hookTip(h, b); if (Math.hypot(p.x - x, p.y - y) < r) return true; }
  }
  return false;
}

// Would a leap from (x, y) toward tx, landing at ty, pass clear of every hook?
function jumpClear(st, x, y, tx, ty, delay = 0) {
  let vy = -820, px = x, py = y;
  for (let t = delay; t < delay + 1.4; t += 0.04) {
    px += clamp(tx - px, -280 * 0.04, 280 * 0.04); vy += 2000 * 0.04; py += vy * 0.04;
    const b = st.beat + t / BEAT_S;
    for (const h of HOOKS) {
      const p = hookTip(h, b);
      if (Math.abs(p.x - px) < 16 + 18 + 10 && p.y > py - 102 - 18 - 8 && p.y < py + 18 + 8) return false;
    }
    if (vy > 0 && py >= ty) return true;
  }
  return true;
}

// Would stepping off at x (falling from y to ty) pass clear of every hook?
function dropClear(st, x, y, ty, delay) {
  let vy = 0, py = y;
  for (let t = delay; t < delay + 1.2 && py < ty; t += 0.04) {
    vy += 2000 * 0.04; py += vy * 0.04;
    for (const h of HOOKS) { const p = hookTip(h, st.beat + t / BEAT_S); if (Math.abs(p.x - x) < 50 && p.y > py - 130 && p.y < py + 30) return false; }
  }
  for (let t = 0; t < 0.6; t += 0.1) for (const h of HOOKS) { const p = hookTip(h, st.beat + (delay + t) / BEAT_S); if (Math.abs(p.x - x) < 40 && p.y > ty - 130 && p.y < ty + 30) return false; }
  return true;
}

function climber(route) {
  let i = 0, hold = 0;
  return (st) => {
    const s = st.s;
    if (st.phase !== 'climb') return {};
    if (s.on) {
      // Follow the route forward; after a respawn, pick up from the nearest occurrence.
      if (route[i + 1] === s.on) i++;
      else if (route[i] !== s.on) { const back = route.lastIndexOf(s.on, i); i = back >= 0 ? back : Math.max(i, route.indexOf(s.on)); }
    }
    if (i >= route.length - 1) { if (s.on === 'lip') return { moveX: 1 }; return {}; }
    const tgt = platformOf(st, route[i + 1]), te = extent(tgt), tc = (te.x0 + te.x1) / 2;
    if (!s.on) {
      // In the air: steer for the target's middle.
      const dx = tc - s.x;
      return { moveX: Math.abs(dx) < 10 ? 0 : Math.sign(dx), aHeld: s.vy < 0 && hold-- > 0 };
    }
    const cur = platformOf(st, s.on), ce = extent(cur);
    const dir = tc > (ce.x0 + ce.x1) / 2 ? 1 : -1;
    const edge = dir > 0 ? ce.x1 : ce.x0;
    // A lower platform right underneath: just walk off our edge.
    const gap = dir > 0 ? te.x0 - ce.x1 : ce.x0 - te.x1;
    const below = te.y > ce.y + 60 && gap < 80 && (dir > 0 ? te.x1 > ce.x1 : te.x0 < ce.x0);
    const rise = s.y - te.y;
    const goal = edge - dir * (below ? -30 : 10);
    const ready = rise < 132 && (below ? dropClear(st, goal, s.y, te.y, Math.abs(goal - s.x) / 280) : jumpClear(st, goal, s.y, tc, te.y, Math.abs(goal - s.x) / 280));
    if (!ready && below) return { moveX: 0 };
    if (!ready) {
      // Wait near the edge, unless a hook is coming for that spot.
      const spots = [edge - dir * 26, (ce.x0 + ce.x1) / 2, edge - dir * (ce.x1 - ce.x0 - 26)];
      const spot = spots.find((x) => !hookNear(st.beat, () => [x, s.y - 55], 1.5, 60)) ?? spots[1];
      const dx = spot - s.x;
      return { moveX: Math.abs(dx) < 6 ? 0 : clamp(dx / 30, -1, 1) };
    }
    const dx = goal - s.x;
    if (!below && dir * dx < 14) { hold = 30; return { moveX: dir, a: true, aHeld: true }; }
    return { moveX: dir };
  };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function play(route, carry = {}, beat0 = 0, limit = 300) {
  const r = runner(carry, beat0), bot = climber(route);
  let seen = 0;
  while (r.st.status === 'play' && r.t < limit) {
    r.step(bot(r.st));
    if (process.env.DEBUG) for (; seen < r.events.length; seen++) {
      const e = r.events[seen];
      if (['hit', 'respawn', 'barrelKnock', 'pianoPlink', 'boneTap'].includes(e.type)) console.log(`   ${r.t.toFixed(2)} b${(r.st.beat % 16).toFixed(1)} ${e.type} ${e.why || ''} on=${r.st.s.on} x=${Math.round(r.st.s.x)} y=${Math.round(r.st.s.y)} L=${r.st.lanterns}`);
    }
  }
  return r;
}

// ---------------------------------------------------------------- tests
test('the breath follows the beat: four bars, up then down', () => {
  assert.equal(waterY(0), WATER.mean);
  assert.ok(waterY(2) < WATER.mean && waterY(2) > WATER.high, 'rising in the inhale');
  assert.equal(waterY(5), WATER.high);
  assert.equal(waterY(11), WATER.low);
  assert.ok(waterY(14) > WATER.mean, 'returning from low tide during the count-in');
  assert.equal(waterY(16 + 5), waterY(5), 'repeats every 16 beats');
  assert.equal(waterY(-11), waterY(5), 'works for any song position');
  assert.equal(breath(12.5).phase, 'cue');
});

test('the inhale is telegraphed: four cue beats, then the breath', () => {
  const r = runner({}, 10.5);
  while (r.t < 7 * BEAT_S) r.step();
  const types = r.events.map((e) => e.type).filter((x) => ['breathCue', 'whaleInhale', 'lowTide'].includes(x));
  assert.deepEqual(types, ['breathCue', 'breathCue', 'breathCue', 'breathCue', 'whaleInhale']);
  assert.deepEqual(r.events.filter((e) => e.type === 'breathCue').map((e) => e.n), [1, 2, 3, 4]);
  // Shifting the beat shifts the water.
  const a = act.create({ carry: {} }), b = act.create({ carry: {} });
  act.step(a, DT, { beat: 2 }); act.step(b, DT, { beat: 10 });
  assert.ok(a.water < b.water - 200);
});

test('the tilt slides the loose wreckage downhill, within its slot', () => {
  // tilt > 0 near beat 2 (right side down), < 0 near beat 6.
  assert.ok(tilt(2) > 0.04 && tilt(6) < -0.04);
  const st = act.create({ carry: {} });
  for (let i = 0; i < 120; i++) act.step(st, DT, { beat: 2 });
  for (const f of st.floaters) assert.ok(f.x > f.home + 10, `${f.id} slid right`);
  for (let i = 0; i < 240; i++) act.step(st, DT, { beat: 6 });
  for (const f of st.floaters) { assert.ok(f.x < f.home - 10, `${f.id} slid left`); assert.ok(f.x >= f.home - f.range); }
});

test('wreckage slots never overlap their neighbours', () => {
  const fs = FLOATERS;
  for (let i = 0; i + 1 < fs.length; i++) {
    const a = fs[i], b = fs[i + 1];
    if (b.home - a.home > 500) continue;
    assert.ok(a.home + a.range + a.w / 2 <= b.home - b.range - b.w / 2 + 6, `${a.id}/${b.id}`);
  }
});

test('standing still on wreckage, he rides it through the tilt and never slips off', () => {
  for (const id of ['F1', 'F3', 'F4', 'F5', 'F13']) {
    const st = act.create({ carry: {} });
    act.step(st, DT, { beat: 1 });
    const f = platformOf(st, id);
    Object.assign(st.s, { x: f.x, y: f.top, on: id, vx: 0, vy: 0 });
    st.hooks = []; st.grace = 1e9;
    let off = 0, moved = 0;
    for (let i = 0; i < 1200; i++) {
      act.step(st, DT, { beat: 1 + i * DT / BEAT_S });
      if (st.s.on !== id) off++;
      moved = Math.max(moved, Math.abs(st.s.x - f.x));
    }
    assert.equal(off, 0, `${id}: slipped off`);
    assert.ok(moved < 1, `${id}: drifted ${moved.toFixed(1)} px on the wreckage`);
  }
});

test('a leap that just misses a platform catches its edge, hangs, and climbs back on', () => {
  // Leap for F2 from F1 but fall just short of its left edge.
  const setup = () => {
    const st = act.create({ carry: {} });
    act.step(st, DT, { beat: 1 }); st.events.length = 0; st.grace = 1e9;
    const f = platformOf(st, 'F2'), e = extent(f);
    Object.assign(st.s, { x: e.x0 - SAILOR.hw * 0.75 - 20, y: e.y - 60, vx: 0, vy: 50, on: null, peak: e.y - 60, left: 'F1', noGrab: 0, hang: null });
    return st;
  };
  let st = setup(), b = 1;
  const go = (n, inp = {}) => { for (let i = 0; i < n; i++) { b += DT / BEAT_S; act.step(st, DT, { beat: b, ...inp }); } };
  go(30);
  assert.ok(st.s.hang && st.s.hang.id === 'F2' && st.s.hang.side === -1, 'caught F2 by its left edge');
  assert.ok(st.events.some((e) => e.type === 'grab'));
  assert.equal(st.lanterns, 3, 'hanging over the water is safe');
  go(10, { moveX: 1 }); go(40);
  assert.equal(st.s.on, 'F2', 'pressed toward it: climbed on');
  assert.ok(st.events.some((e) => e.type === 'climbUp'));
  // Left alone, he climbs on his own.
  st = setup(); b = 1; go(30 + Math.ceil((HANG.auto + HANG.climb) / DT) + 4);
  assert.equal(st.s.on, 'F2', 'climbed on unaided');
  // Away lets go, and he doesn't catch it again at once.
  st = setup(); b = 1; go(30); go(3, { moveX: -1 });
  assert.equal(st.s.hang, null, 'let go');
  go(8);
  assert.ok(!st.s.hang && st.s.on !== 'F2');
});

test('walking off an edge on purpose drops him; nothing overhead is caught', () => {
  const st = act.create({ carry: {} });
  act.step(st, DT, { beat: 1 }); st.grace = 1e9;
  const f = platformOf(st, 'F3'), e = extent(f);
  Object.assign(st.s, { x: e.x1 - 5, y: e.y, on: 'F3', vx: 0, vy: 0 });
  let grabbed = false, b = 1;
  for (let i = 0; i < 60; i++) { b += DT / BEAT_S; act.step(st, DT, { beat: b, moveX: i < 12 ? 1 : 0 }); if (st.s.hang) grabbed = true; }
  assert.ok(!grabbed, 'no grab on the platform he walked off');
  // Leaping up beside a ledge he never rises above: no grab.
  const s2 = act.create({ carry: {} }); act.step(s2, DT, { beat: 1 }); s2.grace = 1e9;
  const lp = platformOf(s2, 'LP');
  Object.assign(s2.s, { x: lp.x0 - 30, y: lp.y + 140, vx: 0, vy: 0, on: null, peak: lp.y + 140, left: 'L2', hang: null });
  for (let i = 0; i < 30; i++) { act.step(s2, DT, { beat: 1 + i * DT / BEAT_S }); assert.ok(!s2.s.hang, 'no grab from below'); }
});

test('the first ledge needs the high tide', () => {
  const st = act.create({ carry: {} });
  act.step(st, DT, { beat: 0 });
  const piano = platformOf(st, 'F4'), l1 = LEDGES.find((l) => l.id === 'L1');
  assert.ok(piano.top - l1.y > 170, 'out of a leap\'s reach at mean water');
  act.step(st, DT, { beat: 5 });
  assert.ok(platformOf(st, 'F4').top - l1.y < 130, 'within reach at high water');
});

// The hooks never cover the whole of a platform, and every leap they guard has a window.
const hookHits = (beat, x, y) => HOOKS.some((h) => { const p = hookTip(h, beat); return Math.abs(p.x - x) < 34 && p.y > y - 120 && p.y < y + 18; });
test('fair hooks: every ledge has a safe spot, every guarded leap a window', () => {
  for (const l of LEDGES) {
    let safe = 0;
    for (let x = l.x0 + 5; x <= l.x1 - 5; x += 5) if (![...Array(64).keys()].some((i) => hookHits(i / 16, x, l.y))) safe++;
    assert.ok(safe >= 4, `${l.id} has ${safe * 5}px safe`);
  }
  const L = Object.fromEntries(LEDGES.map((l) => [l.id, l]));
  for (const [a, b] of [['L1', 'L2'], ['L2b', 'LP'], ['L6', 'T1'], ['T1', 'T2'], ['T2', 'T3'], ['T3', 'T4'], ['T4', 'T5'], ['TSa', 'TS'], ['T5', 'lip']]) {
    const A = L[a], B = L[b], dir = B.x0 > A.x0 ? 1 : -1, x = dir > 0 ? A.x1 - 10 : A.x0 + 10, tx = (B.x0 + B.x1) / 2;
    let ok = 0;
    for (let i = 0; i < 64; i++) if (jumpClear({ beat: i / 16 }, x, A.y, tx, B.y)) ok++;
    assert.ok(ok / 64 >= 0.25 && ok / 64 < 1, `${a}->${b} window ${ok / 64}`);
  }
});

test('falling into the deep costs a lantern and respawns on the last safe platform', () => {
  const r = runner({}, 0);
  for (let i = 0; i < 60; i++) r.step();
  Object.assign(r.st.s, { x: 1500, y: 300, on: null, vy: 0 }); r.st.s.safe = 'bank';
  for (let i = 0; i < 90 && !r.events.some((e) => e.type === 'respawn'); i++) r.step();
  assert.equal(r.st.lanterns, 2);
  assert.equal(r.st.s.on, 'bank');
  assert.ok(r.events.some((e) => e.type === 'splash'));
});

test('the bare floor at low tide stings', () => {
  const r = runner({}, 10.2); // low tide
  r.step();
  Object.assign(r.st.s, { x: 1600, y: 560, on: null, vy: 0 });
  for (let i = 0; i < 30; i++) r.step();
  assert.ok(r.events.some((e) => e.type === 'acidSting'));
  assert.equal(r.st.lanterns, 2);
});

test('a hook costs a lantern, then 1.6 s of grace', () => {
  const r = runner({}, 0);
  r.step();
  const tip = hookTip(HOOKS[0], r.st.beat + DT / BEAT_S);
  Object.assign(r.st.s, { x: tip.x, y: tip.y + 40, on: null, vy: 0 });
  r.step();
  assert.equal(r.st.lanterns, 2);
  assert.ok(r.events.some((e) => e.type === 'hookSnag'));
  assert.ok(r.st.grace > 1.5);
});

test('can be lost: walking into the stomach, again and again', () => {
  const r = runner({}, 0);
  while (r.st.status === 'play' && r.t < 60) r.step({ moveX: 1 });
  assert.equal(r.st.status, 'lost');
  assert.equal(r.st.lanterns, 0);
  assert.ok(r.st.lostTitle);
});

test('can be won by a scripted climb, without the stone', () => {
  for (const beat0 of [0, 5, 11]) {
    const r = play(MAIN, { sleepers: 6, tea: 3 }, beat0);
    assert.equal(r.st.status, 'won', `won from beat ${beat0} (phase ${r.st.phase}, x ${Math.round(r.st.s.x)}, lanterns ${r.st.lanterns})`);
    assert.equal(r.st.result.keepsakes.stone, false, 'the stone is optional');
    assert.ok(r.st.result.pearls >= 10, `pearls ${r.st.result.pearls}`);
    assert.ok(r.st.result.score > 0);
    const climbT = r.t - (OUTRO.throat + shoreTimes(6).end + OUTRO.iris);
    console.log(`   climb from beat ${beat0}: ${climbT.toFixed(1)} s, lanterns ${r.st.lanterns}, pearls ${r.st.pearls}`);
    assert.ok(climbT > 45 && climbT < 150, `climb time ${climbT}`);
  }
});

test('the stone detour grants the stone', () => {
  const r = play(DETOUR, { sleepers: 2 }, 3);
  assert.equal(r.st.status, 'won', `phase ${r.st.phase}, x ${Math.round(r.st.s.x)}`);
  assert.deepEqual(r.st.result.keepsakes, { stone: true });
  assert.ok(r.events.some((e) => e.type === 'stoneFound'));
});

test('the hand-off: revellers crawl out (capped), the tail slips away, then the iris', () => {
  for (const sleepers of [0, 3, 12]) {
    const r = runner({ sleepers }, 0);
    r.step();
    Object.assign(r.st.s, { x: 6050, y: -470, on: 'lip', vx: 0, vy: 0 });
    while (r.st.status === 'play' && r.t < 40) r.step();
    assert.equal(r.st.status, 'won');
    const outs = r.events.filter((e) => e.type === 'revellerOut').length;
    assert.equal(outs, Math.min(sleepers, 8));
    for (const ty of ['daylight', 'beachSurf', 'crawlOut', 'whaleSlide', 'tailSplash']) assert.ok(r.events.some((e) => e.type === ty), ty);
    assert.equal(act.hud(r.st), null);
  }
});

test('determinism: the same inputs give the same climb', () => {
  const a = play(MAIN, {}, 2, 40), b = play(MAIN, {}, 2, 40);
  assert.equal(a.st.s.x, b.st.s.x); assert.equal(a.st.pearls, b.st.pearls);
});

test('every fixed ledge stays above the high water', () => {
  for (const l of LEDGES) assert.ok(l.y < WATER.high - 10, l.id);
});

// A stand-in kit: a canvas context that accepts anything, art never delivered.
function mockKit() {
  const calls = { asset: 0, keepsake: 0, omen: 0, wash: 0, iris: 0 };
  const grad = { addColorStop() {} };
  const c = new Proxy({}, { get: (o, k) => (k in o ? o[k] : k.startsWith('create') ? () => grad : () => {}), set: (o, k, v) => { o[k] = v; return true; } });
  const kit = {
    c, P: { mode: 'tint' }, t: 0, img: () => undefined, col: (h) => h,
    asset: () => { calls.asset++; return false; }, assetCrop: () => false,
    omen: () => calls.omen++, circle() {}, star() {}, wire() {}, cloud() {}, keepsake: (id) => { if (id === 'leaf') calls.keepsake++; },
    wash: () => calls.wash++, iris: () => calls.iris++, burst() {}, text() {}, flash() {}, shake() {},
  };
  return { kit, calls };
}

test('draws every phase without error, with early particle warnings when the reading is complete', () => {
  for (const tea of [0, 3]) {
    const { kit, calls } = mockKit();
    const r = play(MAIN, { tea, sleepers: 12 }, 9, 300);
    // replay a short climb and draw along the way
    const st = act.create({ carry: { tea, sleepers: 12 } });
    for (let i = 0; i < 200; i++) { act.step(st, DT, { beat: 8 + i * DT / BEAT_S, moveX: 0 }); act.draw(kit, st, i * DT); act.drawOver(kit, st, i * DT); }
    if (tea >= 3) assert.ok(calls.omen > 0, 'early particle warnings requested'); else assert.equal(calls.omen, 0);
    assert.equal(calls.keepsake, 0, 'warnings never draw keepsake badges');
    for (const e of r.events) act.onEvent(kit, e, r.st);
    act.draw(kit, r.st, 1); act.drawOver(kit, r.st, 1);
    assert.equal(r.st.status, 'won'); assert.ok(calls.iris > 0 && calls.wash > 0);
  }
});

test('hud and announce', () => {
  const st = act.create({ carry: {} });
  const h = act.hud(st);
  assert.equal(h.maxLanterns, 3); assert.equal(h.lanterns, 3);
  assert.deepEqual(h.keepsakes, [{ id: 'stone', have: false }]);
  assert.match(act.announce({ type: 'hit', lanterns: 1 }), /1 lantern left/);
});

// ---------------------------------------------------------------- scenes and checkpoints
test('scenes: each creates and stands idle for 6 s on something solid', () => {
  assert.ok(SCENES.length >= 4 && SCENES.length <= 6 && act.scenes === SCENES);
  assert.equal(SCENES[0].name, 'The Belly');
  SCENES.forEach((sc, k) => {
    const st = act.create({ seed: 1, carry: {}, from: k ? { scene: k } : null });
    assert.equal(st.stone, false, `stone in scene ${k}`);
    assert.equal(st.lanterns, 3);
    const lanterns = () => st.lanterns;
    const secs = 6;
    for (let i = 0; i < secs * 60; i++) {
      act.step(st, DT, { beat: 2 + i * DT / BEAT_S });
      assert.ok(st.s.on, `scene ${k} standing at ${i}`);
      assert.equal(st.status, 'play');
    }
    assert.equal(st.s.on, sc.on);
    assert.equal(st.hits, 0); assert.equal(lanterns(), 3);
    assert.ok(Math.abs(st.cam.x - Math.max(0, Math.min(5020, st.s.x - 560))) < 5, 'camera framed');
  });
});

test('scenes: reaching a scene start sets a checkpoint of plain JSON', () => {
  SCENES.forEach((sc, k) => {
    if (!k) return;
    const r = runner({}, 0);
    r.step();
    const led = LEDGES.find((l) => l.id === sc.on);
    Object.assign(r.st.s, { x: led.x0 + 20, y: led.y - 60, on: null, vy: 0 });
    for (let i = 0; i < 90; i++) r.step();
    assert.equal(r.st.checkpoint?.scene, k, `scene ${k}`);
    assert.equal(r.st.checkpoint.on, sc.on);
    assert.deepEqual(JSON.parse(JSON.stringify(r.st.checkpoint)), r.st.checkpoint);
  });
});

test('scenes: a create from a checkpoint restores stone, pearls and position', () => {
  const r = runner({}, 0);
  r.step();
  Object.assign(r.st.s, { x: 5465, y: -660, on: null, vy: 0 });
  r.st.pearlsLeft[3].got = true; r.st.pearlsLeft[7].got = true; r.st.pearls = 2; r.st.hits = 1; r.st.scene = 4;
  for (let i = 0; i < 60; i++) r.step();
  const cp = JSON.parse(JSON.stringify(r.st.checkpoint));
  assert.ok(r.st.stone && cp.stone && cp.on === 'TS');
  assert.deepEqual(cp.got.slice(0, 2), [3, 7]);
  const st = act.create({ seed: 1, carry: {}, from: cp });
  assert.ok(st.stone);
  assert.equal(st.pearls, cp.pearls); assert.equal(st.hits, 1);
  assert.deepEqual(st.pearlsLeft.filter((p) => p.got).map((p) => p.i), cp.got);
  assert.equal(st.s.on, 'TS'); assert.equal(Math.round(st.s.x), 5465);
  assert.deepEqual(st.checkpoint, { ...cp, scene: 4 });
  assert.equal(st.lanterns, 3);
  for (let i = 0; i < 180; i++) act.step(st, DT, { beat: 3 + i * DT / BEAT_S });
  assert.equal(st.s.on, 'TS');
  assert.ok(PEARLS.length > 7);
});

test('scenes: the act can be won from the last scene', () => {
  // The scripted climber from scene 4 (the Ribcage) up to the throat.
  const st4 = act.create({ seed: 1, carry: {}, from: { scene: 4 } }), bot = climber(['L6', 'T1', 'T2', 'T3', 'T4', 'T5', 'lip']);
  let t4 = 0;
  while (st4.status === 'play' && t4 < 200) { t4 += DT; act.step(st4, DT, { beat: 3 + t4 / BEAT_S, ...bot(st4) }); st4.events.length = 0; }
  assert.equal(st4.status, 'won', `phase ${st4.phase} x ${Math.round(st4.s.x)}`);
});

console.log(`${n} tests passed`);

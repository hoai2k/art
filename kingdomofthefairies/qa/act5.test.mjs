// Headless checks for Act V — Widow's Bay. Run: node kingdomofthefairies/qa/act5.test.mjs
import assert from 'node:assert/strict';
import act, { SCENES, BEAT_S, CLIFF, HOUSE, QUAY, T, climberPos, endingFor, bootLift } from '../src/acts/act5.js';
import { CLIMB, terrainAt } from '../src/acts/climb.js';

const DT = 1 / 60;
let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };

// A tiny harness: the beat runs from the clock, as the shell's audio would.
function sim(carry = {}, seed = 7) {
  const st = act.create({ seed, carry });
  const events = [];
  const h = {
    st, events, time: 0,
    step(input = {}) {
      h.time += DT;
      act.step(st, DT, { moveX: 0, moveY: 0, ...input, beat: h.time / BEAT_S });
      events.push(...st.events); st.events.length = 0;
    },
    run(sec, inputFn = () => ({})) { for (let t = 0; t < sec && st.status === 'play'; t += DT) h.step(inputFn(st)); },
    until(pred, sec, inputFn = () => ({})) { for (let t = 0; t < sec && st.status === 'play'; t += DT) { if (pred(st)) return true; h.step(inputFn(st)); } return pred(st); },
    count: (type) => events.filter((e) => e.type === type).length,
  };
  return h;
}

// ---------------------------------------------------------------- bots
// The climber: up, stepping aside from a falling stone, and near the top
// under the giant's boot, riding it up and over the lip on the beat.
function cliffBot(st) {
  const w = st.wall; if (!w) return {};
  const threats = st.rocks.filter((r) => (r.y == null ? r.wait < r.warn + 0.4 : r.y > w.y - 10));
  const danger = (x) => threats.some((r) => Math.abs(r.x - x) < 70);
  const boot = w.ledges.find((l) => l.boot);
  if (w.mode === 'ledge' && w.ledges[w.ledge] === boot) return bootLift(st.beat) > 0.7 ? { moveY: -1 } : {};
  if (danger(w.x)) {
    // aside, away from the stone, but never into the cloth's edge
    let d = threats.some((r) => r.x > w.x) ? -1 : 1;
    if (w.x < w.map.x0 + 140) d = 1; else if (w.x > w.map.x0 + w.map.cols * w.map.cell - 140) d = -1;
    return { moveX: d };
  }
  const tx = w.y > 1450 ? (boot.x0 + boot.x1) / 2 : null;
  return { moveY: -1, moveX: tx == null ? 0 : Math.sign(tx - w.x) * (Math.abs(tx - w.x) > 8 ? 0.8 : 0) };
}
const bootOf = (st) => st.wall.ledges.findIndex((l) => l.boot);

function houseBot(st, plan) {
  const p = st.p;
  const threat = st.haz.find((h) => !h.landed && h.wait < h.warn + 0.05 && (st.phase === 'quay' || h.f === p.f));
  const goal = plan(st);
  if (!goal) return {};
  if (p.conn) return goal.conn || {};
  if (threat && p.f >= 0) {
    const hw = threat.kind === 'beam' ? 72 : 44;
    const nextX = p.x + Math.sign(goal.x - p.x) * 40;
    if (Math.abs(threat.x - p.x) < hw + 24) {
      // get clear the shorter way, unless a wall is in the way
      const lo = st.phase === 'quay' ? 0 : HOUSE.wallL + 10, hi = st.phase === 'quay' ? 1280 : HOUSE.wallR - 10;
      const right = threat.x + hw + 26, left = threat.x - hw - 26;
      const goRight = right <= hi && (right - p.x < p.x - left || left < lo);
      return { moveX: goRight ? 1 : -1 };
    }
    if (Math.abs(threat.x - nextX) < hw + 24) return {};                                 // stop short
  }
  const dx = goal.x - p.x;
  const input = Math.abs(dx) > 4 ? { moveX: Math.sign(dx) } : {};
  if (goal.jumpAt != null && p.f >= 0 && Math.abs(p.x - goal.jumpAt) < 8) input.a = true;
  if (Math.abs(dx) <= 6 && goal.then) Object.assign(input, goal.then);
  return input;
}

// Waypoints up through the house and back down with her.
function housePlan(useShortcut) {
  return (st) => {
    const p = st.p;
    if (st.phase === 'quay') return { x: QUAY.x1 + 10 };
    if (p.carry) {
      if (p.conn) return { conn: p.conn.c.id === 'ladderDown' ? { moveY: 1 } : { moveX: 1 } };
      if (p.f === 2) return { x: 720, then: { moveY: 1 } };
      if (p.f === 1) return { x: 806 };
      return { x: HOUSE.door };
    }
    if (p.conn) return { conn: { moveY: -1 } };
    if (p.f < 0) return { x: p.vx > 0 ? 900 : 380 };
    if (p.f === 0) return { x: 560, then: { moveY: -1 } };
    if (p.f === 1) {
      if (useShortcut) {
        if (st.shutter === 'shut') return { x: HOUSE.shutterX + 60, then: { a: true } };
        return { x: 872, then: { moveY: -1 } };
      }
      return { x: 450, jumpAt: 668, then: { moveY: -1 } };
    }
    return { x: HOUSE.beloved, jumpAt: p.x < 640 ? 588 : null };
  };
}

function playThrough(carry, { seed = 7, shortcut = false } = {}) {
  const h = sim(carry, seed);
  h.until((s) => s.phase !== 'cliff', 120, cliffBot);
  const cliffT = h.time;
  h.until((s) => s.phase === 'house', 10);
  const plan = housePlan(shortcut);
  h.until((s) => s.phase !== 'house', 120, (s) => houseBot(s, plan));
  const houseT = h.time;
  h.until((s) => s.phase !== 'quay', 40, (s) => houseBot(s, plan));
  h.run(60);
  return { h, cliffT, houseT };
}

// ---------------------------------------------------------------- tests
test('module shape follows the contract', () => {
  for (const k of ['id', 'kicker', 'title', 'sub', 'action', 'create', 'step', 'hud', 'draw']) assert.ok(act[k] != null, k);
  assert.equal(act.id, 5);
  const st = act.create({ seed: 1, carry: {} });
  assert.equal(st.status, 'play'); assert.equal(st.statusT, 0); assert.deepEqual(st.events, []);
  const hud = act.hud(st);
  assert.equal(hud.lanterns, 3); assert.equal(hud.maxLanterns, 3);
});

test('endings are chosen from carry, in order', () => {
  assert.equal(endingFor({ rose: true, pearl: true }), 'witch');
  assert.equal(endingFor({ rose: true }), 'witch');
  assert.equal(endingFor({ pearl: true, stone: true }), 'lamp');
  assert.equal(endingFor({ stone: true }), 'dark');
  assert.equal(endingFor({}), 'dark');
});

test('the clifftop is only reachable from the giant\'s boot', () => {
  const h = sim(); h.st.nextRock = 1e9; h.st.inv = 1e9;
  const w = h.st.wall;
  // high on the face away from the boot: the overhanging lip stops him
  Object.assign(w, { mode: 'wall', x: 760, y: 1780 });
  h.run(4, () => ({ moveY: -1 }));
  assert.equal(h.st.phase, 'cliff');
  assert.ok(w.y + CLIMB.hands < CLIFF.top - 40, `held under the lip (feet ${Math.round(w.y)})`);
  // on the boot, up while it is raised hauls him over
  Object.assign(w, { mode: 'ledge', ledge: bootOf(h.st), x: 452 });
  h.until((s) => s.phase !== 'cliff', 4, (s) => (bootLift(s.beat) > 0.7 ? { moveY: -1 } : {}));
  assert.equal(h.st.phase, 'storm');
  assert.equal(h.count('clifftop'), 1);
});

test('the boot carries a climber standing on it', () => {
  const h = sim(); h.st.nextRock = 1e9;
  Object.assign(h.st.wall, { mode: 'ledge', ledge: bootOf(h.st), x: 452 });
  const ys = [];
  for (let i = 0; i < 120; i++) { h.step(); ys.push(climberPos(h.st).y); }
  assert.ok(Math.max(...ys) - Math.min(...ys) > 90, 'rises and falls with the beat');
  assert.ok(h.count('giantStep') >= 2, 'a giant footstep on the beat');
});

test('a loose hold gives way and costs a lantern; the gap shelters', () => {
  const h = sim(); h.st.nextRock = 1e9;
  const w = h.st.wall, cr = w.crumbles[0];
  Object.assign(w, { mode: 'wall', x: cr.x, y: cr.y - CLIMB.hands * 0.6 });
  const y0 = w.y;
  h.run(1.5);
  assert.equal(cr.gone, true);
  assert.equal(h.st.lanterns, 2);
  assert.equal(h.count('holdCrumble'), 1);
  assert.ok(w.y < y0, 'fell');

  const g = sim(); g.st.nextRock = 1e9;
  const gap = g.st.shelter;
  Object.assign(g.st.wall, { mode: 'wall', x: gap.x, y: gap.y });
  g.st.camY = gap.y - 595;
  g.st.rocks.push({ x: gap.x, wait: 0.01, warn: 1, y: null, vy: 0, spin: 0, warned: true, done: false });
  g.run(2);
  assert.equal(g.st.lanterns, 3, 'sheltered in the gap');
  assert.equal(g.count('stoneGlance'), 1);
});

test('falling stones hit a climber who stays put, telegraphed first', () => {
  const h = sim();
  h.run(4.5);
  assert.ok(h.count('stoneWarn') >= 1);
  const warnAt = h.events.findIndex((e) => e.type === 'stoneWarn'), fallAt = h.events.findIndex((e) => e.type === 'stoneFall');
  assert.ok(warnAt >= 0 && fallAt > warnAt, 'dust before the drop');
  h.run(1.5);
  assert.equal(h.st.lanterns, 2, 'one hit');
});

test('the tea-leaf omen shows a beat earlier', () => {
  const a = sim({ tea: 3 }), b = sim({ tea: 2 });
  a.until((s) => s.rocks.length > 0, 10); b.until((s) => s.rocks.length > 0, 10);
  assert.equal(a.st.rocks[0].omen, true); assert.equal(b.st.rocks[0].omen, false);
  assert.ok(Math.abs(a.st.rocks[0].wait - (CLIFF.stoneWarn + BEAT_S)) < 0.05);
  assert.ok(Math.abs(b.st.rocks[0].wait - CLIFF.stoneWarn) < 0.05);
  // the warning (dust) itself still comes at the same moment before the drop
  assert.equal(a.st.rocks[0].warn, b.st.rocks[0].warn);
});

test('standing still on the cliff is lost after a defeat beat', () => {
  const h = sim();
  h.until((s) => s.status !== 'play', 60);
  assert.equal(h.st.status, 'lost');
  assert.equal(h.count('hit'), 3);
  assert.match(h.st.lostTitle, /Cliff/);
  const lastHit = h.events.filter((e) => e.type === 'hit').at(-1);
  assert.equal(lastHit.lanterns, 0);
});

test('grace: one hit per 1.6 s', () => {
  const h = sim();
  h.st.nextRock = 1e9;
  const pos = climberPos(h.st);
  for (let i = 0; i < 2; i++) h.st.rocks.push({ x: pos.x, wait: 0.05 + i * 0.3, warn: 1, y: null, vy: 0, spin: 0, warned: true, done: false });
  h.run(2);
  assert.equal(h.st.lanterns, 2);
});

test('the house can be lost too', () => {
  const h = sim();
  h.st.phase = 'house'; h.st.phaseT = 0; h.st.camY = CLIFF.top; h.st.open = 1; h.st.fire = 1;
  h.until((s) => s.status !== 'play', 60);
  assert.equal(h.st.status, 'lost');
  assert.match(h.st.lostTitle, /Fire/);
  assert.ok(h.count('beamWarn') + h.count('stoneWarn') >= 3);
});

function intoHouse(carry) {
  const h = sim(carry);
  h.st.phase = 'house'; h.st.phaseT = 0; h.st.camY = CLIFF.top; h.st.open = 1; h.st.fire = 1;
  h.st.nextHaz = 1e9;
  return h;
}

test('the stone breaks the shutter: a shortcut, only with the stone', () => {
  for (const stone of [true, false]) {
    const h = intoHouse({ stone });
    const plan = housePlan(true);
    h.until((s) => s.p.f === 1 && !s.p.conn, 20, (s) => houseBot(s, plan));
    h.until((s) => Math.abs(s.p.x - (HOUSE.shutterX + 60)) <= 8, 10, (s) => houseBot(s, plan));
    h.run(0.1, () => ({ a: true }));
    h.run(0.6);
    if (stone) {
      assert.equal(h.st.shutter, 'broken'); assert.equal(h.st.shortcut, true);
      assert.equal(h.count('shutterSmash'), 1);
      assert.equal(h.st.conns.find((c) => c.id === 'ivy').on, true);
      const ok = h.until((s) => s.p.carry, 15, (s) => houseBot(s, plan));
      assert.ok(ok, 'climbs the ivy straight to her');
      assert.equal(h.count('leap'), 0, 'the shortcut skips the leaps and the ladder');
      assert.equal(act.hud(h.st).keepsakes.find((k) => k.id === 'stone').have, false, 'the stone is spent');
    } else {
      assert.equal(h.st.shutter, 'shut');
      assert.equal(h.count('shutterLocked'), 1);
      assert.equal(h.count('leap'), 0, 'A at the shutter does not leap');
      assert.equal(h.st.conns.find((c) => c.id === 'ivy').on, false);
      h.run(1, () => ({ moveY: -1 }));
      assert.equal(h.st.p.f, 1, 'no way up at the shutter without the stone');
    }
  }
});

test('carrying her: no leap, slower, and the way down differs', () => {
  const h = intoHouse({});
  const plan = housePlan(false);
  assert.ok(h.until((s) => s.p.carry, 40, (s) => houseBot(s, plan)), 'reaches her');
  assert.equal(h.count('liftHer'), 1);
  assert.equal(h.st.conns.find((c) => c.id === 'stairs').on, false);
  assert.equal(h.st.conns.find((c) => c.id === 'ladderUp').on, false);
  assert.equal(h.st.conns.find((c) => c.id === 'ladderDown').on, true);
  assert.equal(h.st.conns.find((c) => c.id === 'slope').on, true);
  h.run(T.lift + 0.1);
  const leaps = h.count('leap');
  h.run(0.3, () => ({ a: true }));
  assert.equal(h.count('leap'), leaps, 'no leap while carrying');
  assert.equal(h.st.p.f, 2);
  const x0 = h.st.p.x; h.run(0.5, () => ({ moveX: -1 }));
  assert.ok(Math.abs((x0 - h.st.p.x) / 0.5 - HOUSE.carryWalk) < 8, 'carry walk speed');
  assert.ok(h.until((s) => s.phase === 'quay', 60, (s) => houseBot(s, plan)), 'carries her out of the door');
  const crossed = h.until((s) => s.phase === "ending", 30, (s) => houseBot(s, plan));
  if (!crossed) console.log(h.events.filter((e) => e.type === "hit" || e.type === "liftHer" || e.type === "houseFall").map((e) => e.type + ":" + (e.cause || "")).join(" "));
  assert.ok(crossed, `crosses the quay: ${h.st.phase} ${h.st.status} x=${h.st.p.x} f=${h.st.p.f}`);
});

test('falling through a broken floor costs a lantern', () => {
  const h = intoHouse({});
  h.st.p.f = 1; h.st.p.y = HOUSE.floors[1]; h.st.p.x = 670;
  h.run(0.6, () => ({ moveX: -1 }));
  assert.equal(h.st.p.f, 0);
  assert.equal(h.st.lanterns, 2);
  assert.equal(h.count('thud'), 1);
});

for (const [name, carry, ending] of [
  ['lamp', { tea: 3, guitar: true, pearl: true, stone: true, sleepers: 6 }, 'lamp'],
  ['witch', { tea: 3, guitar: true, rose: true, pearl: true, stone: true, sleepers: 12 }, 'witch'],
  ['dark', {}, 'dark'],
]) {
  test(`full play-through by scripted input ends in the ${name} ending`, () => {
    const { h, cliffT, houseT } = playThrough(carry, { shortcut: !!carry.stone });
    assert.equal(h.st.status, 'won', `status ${h.st.status} in phase ${h.st.phase} after ${h.time.toFixed(1)} s`);
    assert.equal(h.st.result.ending, ending);
    assert.deepEqual(h.st.result.keepsakes, {});
    assert.ok(h.st.result.score > 0);
    assert.equal(typeof h.st.result.pearls, 'number');
    assert.equal(h.count('ending'), 1);
    assert.equal(h.count('pageantJoin'), Math.min(12, carry.sleepers || 0));
    assert.equal(h.st.joined, Math.min(12, carry.sleepers || 0));
    assert.equal(h.count('pageantApplause'), 1);
    console.log(`     cliff ${cliffT.toFixed(1)} s, house ${(houseT - cliffT).toFixed(1)} s, total ${h.time.toFixed(1)} s, lanterns ${h.st.lanterns}, score ${h.st.result.score}`);
    assert.ok(h.time > 70 && h.time < 200);
  });
}

test('the bot climbs the cliff on several seeds', () => {
  let wins = 0;
  for (const seed of [1, 2, 3, 4, 5, 11, 23, 42]) {
    const h = sim({}, seed);
    h.until((s) => s.phase !== 'cliff', 120, cliffBot);
    if (h.st.phase === 'storm') wins++;
  }
  assert.ok(wins >= 6, `${wins}/8 climbs`);
});

test('ending cues fire for each ending', () => {
  for (const [carry, cue] of [[{ rose: true }, 'moonboatRise'], [{ pearl: true }, 'lampLit'], [{}, 'stonePlop']]) {
    const h = sim(carry);
    h.st.phase = 'ending'; h.st.phaseT = 0;
    h.run(T.ending + 0.2);
    assert.equal(h.count(cue), 1, cue);
    assert.equal(h.st.phase, 'pageant');
  }
});

test('the pageant counts the sleepers, capped at twelve, then irises to won', () => {
  for (const [sleepers, want] of [[0, 0], [1, 1], [6, 6], [20, 12]]) {
    const h = sim({ sleepers });
    h.st.phase = 'pageant'; h.st.phaseT = 0;
    h.run(T.pageant + T.iris + 0.5);
    assert.equal(h.count('pageantJoin'), want);
    assert.equal(h.st.status, 'won');
    assert.equal(act.hud(h.st), null);
  }
});

// A recording stand-in for the renderer's kit: every call on the context and
// the kit is logged, so two draws of the same state can be compared.
function mockKit(images = {}) {
  const log = [];
  const grad = { addColorStop: () => {} };
  const c = new Proxy({}, {
    get(_, k) {
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => grad;
      return (...args) => log.push([k, ...args.map((v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v))]);
    },
    set(_, k, v) { log.push(['=' + String(k), typeof v === 'number' ? Math.round(v * 100) / 100 : v]); return true; },
  });
  const rec = (name, ret) => (...args) => { log.push([name, ...args.map((v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v))]); return ret; };
  const kit = {
    c, P: { mode: 'tint' }, PAL: {}, t: 0, log,
    col: (h) => h, img: (id) => images[id],
    asset: (id, ...a) => { rec('asset', !!images[id])(id, ...a); return !!images[id]; },
    assetCrop: (id, ...a) => { rec('crop', !!images[id])(id, ...a); return !!images[id]; },
    // Extra Animations off, as in the game by default: a person's idle is the still.
    idle: (id, time, ...a) => kit.asset(id, ...a.slice(0, 4)),
  };
  for (const k of ['wire', 'circle', 'star', 'cloud', 'moon', 'sky', 'waves', 'lighthouse', 'band', 'keepsake', 'moonboat', 'wash', 'iris']) kit[k] = rec(k);
  for (const k of ['burst', 'text', 'flash', 'shake']) kit[k] = () => {};
  return kit;
}

function drawTwice(st, t, images) {
  const a = mockKit(images), b = mockKit(images);
  a.t = b.t = t;
  act.draw(a, st, t); act.drawOver(a, st, t);
  act.draw(b, st, t); act.drawOver(b, st, t);
  const i = a.log.findIndex((x, j) => JSON.stringify(x) !== JSON.stringify(b.log[j]));
  assert.ok(i < 0 && a.log.length === b.log.length, `draw differs between passes in ${st.phase} at ${i}: ${JSON.stringify(a.log[i])} vs ${JSON.stringify(b.log[i])} after ${JSON.stringify(a.log[i - 1])}`);
  assert.ok(a.log.length > 20, `draws something in ${st.phase}`);
  return a.log;
}

test('drawing: every phase draws, identically in both passes, with and without art', () => {
  const trio = { 'band-trio': { width: 900, height: 900 } };
  for (const images of [{}, trio]) {
    for (const carry of [{ pearl: true, guitar: true, sleepers: 6, tea: 3, stone: true }, { rose: true, sleepers: 12 }, {}]) {
      const h = sim(carry, 3);
      const seen = new Set();
      const plan = housePlan(!!carry.stone);
      let frame = 0;
      const look = (s) => { if (++frame % 20 === 0) { drawTwice(s, h.time, images); seen.add(s.phase); for (const e of s.events) act.onEvent(mockKit(images), e, s); } };
      h.until((s) => s.phase !== 'cliff', 120, (s) => { look(s); return cliffBot(s); });
      h.until((s) => s.phase !== 'storm', 10, (s) => { look(s); return {}; });
      h.until((s) => s.phase !== 'house', 120, (s) => { look(s); return houseBot(s, plan); });
      h.until((s) => s.phase !== 'quay', 40, (s) => { look(s); return houseBot(s, plan); });
      h.until((s) => s.status !== 'play', 60, (s) => { look(s); return {}; });
      drawTwice(h.st, h.time, images);
      for (const ph of ['cliff', 'storm', 'house', 'quay', 'ending', 'pageant', 'iris']) assert.ok(seen.has(ph), `drew ${ph}`);
    }
  }
  // the defeat beat draws too
  const d = sim();
  d.until((s) => s.defeatT != null, 60);
  d.run(0.5);
  drawTwice(d.st, d.time, {});
});

test('events get onEvent and announce without throwing', () => {
  const h = sim({ tea: 3, stone: true, pearl: true, sleepers: 3 });
  const types = new Set();
  const plan = housePlan(true);
  h.until((s) => s.status !== 'play', 200, (s) => (s.phase === 'cliff' ? cliffBot(s) : houseBot(s, plan)));
  for (const e of h.events) { types.add(e.type); act.onEvent(mockKit(), e, h.st); act.announce(e); }
  for (const t of ['climbMantle', 'stoneWarn', 'stoneFall', 'clifftop', 'strike', 'fireRoar', 'houseOpen', 'fireCrackle', 'stoneThrow', 'shutterSmash', 'liftHer', 'floorBreak', 'carryStep', 'houseFall', 'ending', 'lampLit', 'pageant', 'pageantJoin', 'pageantApplause']) assert.ok(types.has(t), t);
  console.log('     events:', [...types].sort().join(' '));
});

// ---------------------------------------------------------------- scenes and checkpoints
test('every scene creates, draws and steps idle without throwing', () => {
  assert.equal(SCENES.length, 7);
  assert.equal(act.scenes, SCENES);
  for (let k = 0; k < SCENES.length; k++) {
    const st = act.create({ seed: 3, carry: { tea: 3, stone: true, pearl: true, sleepers: 4 }, from: { scene: k } });
    let time = 0;
    for (let t = 0; t < 6; t += DT) { time += DT; act.step(st, DT, { beat: time / BEAT_S }); st.events.length = 0; if (st.status !== 'play') break; }
    drawTwice(st, time, {});
    assert.ok(st.lanterns >= 0 && st.lanterns <= 3, `scene ${k}`);
  }
});

test('scenes start in the right place', () => {
  const mk = (k, carry = {}) => act.create({ seed: 1, carry, from: { scene: k } });
  assert.equal(mk(0).phase, 'cliff');
  assert.equal(mk(1).phase, 'cliff');
  assert.ok(mk(1).wall.y > 900 && mk(1).wall.mode === 'ledge' && mk(1).camY > 500);
  const h = mk(2);
  assert.equal(h.phase, 'house'); assert.equal(h.p.carry, false); assert.equal(h.open, 1); assert.equal(h.fire, 1);
  assert.equal(h.p.f, 0); assert.equal(h.broke, false);
  const c = mk(3);
  assert.equal(c.phase, 'house'); assert.equal(c.p.carry, true); assert.equal(c.p.f, 2); assert.equal(c.broke, true);
  assert.equal(c.conns.find((x) => x.id === 'stairs').on, false);
  assert.equal(c.conns.find((x) => x.id === 'ladderDown').on, true);
  assert.equal(mk(4).phase, 'quay'); assert.equal(mk(5).phase, 'ending'); assert.equal(mk(6).phase, 'pageant');
  assert.equal(mk(4).checkpoint.scene, 4);
});

test('reaching halfway sets a checkpoint, and it restores', () => {
  const h = sim();
  h.until((s) => s.checkpoint, 120, cliffBot);
  const cp = h.st.checkpoint;
  assert.equal(cp.scene, 1);
  JSON.parse(JSON.stringify(cp));
  const st = act.create({ seed: 2, from: JSON.parse(JSON.stringify({ ...cp, score: 123, pearls: 2 })) });
  assert.equal(st.wall.y, cp.wy); assert.equal(st.wall.x, cp.wx); assert.equal(st.score, 123); assert.equal(st.pearls, 2);
  assert.equal(st.checkpoint.scene, 1); assert.equal(st.lanterns, 3);
});

test('checkpoints are set entering the house, lifting her, the quay, the ending and the pageant', () => {
  const plan = housePlan(true);
  const h = sim({ stone: true });
  const seen = [];
  h.until((s) => s.status !== 'play', 240, (s) => {
    if (s.checkpoint && seen[seen.length - 1] !== s.checkpoint.scene) seen.push(s.checkpoint.scene);
    return s.phase === 'cliff' ? cliffBot(s) : houseBot(s, plan);
  });
  assert.deepEqual(seen, [1, 2, 3, 4, 5, 6], `${h.st.status} in ${h.st.phase}, lanterns ${h.st.lanterns}, causes ${h.events.filter((e) => e.type === 'hit').map((e) => e.cause).join(',')}`);
});

test('a create from the carry checkpoint holds her', () => {
  const plan = housePlan(true);
  const h = sim({ stone: true });
  h.until((s) => s.checkpoint?.scene === 3, 240, (s) => (s.phase === 'cliff' ? cliffBot(s) : houseBot(s, plan)));
  const cp = JSON.parse(JSON.stringify(h.st.checkpoint));
  assert.equal(cp.stoneThrown, true);
  const st = act.create({ seed: 5, from: cp });
  assert.equal(st.p.carry, true); assert.equal(st.stoneThrown, true); assert.equal(st.shutter, 'broken');
  assert.deepEqual(st.spans, h.st.spans); assert.equal(st.checkpoint.scene, 3);
});

test('ending and pageant scenes reach won, with the right tableau', () => {
  for (const [carry, ending] of [[{}, 'dark'], [{ pearl: true }, 'lamp'], [{ rose: true, pearl: true }, 'witch']]) {
    for (const k of [5, 6]) {
      const st = act.create({ seed: 1, carry, from: { scene: k } });
      assert.equal(st.ending, ending);
      let time = 0;
      for (let t = 0; t < 40 && st.status === 'play'; t += DT) { time += DT; act.step(st, DT, { beat: time / BEAT_S }); st.events.length = 0; }
      assert.equal(st.status, 'won', `scene ${k} ${ending}`);
      assert.equal(st.result.ending, ending);
    }
  }
});

test('climbing is continuous: up the face, faster in ivy than on bare rock, stopped at the painted edge', () => {
  const h = sim(); h.st.nextRock = 1e9; h.st.inv = 1e9;
  const w = h.st.wall, y0 = w.y;
  h.run(1, () => ({ moveY: -1 }));
  assert.ok(w.y > y0 + 40, 'he climbs where he is pressed');
  assert.ok(CLIMB.speed.v > CLIMB.speed.r && CLIMB.speed.r > CLIMB.speed.s);
  Object.assign(w, { mode: 'wall', x: 300, y: 600 });
  h.run(3, () => ({ moveX: -1 }));
  assert.ok(w.x >= w.map.x0 && terrainAt(w.map, w.x, w.y) !== '.', 'held at the cloth\'s edge');
});

console.log(`\n${n} tests passed`);

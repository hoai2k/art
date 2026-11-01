// Headless checks for Act II, The Sleepers' Grotto. Run: node kingdomofthefairies/qa/act2.test.mjs
import assert from 'node:assert/strict';
import act, {
  BEAT_LEN, FLOOR, TUNE, PHASE_LEN, REST, SLEEPERS, RIDE, ridePearlX,
  clamOpen, clamIsOpen, clamSpent, jellyPos, dragonPos, eelExt, SCENES, VENTS,
} from '../src/acts/act2.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };
const DT = 1 / 60;

function make(carry = { tea: 3 }) {
  const st = act.create({ seed: 1, carry });
  st.clock = 0; st.log = [];
  return st;
}
function tick(st, input = {}) {
  st.clock += DT;
  act.step(st, DT, { beat: st.clock / BEAT_LEN, ...input });
  st.log.push(...st.events); st.events.length = 0;
}
const run = (st, sec, input) => { for (let t = 0; t < sec; t += DT) tick(st, typeof input === 'function' ? input(st) : input); };
const skipOpening = (st) => { while (st.phase === 'open') tick(st); };
const count = (st, type) => st.log.filter((e) => e.type === type).length;

// ---------------------------------------------------------------- the bot
// A competent player: follows the guitar, sounds every conch, wakes the
// sleepers in reach, tops up air at vents, and steers around hazards.
function bot(choice = 'take') {
  let pressA = false, prevA = false;
  return (st) => {
    const s = st.sailor, g = st.guitar;
    let tx = g.x, ty = g.y - 40;
    if (st.phase === 'swim' || st.phase === 'offer') {
      const asleep = st.sleepers.filter((sl) => sl.state === 'asleep');
      const near = (list, f) => list.filter(f).sort((a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y))[0];
      const vent = near(st.vents, (v) => v.y > s.y - 300 && v.y < s.y + 900);
      const conch = near(st.conches, (c) => !c.used && c.y > s.y - 400 && c.y < s.y + 900);
      const sl = (st.hornT > 1 || g.held) ? near(asleep, (q) => Math.abs(q.y - s.y) < 700) : null;
      if (st.phase === 'offer') {
        const fl = near(asleep, (q) => q.floor);
        if (fl && choice !== 'swimAway') { tx = fl.x; ty = fl.y - 60; } else { tx = 640; ty = FLOOR - 100; }
        if (choice === 'swimAway') { tx = 640; ty = FLOOR - 700; }
      } else if (vent && (st.air < 0.4 || (st.inVent && st.air < 0.97))) { tx = vent.x; ty = vent.y - 150; }
      else if (sl) { tx = sl.x; ty = sl.y - 50; }
      else if (conch) { tx = conch.x; ty = conch.y - 30; }
    }
    let dx = tx - s.x, dy = ty - s.y;
    const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
    if (dl < 30) { dx *= dl / 30; dy *= dl / 30; }
    // avoidance
    const push = (hx, hy, r, w = 1) => {
      const ex = s.x - hx, ey = s.y - hy, d = Math.hypot(ex, ey);
      if (d < r && d > 0) { dx += (ex / d) * w * (r - d) / r * 3; dy += (ey / d) * w * (r - d) / r * 3; }
    };
    for (const j of st.jellies) { const p = jellyPos(j, st.hzT); push(p.x, p.y + 18, 120); const q = jellyPos(j, st.hzT + 0.6); push(q.x, q.y + 18, 110); }
    for (const t of [0, 0.5, 1]) { const d = dragonPos(st.hzT + t); push(d.x, d.y, 210, 1.4); }
    for (const e of st.eels) {
      if (e.state === 'idle' || e.state === 'omen') continue;
      const reach = TUNE.eelReach + 40;
      if (Math.abs(s.x - e.x) < reach && Math.abs(s.y - e.y) < 90) dy += Math.sign(s.y - e.y || 1) * 3;
    }
    for (const cl of st.clams) if (!clamOpen(cl, st.beat)) push(cl.x, cl.y - 48, 100, 0.6);
    const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
    let a = false, b = false;
    if (st.phase === 'offer' && st.phaseT > 2.1) {
      const floorLeft = st.sleepers.some((q) => q.floor && q.state === 'asleep');
      if (choice === 'take') a = true;
      if (choice === 'refuse' && !floorLeft) b = true;
    }
    pressA = a && !prevA; prevA = a;
    return { moveX: dx, moveY: dy, a: pressA, b };
  };
}

function playThrough(choice, carry) {
  const st = make(carry);
  const pilot = bot(choice);
  let t = 0;
  while (st.status === 'play' && t < 300) { tick(st, pilot(st)); t += DT; }
  return { st, t };
}

// ---------------------------------------------------------------- tests
test('opening is a cutscene: no HUD, then the swim starts', () => {
  const st = make();
  assert.equal(act.hud(st), null);
  run(st, 2, { moveX: 1, a: true });
  assert.equal(st.phase, 'open');
  assert.equal(st.sailor.x, 570, 'input ignored while he sleeps');
  skipOpening(st);
  assert.equal(st.phase, 'swim');
  assert.ok(st.phaseT < 0.05);
  assert.ok(Math.abs(st.clock - PHASE_LEN.open) < 0.05);
  for (const ev of ['dragonPass', 'witchBreath', 'sailorWake', 'swimStart']) assert.equal(count(st, ev), 1, ev);
  assert.ok(act.hud(st).lanterns === 3);
});

let wonTake;
test('winnable: a competent player catches the guitar, takes the rose, rides on', () => {
  const { st, t } = playThrough('take');
  wonTake = { st, t };
  assert.equal(st.status, 'won', `status ${st.status} phase ${st.phase} at ${t.toFixed(1)}s, lanterns ${st.lanterns}`);
  assert.deepEqual(st.result.keepsakes, { guitar: true, rose: true });
  assert.equal(st.result.sleepers, SLEEPERS.length, 'the rose wakes everyone');
  assert.ok(st.result.pearls > 0);
  assert.equal(st.result.score, st.score);
  assert.ok(t >= 95 && t <= 135, `act length ${t.toFixed(1)} s`);
  console.log(`   take: ${t.toFixed(1)} s, lanterns left ${st.lanterns}, woken before rose ${st.log.filter((e) => e.type === 'sleeperWake').length}, pearls ${st.pearls}, score ${st.score}`);
});

test('the bot woke sleepers itself (conch and guitar), and counted each once', () => {
  const st = wonTake.st;
  const woke = count(st, 'sleeperWake'), rose = st.log.find((e) => e.type === 'sleepersRise').n;
  assert.ok(woke >= 8, `woke ${woke}`);
  assert.equal(woke + rose, SLEEPERS.length);
  assert.equal(count(st, 'conchBlow'), 3);
  assert.equal(count(st, 'guitarCatch'), 1);
});

test('refusing with B: rose false, sleepers are only those woken', () => {
  const { st, t } = playThrough('refuse');
  assert.equal(st.status, 'won', `status ${st.status} phase ${st.phase}`);
  assert.deepEqual(st.result.keepsakes, { guitar: true, rose: false });
  assert.equal(count(st, 'witchLaugh'), 1);
  assert.equal(count(st, 'roseTake'), 0);
  assert.equal(st.result.sleepers, count(st, 'sleeperWake'));
  assert.equal(st.result.sleepers, st.sleepers.filter((s) => s.state === 'rising').length);
  console.log(`   refuse: ${t.toFixed(1)} s, sleepers ${st.result.sleepers}, pearls ${st.pearls}`);
});

test('swimming away from the witch refuses the rose', () => {
  const { st } = playThrough('swimAway');
  assert.equal(st.status, 'won');
  assert.equal(st.result.keepsakes.rose, false);
  assert.equal(count(st, 'witchLaugh'), 1);
});

test('an A press already held as the offer appears is not taken as consent', () => {
  const st = make(); skipOpening(st);
  // jump to the floor with the guitar settled, then catch it while mashing A
  st.guitar.y = REST.y; st.guitar.x = REST.x; st.guitar.settled = true;
  st.sailor.x = REST.x; st.sailor.y = REST.y - 60; st.cam = 3610;
  tick(st, { a: true });
  assert.equal(st.phase, 'offer');
  run(st, 1.5, { a: true });
  assert.equal(st.phase, 'offer', 'too early to choose');
  tick(st, {}); run(st, 0.6, {});
  tick(st, { a: true });
  assert.equal(st.phase, 'choice'); assert.equal(st.rose, true);
});

test('losable: an idle sailor runs out of air and the sea keeps him', () => {
  const st = make(); skipOpening(st);
  let t = 0;
  while (st.status === 'play' && t < 240) { tick(st, {}); t += DT; }
  assert.equal(st.status, 'lost');
  assert.ok(count(st, 'airOut') >= 1);
  assert.equal(count(st, 'drown'), 1);
  assert.equal(act.hud(st), null);
});

test('hazards cost one lantern each, with 1.6 s of grace, and three end it', () => {
  const st = make(); skipOpening(st);
  const pin = () => { const d = dragonPos(st.hzT); st.sailor.x = d.x; st.sailor.y = d.y; st.guitar.y = d.y + 400; st.sailor.vx = st.sailor.vy = 0; };
  pin(); tick(st, {});
  assert.equal(st.lanterns, 2);
  for (let t = 0; t < 1.5; t += DT) { pin(); tick(st, {}); }
  assert.equal(st.lanterns, 2, 'grace');
  for (let t = 0; t < 0.2; t += DT) { pin(); tick(st, {}); }
  assert.equal(st.lanterns, 1);
  for (let t = 0; t < 1.7; t += DT) { pin(); tick(st, {}); }
  assert.equal(st.lanterns, 0);
  assert.equal(st.phase, 'drown');
  run(st, PHASE_LEN.drown + 0.1, {});
  assert.equal(st.status, 'lost');
  assert.equal(count(st, 'dragonBite'), 3);
});

test('a jellyfish stings on touch; an eel bites only after its eyes glow', () => {
  const st = make(); skipOpening(st);
  const j = st.jellies[0], p = jellyPos(j, st.hzT + DT);
  st.sailor.x = p.x; st.sailor.y = p.y + 18; st.guitar.y = p.y + 500; tick(st, {});
  assert.equal(count(st, 'jellySting'), 1);
  const st2 = make(); skipOpening(st2);
  const e = st2.eels[0];
  st2.sailor.x = e.x + 120; st2.sailor.y = e.y; st2.guitar.y = e.y + 500; st2.cam = e.y - 230;
  const hold = () => { st2.sailor.x = e.x + 120; st2.sailor.y = e.y; st2.sailor.vx = st2.sailor.vy = 0; };
  let glowAt = null, biteAt = null;
  for (let t = 0; t < 4 && biteAt == null; t += DT) {
    hold(); tick(st2, {});
    if (glowAt == null && e.state === 'glow') glowAt = t;
    if (count(st2, 'eelBite')) biteAt = t;
  }
  assert.ok(glowAt != null && biteAt != null);
  assert.ok(glowAt >= BEAT_LEN - 0.05, 'a beat of omen before the glow');
  assert.ok(biteAt - glowAt >= TUNE.eelGlow, 'the glow is a fair warning');
});

test('tea-leaf omens show one beat early with the full reading, never without', () => {
  for (const tea of [3, 0]) {
    const st = make({ tea }); skipOpening(st);
    const e = st.eels[0];
    st.sailor.x = 640; st.sailor.y = e.y; st.guitar.y = e.y + 500;
    let omenT = null, glowT = null;
    for (let t = 0; t < 3; t += DT) {
      st.sailor.x = 640; st.sailor.y = e.y;
      tick(st, {});
      if (omenT == null && st.omens.length) omenT = t;
      if (glowT == null && e.state === 'glow') glowT = t;
    }
    if (tea === 3) { assert.ok(omenT != null && glowT - omenT >= BEAT_LEN - 0.05, `omen ${omenT} glow ${glowT}`); }
    else assert.equal(omenT, null);
  }
});

test('clams open on the beat for one beat; closed is solid, open gives a pearl, it rests, regrows one in view, then is spent', () => {
  const st = make(); skipOpening(st);
  const cl = st.clams[0];
  // follows the beat: open exactly on beats ≡ off (mod every)
  for (let b = 0; b < 12; b += 0.25) assert.equal(clamOpen(cl, b), Math.floor(b) % cl.every === cl.off);
  // put him inside the shell while it is shut
  const shut = () => { while (clamOpen(cl, (st.clock + DT) / BEAT_LEN)) tick(st, {}); };
  const opened = () => { while (!clamOpen(cl, (st.clock + DT) / BEAT_LEN)) tick(st, {}); };
  shut();
  st.sailor.x = cl.x; st.sailor.y = cl.y - 30; st.sailor.vx = st.sailor.vy = 0; st.guitar.y = cl.y + 600;
  const p0 = st.pearls;
  tick(st, {});
  assert.equal(st.pearls, p0, 'no pearl from a closed clam');
  const dd = Math.hypot((st.sailor.x - cl.x) / 60, (st.sailor.y - (cl.y - 48)) / 48);
  assert.ok(dd >= 0.99, 'pushed out of the closed shell');
  opened();
  st.sailor.x = cl.x; st.sailor.y = cl.y - 30;
  tick(st, {});
  assert.equal(st.pearls, p0 + 1, 'pearl from the open clam');
  for (let i = 0; i < 10; i++) { st.sailor.x = cl.x; st.sailor.y = cl.y - 30; tick(st, {}); }
  assert.equal(st.pearls, p0 + 1, 'one pearl per opening');
  assert.ok(count(st, 'clamSnap') >= 1);
  // rests shut, then regrows one pearl, growing only while open, then is spent
  const hold = () => { st.sailor.x = cl.x; st.sailor.y = cl.y - 30; st.sailor.vx = st.sailor.vy = 0; };
  let openDuringRest = false;
  for (let t = 0; t < TUNE.clamRest - 0.2; t += DT) { hold(); tick(st, {}); const b = st.clock / BEAT_LEN; if (Math.floor(b) !== cl.lastBeat && clamIsOpen(cl, b)) openDuringRest = true; }
  assert.ok(!openDuringRest, 'shut while it rests');
  assert.equal(st.pearls, p0 + 1);
  let maxGrowShut = 0, sawSmall = false;
  for (let t = 0; t < 60 && st.pearls === p0 + 1; t += DT) {
    const before = cl.grow, wasOpen = clamIsOpen(cl, (st.clock + DT) / BEAT_LEN);
    hold(); tick(st, {});
    if (!wasOpen && cl.got === 1) maxGrowShut = Math.max(maxGrowShut, cl.grow - before);
    if (wasOpen && cl.grow > 0 && cl.grow < 1) sawSmall = true;
  }
  assert.ok(sawSmall, 'a small pearl shows while it grows');
  assert.equal(maxGrowShut, 0, 'it grows only while open');
  assert.equal(st.pearls, p0 + 2, 'the regrown pearl, once full size');
  assert.ok(clamSpent(cl));
  for (let i = 0; i < cl.every * 6 / DT * BEAT_LEN; i++) { hold(); tick(st, {}); }
  assert.equal(st.pearls, p0 + 2, 'spent: no more pearls');
});

test('air drains, refills in a vent, and running out costs a lantern', () => {
  const st = make(); skipOpening(st);
  run(st, 10, {});
  assert.ok(st.air < 0.8 && st.air > 0.7, `air ${st.air}`);
  st.air = 0.3;
  const v = st.vents[0], a0 = st.air;
  const hover = () => { st.sailor.x = v.x; st.sailor.y = v.y - 120; st.sailor.vx = st.sailor.vy = 0; st.guitar.y = v.y + 400; };
  hover(); tick(st, {});
  assert.equal(count(st, 'airVent'), 1);
  for (let t = 0; t < 0.6; t += DT) { hover(); tick(st, {}); }
  assert.ok(st.air > a0 + 0.25, `refilled to ${st.air}`);
  st.air = 0.0002; st.sailor.x = 640; tick(st, {});
  assert.equal(st.lanterns, 2);
  assert.equal(st.air, TUNE.airAfterOut);
  assert.equal(count(st, 'airOut'), 1);
});

test('sleepers need the conch (or the guitar) and are counted once', () => {
  const st = make(); skipOpening(st);
  const sl = st.sleepers[0];
  st.sailor.x = sl.x; st.sailor.y = sl.y - 40; tick(st, {});
  assert.equal(sl.state, 'asleep', 'no wake without a song');
  const c = st.conches[0]; st.sailor.x = c.x; st.sailor.y = c.y - 25; tick(st, {});
  assert.equal(count(st, 'conchBlow'), 1);
  assert.ok(st.hornT > TUNE.horn - 0.1);
  st.sailor.x = sl.x - 60; st.sailor.y = sl.y - 40; tick(st, {}); tick(st, {});
  assert.equal(sl.state, 'rising');
  const rising = st.sleepers.filter((q) => q.state === 'rising').length;
  assert.ok(rising >= 1);
  assert.equal(st.woken, rising);
  assert.equal(count(st, 'sleeperWake'), rising);
  run(st, 1, { moveX: 0 });
  assert.equal(count(st, 'sleeperWake'), st.woken, 'never counted twice');
});

test('the guitar stays out of reach until it rests on the floor', () => {
  const st = make(); skipOpening(st);
  let minGap = Infinity;
  run(st, 60, (s) => {
    if (s.phase === 'swim' && !s.guitar.settled) minGap = Math.min(minGap, s.guitar.y - s.sailor.y);
    return { moveX: (s.guitar.x - s.sailor.x) / 100, moveY: 1, a: Math.floor(s.clock * 2) % 2 === 0 };
  });
  assert.ok(minGap >= 99, `closest ${minGap}`);
});

test('the ride: up and down choose the row, sail and leap as in Act I, pearls gather, nothing is lost', () => {
  const st = make(); skipOpening(st);
  st.guitar.y = REST.y; st.guitar.x = REST.x; st.guitar.settled = true; st.sailor.x = REST.x; st.sailor.y = REST.y - 40; st.cam = 3610;
  tick(st, {}); run(st, 2.2, {}); tick(st, { b: true });
  run(st, PHASE_LEN.choice + 0.1, {});
  assert.equal(st.phase, 'ride');
  const lanterns = st.lanterns, p0 = st.pearls;
  tick(st, { up: true }); assert.equal(st.ride.row, 0);
  run(st, 0.4, {}); tick(st, { up: true }); assert.equal(st.ride.row, 0, 'clamped');
  tick(st, { down: true }); run(st, 0.4, {}); tick(st, { down: true });
  assert.equal(st.ride.row, 2);
  // follow the pearls: steer to the row of the next one, leap for the high ones
  run(st, PHASE_LEN.ride, (s) => {
    if (s.phase !== 'ride') return {};
    const next = s.ride.pearls.find((p) => !p.got && ridePearlX(p, s.phaseT) > s.ride.x - 50);
    if (!next) return {};
    const dx = ridePearlX(next, s.phaseT) - s.ride.x;
    const leap = next.high && next.row === s.ride.row && dx > 90 && dx < 130;
    if (s.ride.rowT < 1) return { a: leap };
    return { up: next.row < s.ride.row, down: next.row > s.ride.row, a: leap };
  });
  assert.ok(st.pearls - p0 >= 10, `ride pearls ${st.pearls - p0}`);
  assert.ok(st.ride.pearls.filter((p) => p.high && p.got).length >= 2, 'leapt for high pearls');
  assert.equal(st.lanterns, lanterns);
  run(st, PHASE_LEN.iris + 0.1, {});
  assert.equal(st.status, 'won');
});

test('the ride: sailing is bounded; a high pearl needs a leap', () => {
  const st = make(); skipOpening(st);
  st.guitar.y = REST.y; st.guitar.x = REST.x; st.guitar.settled = true; st.sailor.x = REST.x; st.sailor.y = REST.y - 40; st.cam = 3610;
  tick(st, {}); run(st, 2.2, {}); tick(st, { b: true });
  run(st, PHASE_LEN.choice + 0.1, {});
  const r = st.ride;
  for (const p of r.pearls) { p.got = true; }
  assert.ok(r.pearls.some((p) => p.high), 'some pearls float high');
  const x0 = r.x;
  run(st, 0.5, { moveX: 1 }); assert.ok(r.x > x0 + 100, 'sails forward');
  run(st, 4, { moveX: -1 }); assert.equal(r.x, RIDE.minX, 'clamped at the left');
  run(st, 4, { moveX: 1 }); assert.equal(r.x, RIDE.maxX, 'clamped at the right');
  const hi = r.pearls.find((p) => p.high); hi.got = false; hi.row = r.row;
  hi.at = st.phaseT + 0.5 - (1250 - r.x) / RIDE.speed;
  run(st, 1.2, {});
  assert.equal(hi.got, false, 'passes overhead without a leap');
  const hi2 = r.pearls.filter((p) => p.high)[1]; hi2.got = false; hi2.row = r.row;
  hi2.at = st.phaseT + 0.4 - (1250 - r.x) / RIDE.speed;
  tick(st, { a: true }); run(st, 0.8, {});
  assert.equal(hi2.got, true, 'a leap takes it');
});

test('drawing code never runs in headless step (no DOM needed) and eelExt is sane', () => {
  assert.equal(eelExt({ state: 'idle', t: 0 }), 0);
  assert.equal(eelExt({ state: 'hold', t: 0 }), 1);
  assert.ok(eelExt({ state: 'back', t: 0.25 }) > 0.4);
});

const fromScene = (k, from = {}) => {
  const st = act.create({ seed: 1, carry: { tea: 3 }, from: { scene: k, ...from } });
  st.clock = 0; st.log = []; return st;
};

test('every scene creates and steps for ten seconds without throwing', () => {
  assert.equal(act.scenes, SCENES);
  assert.equal(SCENES.length, 6);
  for (let k = 0; k < SCENES.length; k++) {
    const st = fromScene(k);
    run(st, 10, {});
    assert.ok(Number.isFinite(st.sailor.y) && Number.isFinite(st.cam), `scene ${k}`);
    assert.ok(act.hud(st) === null || st.phase !== 'open');
    if (k > 0) assert.notEqual(st.phase, 'open', `scene ${k} skips the opening`);
    if (k === 0) assert.equal(st.checkpoint, null);
  }
});

test('scenes 1-3 start in a vent, full air, guitar ahead and not held', () => {
  for (let k = 1; k <= 3; k++) {
    const st = fromScene(k);
    assert.equal(st.phase, 'swim'); assert.equal(st.air, 1); assert.equal(st.lanterns, 3);
    assert.ok(st.inVent, `scene ${k} in vent`);
    assert.ok(st.guitar.y > st.sailor.y + 100 && !st.guitar.held && !st.guitar.settled);
    assert.equal(st.checkpoint.scene, k);
    assert.ok(Math.abs(st.cam - (st.sailor.y - 230)) < 1);
  }
});

test('scene 4 holds the guitar in the offer; scene 5 is the ride', () => {
  const o = fromScene(4);
  assert.equal(o.phase, 'offer'); assert.ok(o.guitar.held && o.guitar.settled);
  assert.ok(act.hud(o).keepsakes[0].have);
  run(o, 2.2, {}); tick(o, { b: true }); assert.equal(o.phase, 'choice');
  const r = fromScene(5);
  assert.equal(r.phase, 'ride'); assert.ok(r.guitar.held && r.ride);
  run(r, PHASE_LEN.ride + PHASE_LEN.iris + 0.2, {});
  assert.equal(r.status, 'won');
  const rr = fromScene(5, { choice: 'take', woken: 2, sleepers: [0, 1] });
  assert.ok(rr.rose); assert.equal(rr.woken, 12);
  assert.ok(rr.sleepers.every((q) => q.state === 'rising'));
});

test('passing a vent sets a checkpoint; create from it restores progress', () => {
  const st = make(); skipOpening(st);
  assert.equal(st.checkpoint, null);
  // wake a sleeper, sound the first conch, take a pearl, then reach vent 0
  st.hornT = 5; st.conches[0].used = true;
  st.sailor.x = SLEEPERS[0][0]; st.sailor.y = SLEEPERS[0][1] - 30; st.guitar.y = 900;
  tick(st); assert.ok(st.woken >= 1);
  st.pearls = 3; st.score = 777; st.clams[1].got = 2;
  Object.assign(st.sailor, { x: VENTS[0][0], y: VENTS[0][1] - 100, vx: 0, vy: 0 }); st.guitar.y = 1500;
  tick(st);
  const cp = st.checkpoint;
  assert.ok(cp, 'checkpoint made'); assert.equal(cp.scene, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(cp)), cp, 'plain JSON');
  assert.equal(cp.pearls, 3); assert.equal(cp.score, st.score);
  const woke = st.sleepers.map((q, i) => (q.state !== 'asleep' ? i : -1)).filter((i) => i >= 0);
  assert.deepEqual(cp.sleepers, woke);
  const re = act.create({ seed: 2, carry: { tea: 3 }, from: JSON.parse(JSON.stringify(cp)) });
  assert.equal(re.phase, 'swim'); assert.equal(re.air, 1);
  assert.equal(re.pearls, 3); assert.equal(re.score, cp.score); assert.equal(re.woken, cp.woken);
  assert.deepEqual(re.sleepers.map((q, i) => (q.state !== 'asleep' ? i : -1)).filter((i) => i >= 0), woke);
  assert.ok(re.conches[0].used && !re.conches[1].used);
  assert.equal(re.clams[1].got, 2);
  assert.equal(re.sailor.x, cp.x); assert.equal(re.sailor.y, cp.y);
  assert.deepEqual(re.checkpoint, { ...cp, scene: 1 });
  re.clock = 0; re.log = []; run(re, 5, {}); assert.equal(re.status, 'play');
});

test('later vents, the offer and the ride each make a checkpoint', () => {
  const st = fromScene(1); st.clock = 0;
  Object.assign(st.sailor, { x: VENTS[2][0], y: VENTS[2][1] - 100 }); st.guitar.y = 2900; st.inVent = false;
  tick(st); assert.equal(st.checkpoint.scene, 2);
  Object.assign(st.sailor, { x: VENTS[1][0], y: VENTS[1][1] - 100 }); st.inVent = false;
  tick(st); assert.equal(st.checkpoint.scene, 2, 'an earlier vent never moves the checkpoint back');
  const of = make(); skipOpening(of);
  Object.assign(of.guitar, { y: REST.y, x: REST.x, settled: true }); Object.assign(of.sailor, { x: REST.x, y: REST.y - 40, vy: 0 });
  tick(of); assert.equal(of.phase, 'offer'); assert.equal(of.checkpoint.scene, 4);
  run(of, 2.2, {}); tick(of, { b: true }); run(of, PHASE_LEN.choice + 0.1, {});
  assert.equal(of.phase, 'ride'); assert.equal(of.checkpoint.scene, 5); assert.equal(of.checkpoint.choice, 'refuse');
});

console.log(`\n${n} tests passed`);

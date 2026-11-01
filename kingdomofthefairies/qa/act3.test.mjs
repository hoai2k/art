// Headless checks for Act III, the Sea King's Court.
// Run: node kingdomofthefairies/qa/act3.test.mjs
import assert from 'node:assert/strict';
import act, { TUNE, PEDESTAL, SENTRIES, SENTRY_HEAD, OUTRO, CAM_MAX, LANTERN_BX, PAR, GAZE_OFF, litAt, effRow, SCENES } from '../src/acts/act3.js';
// A spot in the far hall, clear of the pedestal (reaching it takes the pearl).
const SPOT = PEDESTAL.x - 300;

const BEAT = 60 / 76.5, DT = 1 / 30;
let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };
const make = (carry = {}, seed = 7) => act.create({ seed, carry });
const tick = (st, inp = {}) => act.step(st, DT, { beat: (st.t + DT) / BEAT, ...inp });
const run = (st, sec, f = () => ({})) => { const all = []; for (let t = 0; t < sec && st.status === 'play'; t += DT) { tick(st, f(st)); all.push(...st.events); st.events.length = 0; } return all; };
const types = (ev) => ev.map((e) => e.type);
// Park the gaze, whale and fish out of the way for isolated checks.
const calm = (st) => { Object.assign(st.gaze, { phase: 'dark', t: 0, dur: 1e9, aim: GAZE_OFF }); st.whale.next = 1e9; st.fish.next = 1e9; };
// Hold the beam still on floor x (a sweep that never moves on), for isolated checks.
const beamAt = (st, x) => Object.assign(st.gaze, { phase: 'sweep', t: 0, dur: 1e9, from: x, to: x, aim: x });

// ---------------------------------------------------------------- planner
// A lookahead bot: every 0.2 s it tries each action for 0.4 s followed by
// each follow-up for 1.2 s on a cloned state, and picks the safest one that
// gets closest to the pedestal. It uses only the act's public inputs.
const ACTIONS = [{ moveX: 1 }, { moveX: -1 }, {}, { aHeld: true }, { up: true }, { down: true }];
const FOLLOW = [{ moveX: 1 }, { moveX: -1 }, {}, { aHeld: true }];
// Head for the pedestal: reaching it on any groove takes the pearl.
const goal = (st) => {
  if (st.phase !== 'play' && st.phase !== 'caught') return 1e6;
  return -Math.abs(st.p.x - PEDESTAL.x) - (st.p.rowT < 1 ? 40 : 0);
};
function sim(st, plan) {
  const s = structuredClone(st); s.events = [];
  let lost = 0, v = 0;
  const go = (inp, sec) => {
    for (let t = 0; t < sec && s.status === 'play'; t += DT) {
      const once = t === 0 ? inp : { ...inp, up: false, down: false };
      const before = s.lanterns;
      act.step(s, DT, { beat: (s.t + DT) / BEAT, ...once });
      lost += before - s.lanterns;
    }
  };
  for (const [inp, sec] of plan) { go(inp, sec); v += goal(s); }
  return -lost * 5000 + v / plan.length + (s.status === 'lost' ? -1e7 : 0);
}
// Each action for 0.4 s, then two follow-ups (0.6 s and 1.2 s).
function plan(st) {
  let best = null, bestV = -Infinity;
  for (const a of ACTIONS) {
    if ((a.up && st.p.row === 0) || (a.down && st.p.row === 2)) continue;
    let v = -Infinity;
    for (const f of [...FOLLOW, { up: true }, { down: true }]) for (const g of FOLLOW) v = Math.max(v, sim(st, [[a, 0.4], [f, 0.6], [g, 1.2]]));
    if (v > bestV + 1e-6) { bestV = v; best = a; }
  }
  return best;
}
function playBot(st, maxSec = 240) {
  let cur = {}, next = 0, held = 0, wasMasked = false, dashed = false;
  const log = { freezes: 0, maskedMoves: 0 };
  for (let t = 0; t < maxSec && st.status === 'play'; t += DT) {
    if (t >= next) { cur = plan(st) || {}; next = t + 0.2; held = 0; }
    const inp = { ...cur };
    if (held > 0) { inp.up = false; inp.down = false; }
    held++;
    if (st.masked && inp.moveX) log.maskedMoves++;
    tick(st, inp); st.events.length = 0;
  }
  return { ...log, time: st.t };
}

// ---------------------------------------------------------------- tests
test('create: the contract fields', () => {
  const st = make();
  assert.equal(st.status, 'play'); assert.equal(st.statusT, 0);
  assert.deepEqual(st.events, []); assert.equal(st.result, null);
  const h = act.hud(st);
  assert.equal(h.lanterns, 3); assert.equal(h.maxLanterns, 3); assert.ok(h.keepsakes.some((k) => k.id === 'pearl' && !k.have));
});

test('determinism: same seed and input, same court', () => {
  const a = make({}, 11), b = make({}, 11);
  run(a, 30, () => ({ moveX: 0.5 })); run(b, 30, () => ({ moveX: 0.5 }));
  assert.deepEqual(a.courtiers.map((c) => c.x), b.courtiers.map((c) => c.x));
  assert.equal(a.gaze.aim, b.gaze.aim); assert.equal(a.whale.next, b.whale.next);
});

test('courtiers step on the beat, and only on the beat', () => {
  const st = make(); calm(st);
  run(st, 0.2);
  const start = st.courtiers.map((c) => c.x1);
  // Go to the middle of a beat: the targets must not change until the next whole beat.
  let stepsAt = [];
  for (let i = 0; i < 300; i++) {
    const before = st.courtiers.map((c) => c.x1).join();
    const ev = run(st, DT);
    if (st.courtiers.map((c) => c.x1).join() !== before) stepsAt.push(st.beat);
    if (types(ev).includes('courtierStep')) assert.ok(st.beat % 1 < DT / BEAT + 1e-9, 'footstep lands on the beat');
  }
  assert.ok(stepsAt.length >= 8);
  for (const b of stepsAt) assert.ok(b % 1 < DT / BEAT + 1e-9, `step at beat phase ${b % 1}`);
  assert.notDeepEqual(st.courtiers.map((c) => c.x1), start);
  // slides finish early in the beat: by mid-beat a courtier stands on its target
  while ((st.beat % 1) < 0.55) run(st, DT);
  for (const c of st.courtiers) assert.ok(Math.abs(c.x - c.x1) < 1e-6);
});

test('sentries snap open on the beat; an open jaw costs a lantern', () => {
  const st = make(); calm(st);
  st.courtiers = st.courtiers.filter((c) => c.kind !== 'guard');
  let openPh = [];
  for (let i = 0; i < 200; i++) { run(st, DT); if (st.sentries[0].open) openPh.push(st.beat % 1); }
  assert.ok(openPh.length > 0);
  for (const p of openPh) assert.ok(p < TUNE.snapOpen + 1e-9);
  // stand on a sentry on the front groove through a beat
  st.p.row = st.p.from = 2; st.p.x = SENTRIES[0] + SENTRY_HEAD;
  const ev = run(st, BEAT * 1.1);
  assert.ok(types(ev).includes('sentryBite')); assert.equal(st.lanterns, 2);
});

test('the rose keeps the sentries asleep', () => {
  const st = make({ rose: true }); calm(st);
  st.courtiers = st.courtiers.filter((c) => c.kind !== 'guard');
  st.p.row = st.p.from = 2; st.p.x = SENTRIES[1] + SENTRY_HEAD;
  const ev = run(st, BEAT * 6);
  assert.ok(!st.sentries.some((s) => s.open));
  assert.ok(!types(ev).includes('sentryBite')); assert.ok(!types(ev).includes('sentrySnap'));
  assert.equal(st.lanterns, 3);
});

test('the beam spots you unless hidden with an attendant; grace protects', () => {
  // in the beam, standing: spotted
  let st = make(); calm(st); beamAt(st, SPOT);
  st.courtiers = [];
  st.p.row = st.p.from = 0; st.p.x = SPOT - 20;
  let ev = run(st, 0.1);
  assert.ok(types(ev).includes('spotted')); assert.equal(st.lanterns, 2);
  assert.ok(Math.abs(st.p.x - (SPOT - 20)) < 1, 'no longer hauled back into the beam\'s path');
  ev = run(st, 1.0);
  assert.equal(st.lanterns, 2, 'grace after a hit');
  ev = run(st, 0.7);
  assert.equal(st.lanterns, 1, 'grace runs out (the beam is held still here)');
  // frozen alone in the beam: still spotted
  st = make(); calm(st); beamAt(st, SPOT); st.courtiers = [];
  st.p.row = st.p.from = 0; st.p.x = SPOT - 20;
  run(st, 0.1, () => ({ aHeld: true }));
  assert.equal(st.lanterns, 2);
  // hidden beside an attendant in the beam
  st = make(); calm(st); beamAt(st, SPOT);
  st.courtiers = [{ kind: 'pink', row: 0, x: SPOT - 20, x0: SPOT - 20, x1: SPOT - 20, a: 0, b: 2000, step: 0, pat: 'R', dir: 1 }];
  st.p.row = st.p.from = 0; st.p.x = SPOT - 20;
  ev = run(st, 2, () => ({ aHeld: true }));
  assert.equal(st.lanterns, 3); assert.ok(st.p.hidden);
  // a guard is no cover
  st = make(); calm(st);
  const gx = SPOT; beamAt(st, gx);
  st.courtiers = [{ kind: 'guard', row: 1, x: gx, x0: gx, x1: gx, a: 0, b: 9000, step: 0, pat: 'R', dir: 1 }];
  st.p.row = st.p.from = 1; st.p.x = gx - 38; // overlapping for cover, clear of a bump
  assert.ok(litAt(gx, 1, st.p.x));
  ev = run(st, 0.1, () => ({ aHeld: true }));
  assert.ok(!types(ev).includes('guardBump')); assert.ok(types(ev).includes('spotted'));
  assert.equal(st.lanterns, 2);
});

test('A strikes a pose that holds until you move; A again or moving ends it', () => {
  const st = make(); calm(st);
  tick(st, { a: true }); assert.ok(st.p.frozen, 'A hides');
  run(st, 1); assert.ok(st.p.frozen, 'the pose holds without A held');
  const x = st.p.x; tick(st, { moveX: 1 }); assert.ok(!st.p.frozen && st.p.x > x, 'moving ends it and walks');
  tick(st, { a: true }); assert.ok(st.p.frozen);
  tick(st, { a: true }); assert.ok(!st.p.frozen, 'A again ends it');
});

test('walking is quicker: 150 px a second', () => {
  const st = make(); calm(st); st.courtiers = []; st.sentries = [];
  const x = st.p.x; run(st, 1, () => ({ moveX: 1 }));
  assert.ok(Math.abs(st.p.x - x - TUNE.walk) < 8 && TUNE.walk >= 150);
});

test('the beam comes in from a wing, crosses the whole stage and leaves by the other', () => {
  const st = make(); st.whale.next = 1e9; st.fish.next = 1e9;
  const sweeps = [];
  let cur = null;
  run(st, 90, (s) => {
    s.lanterns = 3; s.p.grace = 9; // keep him in play: only the beam's path is checked here
    const g = s.gaze;
    if (g.phase === 'warn' && !cur) cur = { warnT: 0, from: g.from, to: g.to, cam: s.cam, aims: [] };
    if (cur && g.phase === 'warn') cur.warnT = g.t;
    if (cur && g.phase === 'sweep') cur.aims.push(g.aim);
    if (cur && g.phase === 'dark' && cur.aims.length) { sweeps.push(cur); cur = null; }
    return {};
  });
  assert.ok(sweeps.length >= 4, `${sweeps.length} sweeps in 90 s`);
  for (const w of sweeps) {
    assert.ok(w.warnT >= TUNE.warn - 0.1, 'a full warning first');
    const dir = Math.sign(w.to - w.from);
    assert.ok(w.from < w.cam - 200 || w.from > w.cam + 1480, 'starts off stage');
    assert.ok(w.to < w.cam - 200 || w.to > w.cam + 1480, 'ends off stage');
    for (let i = 1; i < w.aims.length; i++) assert.ok((w.aims[i] - w.aims[i - 1]) * dir >= 0, 'never turns back');
    assert.ok(Math.abs(w.aims[w.aims.length - 1] - w.to) < 20, 'runs right off the far side');
  }
});

test('after a spotting the beam moves on past, so standing still is safe again', () => {
  const st = make(); st.whale.next = 1e9; st.fish.next = 1e9; st.courtiers = []; st.sentries = [];
  st.p.row = st.p.from = 1; st.p.x = 900; st.cam = 340;
  const ev = run(st, 40);
  const hits = types(ev).filter((t) => t === 'spotted').length;
  const sweeps = types(ev).filter((t) => t === 'gazeSweep').length;
  assert.ok(sweeps >= 2 && hits <= sweeps, `one spotting per pass at most (${hits} for ${sweeps} sweeps)`);
});

test('the beam telegraphs: a warn phase precedes every sweep', () => {
  const st = make();
  let last = st.gaze.phase, seq = [];
  run(st, 60, (s) => { if (s.gaze.phase !== last) { seq.push(s.gaze.phase); last = s.gaze.phase; } s.lanterns = 3; return { aHeld: true }; });
  assert.ok(seq.filter((p) => p === 'sweep').length >= 3);
  for (let i = 0; i < seq.length; i++) if (seq[i] === 'sweep') assert.equal(seq[i - 1], 'warn');
});

test('the whale passes every 20-25 s and blinds the gaze for about 3 s', () => {
  const st = make(); st.p.x = 200; st.p.row = st.p.from = 0;
  const starts = []; let maskRun = 0, maskRuns = [];
  for (let t = 0; t < 120; t += DT) {
    tick(st, { aHeld: true });
    if (st.events.some((e) => e.type === 'whalePass')) starts.push(st.t);
    if (st.maskedBy === 'whale') maskRun += DT; else if (maskRun) { maskRuns.push(maskRun); maskRun = 0; }
    st.events.length = 0;
    st.lanterns = 3; // immortal for this check
  }
  assert.ok(starts.length >= 4, `${starts.length} passes`);
  for (let i = 1; i < starts.length; i++) { const d = starts[i] - starts[i - 1]; assert.ok(d >= 19.9 && d <= 25.2, `gap ${d}`); }
  for (const m of maskRuns) assert.ok(m > 2.7 && m < 3.4, `mask ${m}`);
  // standing in the rest beam during a pass is safe
  const s2 = make(); s2.p.row = s2.p.from = 0; s2.p.x = SPOT - 20; s2.courtiers = [];
  s2.whale.next = 0.01; s2.gaze.dur = 1e9;
  run(s2, 1.2); // let the whale arrive (first 0.9 s is the entrance)
  const before = s2.lanterns; s2.p.grace = 0;
  const ev = run(s2, 2.5);
  assert.equal(s2.lanterns, before); assert.ok(!types(ev).includes('spotted'));
});

test('guards bump; changing groove is tweened', () => {
  const st = make(); calm(st);
  st.courtiers = [{ kind: 'guard', row: 1, x: 610, x0: 610, x1: 610, a: 0, b: 2000, step: 0, pat: 'R', dir: 1 }];
  st.p.row = st.p.from = 2; st.p.x = 610; // between two sentries
  tick(st, { up: true });
  assert.equal(st.p.row, 1); assert.equal(effRow(st.p), 2, 'still on the old groove early in the tween');
  tick(st, { up: true }); assert.equal(st.p.row, 1, 'no second change mid-tween');
  const ev = run(st, 0.5);
  assert.ok(types(ev).includes('guardBump')); assert.equal(st.lanterns, 2);
});

test('pearls along the grooves score', () => {
  const st = make(); calm(st); st.courtiers = [];
  st.p.row = st.p.from = 2; st.p.x = 300; st.carry.rose = true;
  run(st, 7, () => ({ moveX: 1 }));
  assert.ok(st.pearls >= 2); assert.equal(st.score, st.pearls * 10);
});

test('the pearl: reaching the pedestal on any groove takes it and grants the keepsake', () => {
  let st = make(); calm(st); st.courtiers = [];
  st.p.row = st.p.from = 2; st.p.x = PEDESTAL.x - PEDESTAL.reach - 40; st.p.grace = 99;
  tick(st, {});
  assert.equal(st.phase, 'play', 'not from short of the pedestal');
  run(st, 1, () => ({ moveX: 1 }));
  assert.equal(st.phase, 'take', 'walking up to it on the front groove takes it, no button, no whale');
  st = make(); calm(st); st.courtiers = [];
  st.p.row = st.p.from = 0; st.p.x = PEDESTAL.x; st.p.grace = 99;
  tick(st, {});
  assert.equal(st.phase, 'take'); assert.ok(st.events.some((e) => e.type === 'pearlTaken'));
  assert.equal(act.hud(st).keepsakes.find((k) => k.id === 'pearl').have, true);
  const ev = run(st, 10);
  assert.ok(types(ev).includes('whaleTurn')); assert.ok(types(ev).includes('swallow'));
  assert.equal(st.status, 'won');
  assert.deepEqual(st.result.keepsakes, { pearl: true });
  assert.equal(typeof st.result.score, 'number'); assert.equal(typeof st.result.pearls, 'number');
  const outro = 2 * DT + OUTRO.take + OUTRO.turn + OUTRO.lunge + OUTRO.iris;
  assert.ok(Math.abs(st.t - outro) < 0.2, `${st.t} vs ${outro}`);
});

test('losable: three hits, a caught beat, then lost', () => {
  const st = make();
  const ev = run(st, 120, () => ({ moveX: 1 })); // walk straight down the front groove
  assert.ok(types(ev).filter((t) => t === 'hit').length === 3);
  assert.ok(types(ev).includes('caught'));
  assert.equal(st.status, 'lost'); assert.ok(st.lostTitle && st.lostSub);
  assert.equal(st.result, null);
});

test('tea omens appear a beat before the beam reaches you', () => {
  const st = make({ tea: 3 }); st.courtiers = []; st.whale.next = 1e9; st.fish.next = 1e9;
  st.p.row = st.p.from = 1; st.p.x = 640;
  let omenBefore = false, sawHit = false;
  for (let t = 0; t < 30 && !sawHit; t += DT) {
    tick(st, {});
    if (st.omens.some((o) => o.kind === 'gaze')) omenBefore = true;
    if (st.events.some((e) => e.type === 'spotted')) sawHit = true;
    st.events.length = 0;
  }
  assert.ok(sawHit && omenBefore);
  const none = make({ tea: 2 }); run(none, 20); assert.equal(none.omens.length, 0);
});

test('scenes: every scene creates, steps and starts safely', () => {
  assert.equal(act.scenes, SCENES);
  assert.equal(SCENES.length, 4);
  SCENES.forEach((sc, k) => {
    const st = act.create({ seed: 11, carry: {}, from: { scene: k } });
    assert.ok(Math.abs(st.p.x - sc.x) < 1e-9 && st.p.row === sc.row);
    assert.equal(st.lanterns, 3);
    assert.ok(Math.abs(st.cam - Math.max(0, Math.min(CAM_MAX, sc.x - 560))) < 1e-9);
    // no jaw or seahorse guard on top of the sailor
    assert.ok(!st.courtiers.some((c) => c.kind === 'guard' && c.row === st.p.row && Math.abs(c.x - st.p.x) < 120));
    for (const e of SENTRIES) assert.ok(Math.abs(e + SENTRY_HEAD - st.p.x) > 100);
    const ev = run(st, 4);                 // standing still for a few seconds is safe
    assert.equal(st.status, 'play'); assert.equal(st.lanterns, 3, `scene ${k} hit early`);
    assert.ok(!types(ev).includes('gazeSweep'));
    run(st, 8, () => ({ moveX: 1 }));
    assert.ok(JSON.parse(JSON.stringify(st.checkpoint ?? null)) !== undefined);
  });
});

test('checkpoints: crossing a boundary sets one; create restores it', () => {
  const st = make({}, 5); calm(st);
  assert.equal(st.checkpoint, null);
  st.p.row = st.p.from = 2;
  let seen = -1;
  for (let t = 0; t < 60 && seen < 1; t += DT) { calm(st); tick(st, { moveX: 1 }); st.events.length = 0; if (st.checkpoint) seen = st.checkpoint.scene; st.lanterns = 3; st.p.grace = 1; }
  assert.equal(seen, 1);
  const cp = st.checkpoint;
  assert.equal(cp.x, SCENES[1].x); assert.equal(cp.row, 2);
  JSON.parse(JSON.stringify(cp));
  // pick up a pearl, cross scene 2, then restore from it
  st.pearlsOnFloor[5].got = true; st.pearls = 4; st.score = 123; st.stats.freezes = 3;
  st.p.x = SCENES[2].x - 4; calm(st);
  for (let t = 0; t < 1 && st.checkpoint.scene < 2; t += DT) { calm(st); tick(st, { moveX: 1 }); st.p.grace = 1; }
  assert.equal(st.checkpoint.scene, 2);
  const cp2 = JSON.parse(JSON.stringify(st.checkpoint));
  const re = act.create({ seed: 9, carry: {}, from: cp2 });
  assert.equal(re.p.x, SCENES[2].x); assert.equal(re.p.row, 2);
  assert.ok(re.pearlsOnFloor[5].got && re.pearlsOnFloor[0].got && !re.pearlsOnFloor[11].got);
  assert.deepEqual(re.pearlsOnFloor.map((q) => q.got), st.pearlsOnFloor.map((q) => q.got));
  assert.equal(re.score, 123); assert.equal(re.pearls, 4); assert.equal(re.stats.freezes, 3);
  assert.equal(re.lanterns, 3);
  assert.deepEqual(re.checkpoint, { ...cp2, scene: 2 });
  assert.equal(act.hud(re).pearls, 4);
});

test('a restored sailor has seconds before the first sweep, and the whale is not immediate', () => {
  const re = act.create({ seed: 3, carry: {}, from: { scene: 3 } });
  const ev = run(re, 4.5);
  assert.ok(!types(ev).includes('gazeSweep') && re.lanterns === 3);
  assert.ok(re.whale.t < 0 && re.whale.next > 5);
});

test('the act can be won from scene 3', () => {
  const st = act.create({ seed: 7919, carry: { tea: 3 }, from: { scene: 3 } });
  playBot(st);
  assert.equal(st.status, 'won', `status ${st.status} at ${st.t.toFixed(1)} s, x ${st.p.x.toFixed(0)}`);
  assert.deepEqual(st.result.keepsakes, { pearl: true });
});

const results = [];
for (const [seed, carry] of [[7919, { tea: 3 }], [15838, {}], [23757, { rose: true }], [63352, { tea: 3 }], [71271, { rose: true, tea: 3 }]]) {
  test(`winnable by the planner (seed ${seed}, ${carry.rose ? 'rose' : 'no rose'})`, () => {
    const st = make(carry, seed);
    playBot(st);
    results.push({ seed, rose: !!carry.rose, time: st.t.toFixed(1), lanterns: st.lanterns, freezes: st.stats.freezes, unseen: st.stats.hiddenPasses, whales: st.whale.passes, pearls: st.pearls, score: st.result?.score });
    assert.equal(st.status, 'won', `status ${st.status} at ${st.t.toFixed(1)} s, x ${st.p.x.toFixed(0)} row ${st.p.row}`);
    assert.deepEqual(st.result.keepsakes, { pearl: true });
  });
}
console.table(results);
test('hiding is part of the play: most planner runs hide from the beam', () => {
  assert.ok(results.filter((r) => r.freezes > 0).length >= 3);
});
console.log(`${n} passed`);

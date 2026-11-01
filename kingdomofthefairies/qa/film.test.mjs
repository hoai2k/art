// Headless checks for the film edition (?widowsbay=off; design/film-adaptation.md).
// The original acts' own suites run with KOTF_EDITION=widowsbay; this file
// checks what the film edition changes or adds.
// Run: KOTF_EDITION=film node kingdomofthefairies/qa/film.test.mjs
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { ACTS } from '../src/acts/index.js';
import { FILM, LEGACY, FILM_CAST } from '../src/theme.js';
import prologue, { GIFTS, FAIRIES, AZURINE_X, RAMPART, ARMS, HAND, NEAR_HAND, LANTERNS, T as PRO_T } from '../src/acts/prologue.js';
import act2, { FAIRY_AT, FILM_DIVE, RIDE } from '../src/acts/act2.js';
import act3, { PASSAGE } from '../src/acts/act3.js';
import { actTower, actBurning, SWIM, TOWER_HOLDS, TOWER_TOP, FILM_T, BARREL, DUEL, DIVE, APOTH, FILM_CLIFF, TOWER_WINDOW, duelReach, weddingGuests, guestHop, CELEBRATION, AURORA, auroraFacing, WEDDING, weddingFloor, SWIM as SEA, diveFloor, swimPosition, TOWER_ESCAPE, towerEscapeFire, duelResetX, BATTLE_INTRO, BATTLE_INTRO_END, battleIntroFrame } from '../src/acts/act5film.js';
import { CLIMB, terrainAt } from '../src/acts/climb.js';
import { CLIMB_MAPS } from '../src/acts/climb-map.js';
import act4 from '../src/acts/act4.js';
import { createCavern, stepCavern, surfaces, EXIT_X } from '../src/acts/act4cavern.js';
import { HOUSE } from '../src/acts/act5.js';
import { FINALE, FINALE_END } from '../src/finale.js';
import { HOOKS } from '../src/acts/act4.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };
const DT = 1 / 60, BEAT = 60 / 76.5;
const run = (act, st, sec, input = () => ({}), until = () => false) => {
  for (let t = 0; t < sec && st.status === 'play' && !until(st); t += DT) {
    const beat = (st.clock ?? st.t ?? 0) / BEAT;
    act.step(st, DT, { beat: beat + DT / BEAT, ...input(st) });
    st.events.length = 0;
  }
};
// Presses A just on each beat (when the beat's fraction is near 0).
const onBeat = (st) => { const b = ((st.clock ?? st.t ?? 0) + DT) / BEAT; return { a: (b % 1) < 0.04 }; };

test('the film edition is the default, with a prologue and six acts', () => {
  assert.equal(FILM, true); assert.equal(LEGACY, false);
  assert.deepEqual(ACTS.map((a) => a.kicker), ['Prologue', 'Act I', 'Act II', 'Act III', 'Act IV', 'Act V', 'Act VI']);
  assert.deepEqual(ACTS.map((a) => a.title), ['The Betrothal', 'The Royal Crossing', 'The Water Fairy', "Neptune's Court", "The Whale's Passage", 'The Enchanted Tower', 'The Burning Tower']);
  for (const a of ACTS) { assert.ok(a.scenes?.length, a.title); assert.equal(typeof a.create, 'function'); }
  assert.equal(FILM_CAST['sailor-stand'], 'prince-stand');
  assert.equal(FILM_CAST['guitar-sinking'], 'sword-sinking');
});

test('every scene of every film act creates and steps without throwing', () => {
  for (const a of ACTS) a.scenes.forEach((_, k) => {
    const st = a.create({ seed: 5, carry: { tea: 3, guitar: true, pearl: true, stone: true, sleepers: 4 }, from: { scene: k } });
    run(a, st, 4);
    assert.ok(['play', 'won'].includes(st.status), `${a.title} scene ${k}: ${st.status}`);
    a.hud(st); a.draw && a.announce?.({ type: 'hit', lanterns: 2 });
  });
});

test('prologue: gifts, her hand, the chase along the rampart and the arming', () => {
  const st = prologue.create({});
  let clock = 0, last = false;
  const press = (want) => { const a = want && !last; last = want; return a; };   // a fresh press each time
  run(prologue, st, 120, (s) => {
    const p = s.p, beat = (clock += DT) / BEAT;
    if (s.phase === 'court') {
      const f = FAIRIES.find((q) => !s.gifts.includes(q.gift));
      const to = f ? f.x + f.hand - HAND : AZURINE_X - 60;   // his hand at her gift
      return { moveX: Math.abs(to - p.x) > 20 ? Math.sign(to - p.x) : 0, a: press(!!s.near), beat };
    }
    if (s.phase === 'rampart') {
      const fire = s.fires.find((f) => f.x > p.x && f.x - p.x < 70 && (f.lit || f.y > RAMPART.y - 120));
      return { moveX: 1, a: press(!!fire && p.on), aHeld: true, beat };
    }
    if (s.phase === 'armoury') {
      const a = ARMS.find((q) => !s.arms.includes(q.id));
      return { moveX: a && Math.abs(a.x - p.x) > 20 ? Math.sign(a.x - p.x) : 0, a: press(!!s.near), beat };
    }
    if (s.phase === 'bind') return { moveX: Math.floor(s.phaseT * 4) % 2 ? 1 : -1, beat };   // struggle against the cords
    if (s.phase === 'knighted') return { moveX: -1, beat };
    return { beat };
  });
  assert.equal(st.status, 'won', st.phase);
  assert.equal(st.knocks, 0, 'a prince who leaps every fire is never burned');
  assert.deepEqual([...st.gifts].sort(), [...GIFTS].sort());
  assert.ok(st.betrothed);
  assert.equal(st.arms.length, 3);
  assert.ok(prologue.intro, 'flows straight into Act I');
});

test('prologue: bound, he struggles left and right before Aurora frees him; his arms make him the armoured prince', () => {
  const st = prologue.create({ from: { scene: 2 } });
  assert.equal(st.phase, 'bind');
  run(prologue, st, 6, () => ({ beat: 0 }));
  assert.equal(st.phase, 'bind', 'standing still, he stays bound');
  const pulls = [];
  for (const mx of [-1, -1, 1, 1, -1, 1]) { st.events.length = 0; for (let i = 0; i < 6; i++) prologue.step(st, DT, { moveX: mx, beat: 0 }); pulls.push(...st.events.filter((e) => e.type === 'strain')); }
  assert.equal(pulls.length, 4, 'each change of direction is one pull, four in all');
  run(prologue, st, 1, () => ({ beat: 0 }));
  assert.equal(st.phase, 'free');
  const s2 = prologue.create({ from: { scene: 2 } });
  run(prologue, s2, PRO_T.bind + 0.1, () => ({ beat: 0 }));
  for (let i = 0; i < 4; i++) { prologue.step(s2, DT, { a: true, beat: 0 }); run(prologue, s2, 0.2, () => ({ beat: 0 })); }
  assert.equal(s2.struggle.n, 4, 'any button pulls too: no instruction is needed');
  assert.equal(s2.near, null);
  assert.ok(ARMS.every((a, i) => i === 0 || a.x < ARMS[i - 1].x) && ARMS[0].x < st.p.x, 'his arms lie to the left, in the order he reaches them');
  run(prologue, st, PRO_T.free + 0.1, () => ({ beat: 0 }));
  assert.equal(st.phase, 'armoury');
  st.arms = ['helmet', 'shield']; Object.assign(st.p, { x: ARMS[2].x });
  prologue.step(st, DT, { a: true, beat: 0 });
  assert.equal(st.phase, 'knighted'); assert.ok(!st.armed, 'not until the badges are drawn into him');
  run(prologue, st, PRO_T.armed + 0.1, () => ({ moveX: -1, beat: 0 }));
  assert.ok(st.armed); assert.equal(st.p.x, ARMS[2].x, 'he stands still to be transformed');
  run(prologue, st, PRO_T.risen - PRO_T.armed - 0.3, () => ({ moveX: -1, beat: 0 }));
  assert.equal(st.p.x, ARMS[2].x, 'he kneels while Aurora leaves');
  run(prologue, st, 8, () => ({ moveX: -1, beat: 0 }));
  assert.equal(st.status, 'won', 'out at the left, after Aurora');
  // or off at the right: either side finishes the scene
  const s3 = prologue.create({ from: { scene: 2 } });
  Object.assign(s3, { phase: 'knighted', phaseT: PRO_T.risen, arms: ARMS.map((a) => a.id), armed: true });
  run(prologue, s3, 8, () => ({ moveX: 1, beat: 0 }));
  assert.equal(s3.status, 'won', 'out at the right');
  assert.equal(s3.exitSide, 1);
});

test('Act II (touch): a tap on a sleeper swims him there and wakes him; a tap elsewhere is just the action', () => {
  const st = act2.create({ seed: 5, carry: {}, from: { scene: 1 } });
  for (let i = 0; i < 600 && st.phase !== 'swim'; i++) act2.step(st, 1 / 60, { beat: 0 });
  assert.equal(st.phase, 'swim');
  const sl = st.sleepers.find((q) => q.state === 'asleep' && Math.abs(q.y - st.sailor.y) < 600 && Math.hypot(q.x - st.sailor.x, q.y - st.sailor.y) > FILM_DIVE.wakeR + 60);
  assert.ok(sl, 'a sleeper out of reach');
  st.air = 1; st.guitar.y = Math.max(st.guitar.y, sl.y + 500);
  const tap = { x: sl.x, y: sl.y - 30 - st.cam + 60 };   // world to stage
  act2.step(st, 1 / 60, { tapAt: tap, x: true, beat: 0 });
  assert.equal(sl.state, 'asleep', 'out of reach, the tap does not wake him at once');
  assert.ok(st.tapTarget?.ref === sl, 'he heads for the one tapped');
  for (let i = 0; i < 60 * 8 && sl.state === 'asleep'; i++) { st.air = 1; act2.step(st, 1 / 60, { beat: i / 60 }); }
  assert.notEqual(sl.state, 'asleep', 'he swam there and woke him');
  // the stick takes over from a tap target
  const other = st.sleepers.find((q) => q.state === 'asleep' && q !== sl);
  act2.step(st, 1 / 60, { tapAt: { x: other.x, y: other.y - 30 - st.cam + 60 }, beat: 0 });
  act2.step(st, 1 / 60, { moveX: 1, beat: 0 });
  assert.equal(st.tapTarget, null);
  assert.equal(act2.touchTap(st), 'x', 'a tap is the action in the dive');
});

test('prologue: a gift is taken with either hand, not by walking into her', () => {
  const st = prologue.create({});
  const ring = FAIRIES.find((f) => f.gift === 'ring');
  Object.assign(st.p, { x: ring.x + ring.hand + 62, face: 1 });   // past her, short of the crown: both hands miss
  prologue.step(st, DT, { a: true, beat: 0 });
  assert.ok(!st.gifts.includes('ring'));
  Object.assign(st.p, { x: ring.x + ring.hand - HAND, face: 1 });   // the outstretched hand
  prologue.step(st, DT, { a: true, beat: 0 });
  assert.deepEqual(st.gifts, ['ring']);
  const crown = FAIRIES.find((f) => f.gift === 'crown');
  Object.assign(st.p, { x: crown.x + crown.hand - NEAR_HAND, face: 1 });   // the near hand, behind him
  prologue.step(st, DT, { a: true, beat: 0 });
  assert.deepEqual(st.gifts, ['ring', 'crown']);
});

test('prologue: at the rampart door he runs on, without a stop, until he is off the stage', () => {
  const st = prologue.create({ from: { scene: 1 } });
  Object.assign(st.p, { x: RAMPART.end - 5, vx: 250 }); st.fires.length = 0;
  let minV = Infinity, lastX = st.p.x;
  for (let i = 0; i < 300 && st.phase !== 'bind'; i++) {
    prologue.step(st, DT, { beat: 0 });
    if (st.phase === 'escape') { minV = Math.min(minV, (st.p.x - lastX) / DT); lastX = st.p.x; }
  }
  assert.equal(st.phase, 'bind');
  assert.ok(minV > 200, `never slows at the door (${minV.toFixed(0)} px/s)`);
});

test('prologue: his leap is silent and his landing a quiet thud', () => {
  const st = prologue.create({ from: { scene: 1 } });
  st.fires.length = 0;
  for (let i = 0; i < 300 && st.phase !== 'rampart'; i++) prologue.step(st, DT, { beat: 0 });
  const seen = [];
  for (let i = 0; i < 120; i++) { st.events.length = 0; prologue.step(st, DT, { a: i === 0, aHeld: i < 10, beat: 0 }); seen.push(...st.events); }
  const hop = seen.find((e) => e.type === 'hop'), land = seen.find((e) => e.type === 'land');
  assert.ok(hop && !hop.sound, 'the leap makes no sound');
  assert.ok(land && land.sound === 'thud' && land.gain <= 0.3, 'a quiet landing');
  assert.ok(!seen.some((e) => e.type === 'leap'), 'no loud leap sound');
});

test('prologue: the rampart fire burns on; each touch costs a lantern, and none left loses the chase', () => {
  const st = prologue.create({ from: { scene: 1 } });
  assert.equal(st.phase, 'rampart');
  assert.equal(st.lanterns, LANTERNS);
  const fire = { x: st.p.x + 5, y: RAMPART.y, lit: true, burn: 0 };
  st.fires.push(fire);
  prologue.step(st, DT, { moveX: 1, beat: 0 });
  assert.equal(st.knocks, 1);
  assert.equal(st.lanterns, LANTERNS - 1);
  for (let i = 0; i < 20; i++) prologue.step(st, DT, { beat: 0 });   // grace: no second burn at once
  assert.equal(st.lanterns, LANTERNS - 1);
  for (let i = 0; i < 600; i++) prologue.step(st, DT, { beat: 0 });
  assert.ok(st.fires.includes(fire) && fire.lit, 'the fire is still burning ten seconds on');
  for (let n = st.lanterns; n > 0; n--) { st.grace = 0; st.fires.push({ x: st.p.x, y: RAMPART.y, lit: true, burn: 0 }); prologue.step(st, DT, { beat: 0 }); }
  assert.equal(st.lanterns, 0);
  run(prologue, st, PRO_T.defeat + 1, () => ({ beat: 0 }));
  assert.equal(st.status, 'lost');
  assert.match(st.lostTitle, /Chariot/);
  assert.deepEqual(st.checkpoint, { scene: 1 }, 'a retry starts the chase again');
  const s2 = prologue.create({});
  let presses = 0;
  run(prologue, s2, 10, (s) => { const b = Math.floor(s.t * 3) !== Math.floor((s.t - DT) * 3); if (b) presses++; return { b }; });
  assert.equal(s2.status, 'won');
  assert.ok(presses <= 6, `${presses} presses`);
});

test('Act I: the tempest is a scene; the crew light the lanterns and the witch turns on the ship', () => {
  const st = ACTS[1].create({ seed: 2, from: { scene: 4 } });
  assert.equal(st.phase, 'party');
  let clock = 0;
  run(ACTS[1], st, 20, () => ({ beat: (clock += DT) / BEAT }), (s) => s.phase !== 'party');   // no input at all
  assert.equal(st.party.lit, 4);
  assert.deepEqual(st.party.on, [true, true, true, true]);
  assert.equal(st.phase, 'turn');
});

test('Act II dive: X wakes a sleeper within reach and takes an open clam\'s pearl; the sword runs on ahead', () => {
  const st = act2.create({ seed: 3, carry: {}, from: { scene: 1 } });
  assert.equal(st.phase, 'swim');
  const s = st.sailor, still = () => { s.vx = 0; s.vy = 0; };
  // a sleeper beside him (outside the conch's touch range) wakes on X
  const sl = st.sleepers.find((q) => q.state === 'asleep' && q.y > 1000);
  Object.assign(s, { x: sl.x + 160, y: sl.y }); st.hornT = 0; st.guitar.y = s.y + 600; still();
  act2.step(st, 1 / 60, { beat: 0.5 });
  assert.equal(sl.state, 'asleep');
  assert.equal(st.reach?.kind, 'sleeper', 'the X prompt shows');
  still(); act2.step(st, 1 / 60, { x: true, beat: 0.5 });
  assert.equal(sl.state, 'rising');
  // an open clam's pearl from just above it, with X
  const cl = st.clams[0], beat = cl.off + 0.5;
  Object.assign(s, { x: cl.x, y: cl.y - 48 - 90 }); st.guitar.y = s.y + 600; still();
  const before = st.pearls;
  act2.step(st, 1 / 60, { beat });
  assert.equal(st.pearls, before, 'not by hovering near');
  still(); act2.step(st, 1 / 60, { x: true, beat });
  assert.equal(st.pearls, before + 1);
  // the sword, close below, sinks at its brisk close pace (three-quarters of
  // the earlier 230 px/s, 31 Oct 2026)
  st.guitar.y = s.y + FILM_DIVE.lead + 20; const gy = st.guitar.y;
  act2.step(st, 1, { beat: 3 });
  assert.ok(st.guitar.y - gy >= 150 && st.guitar.y - gy <= 180, `sword sank ${st.guitar.y - gy}`);
});

test('Act II ride: pearls to leap for float only over the top row, and the whole carriage catches', () => {
  const st = act2.create({ seed: 3, carry: {}, from: { scene: 5 } });
  assert.equal(st.phase, 'ride');
  assert.ok(st.ride.pearls.some((p) => p.high));
  assert.ok(st.ride.pearls.filter((p) => p.high).every((p) => p.row === 0));
  assert.ok(RIDE.catchX >= 120, 'the stern catches as well as the bow');
});

test('Act II: he swims to the Water Fairy for her blessing (no button, no refusal)', () => {
  const st = act2.create({ seed: 3, carry: {}, from: { scene: 4 } });
  run(act2, st, 4, () => ({ a: true, b: true }));   // pressing does nothing
  assert.equal(st.choice, null);
  run(act2, st, 12, (s) => ({ moveX: Math.sign(FAIRY_AT.x - s.sailor.x), moveY: s.sailor.y < FAIRY_AT.y + 40 ? 1 : 0 }), (s) => s.choice != null);
  assert.equal(st.choice, 'take');
  assert.ok(act2.cast['witch-stand'] === 'water-fairy-stand');
});

test('Act III: he bows past the lobster guards, leaps for the sea-flora pearls, and walks into the court', () => {
  const st = act3.create({ seed: 1, carry: {} });
  assert.ok(st.tf, 'the passage opens the act');
  let clock = 0;
  run(act3, st, 40, (s) => {
    if (!s.tf) return {};
    const f = s.tf;
    const guard = f.guards.find(g => !g.passed);
    if (guard && guard.mode !== 'wait' && Math.abs(guard.x - f.x) < 175) return { xHeld: true, beat: (clock += DT) / BEAT };
    if (guard) return { moveX: 1 };
    const pearl = PASSAGE.pearls.find((_, i) => !f.got.includes(i));
    return pearl ? { moveX: Math.abs(pearl[0] - f.x) > 10 ? Math.sign(pearl[0] - f.x) : 0, a: Math.abs(pearl[0] - f.x) < 75 && f.lift === 0 } : { moveX: 1 };
  }, (s) => !s.tf);
  assert.equal(st.tf, null);
  assert.equal(st.pearls, PASSAGE.pearls.length, 'every pearl, by leaping');
  // upright before a guard, he is caught and thrown back; bowing, he passes
  const s3 = act3.create({ seed: 1, carry: {} });
  run(act3, s3, 3, () => ({ moveX: 1 }), (s) => s.tf.caught > 0);
  assert.equal(s3.tf.caught, 1);
  assert.equal(s3.tf.capture.kind, 'lobster');
  // walking under the pearls without leaping takes none
  const s4 = act3.create({ seed: 1, carry: {} });
  s4.tf.x = 760; s4.tf.guards.forEach(g => { g.mode = 'parked'; g.passed = true; g.x = g.park; });
  run(act3, s4, 8, () => ({ moveX: 1 }), (s) => !s.tf || s.tf.fade > 0);
  assert.equal(s4.pearls, 0);
  const s2 = act3.create({ seed: 1, carry: {}, from: { scene: 1 } });
  assert.ok(!s2.tf, 'not on a resume');
});

test('Act III court: the courtier he poses behind holds still while he hides', () => {
  const st = act3.create({ seed: 1, carry: {}, from: { scene: 1 } });
  const p = st.p, c = st.courtiers.find((q) => q.kind !== 'guard' && q.row === p.row) || st.courtiers.find((q) => q.kind !== 'guard');
  p.row = p.from = c.row; p.x = c.x;
  const x = c.x;
  let beat = 0;
  for (let i = 0; i < 60 * 8; i++) act3.step(st, 1 / 60, { xHeld: true, beat: (beat += 1 / 60 / 0.784) });
  assert.ok(p.frozen);
  assert.equal(c.x, x, 'his courtier did not step away');
});

test('Act V: the swim is won by diving under her swoops, then the tower wall begins', () => {
  const st = actTower.create({ seed: 9, carry: {}, from: { scene: 2 } });
  assert.equal(st.phase, 'swim');
  run(actTower, st, 60, (s) => {
    if (s.phase !== 'swim') return {};
    const sw = s.sw, near = sw.swoop && Math.abs(sw.swoop.x - sw.x) < 140 && sw.swoop.lead - sw.swoop.t < 0.5;
    return { moveX: 1, a: !!near && sw.dive <= 0 };
  }, (s) => s.phase === 'tower');
  assert.equal(st.phase, 'tower', `phase ${st.phase}, x ${st.sw?.x}`);
  assert.equal(st.lanterns, 3, 'no swoop landed');
  assert.ok(st.sw.aurora != null && st.sw.swoops >= 1, `Aurora drove her off after ${st.sw.swoops} swoops`);
});

test('Act V: faster channel traversal reaches the far bank before the tower cut',()=>{
 const st=actTower.create({from:{scene:2}});
 run(actTower,st,8,()=>({moveX:1,a:st.sw.dive<=0&&!!st.sw.swoop}),s=>s.sw.arrivalT!=null);
 assert.equal(st.phase,'swim');assert.equal(st.sw.x,SEA.len);assert.equal(st.sw.arrivalT,0);
 assert.ok(swimPosition(st.sw).x>=865);
 run(actTower,st,.9);assert.equal(st.phase,'swim');assert.equal(swimPosition(st.sw).land,1);
 run(actTower,st,.3);assert.equal(st.phase,'tower');
 assert.ok(diveFloor(365)>diveFloor(210)+20,'feet follow the descending painted path');
});

test('Act V: a swimmer who never dives is caught', () => {
  const st = actTower.create({ seed: 9, carry: {}, from: { scene: 2 } });
  run(actTower, st, 30, () => ({ moveX: 0.6 }));
  assert.ok(st.lanterns < 3);
});

// A simple climber: up, steering for a target x once it is set.
const climbBot = (target = () => null) => (s) => {
  const w = s.wall; if (!w) return {};
  const tx = target(s);
  return { moveY: -1, moveX: tx == null ? 0 : Math.sign(tx - w.x) * (Math.abs(tx - w.x) > 8 ? 0.8 : 0) };
};

test('Act V: the film cliff is climbed anywhere on its painted face, faster up ivy and cracks than bare rock', () => {
  for (const scene of [0, 1]) {
    const st = actTower.create({ seed: 1, carry: {}, from: scene ? { scene } : null });
    assert.ok(st.wall && st.wall.name === 'cliff');
    assert.equal(st.wall.mode, 'ledge', `scene ${scene} starts standing on a ledge`);
    assert.ok(!st.holds.some((h) => h.kind === 'boot' || h.kind === 'gap'), 'no giant and no guitarist');
  }
  const map = CLIMB_MAPS.cliff;
  const count = (ch) => map.grid.reduce((n, row) => n + row.split(ch).length - 1, 0);
  for (const ch of 'vkrs') assert.ok(count(ch) > 300, `the cliff has ${ch} terrain`);
  assert.ok(CLIMB.speed.v > CLIMB.speed.k && CLIMB.speed.k > CLIMB.speed.r && CLIMB.speed.r > CLIMB.speed.s, 'ivy > crack > rock > slick');
  assert.ok(CLIMB.walk > CLIMB.speed.v, 'he walks a ledge faster than he climbs');
  // every pearl hangs where he can reach it
  const st = actTower.create({ seed: 1, carry: {} });
  for (const p of st.wall.pearls) assert.notEqual(terrainAt(map, p.x, p.y + 20), '.', `pearl at ${p.x},${p.y}`);
});

test('Act V: up into a ledge he hauls himself onto it, walks it, and lowers himself off', () => {
  const st = actTower.create({ seed: 1, carry: {} });
  const w = st.wall, map = w.map;
  // under a ledge with face below it: climb up into it
  const l = map.ledges.find((o) => o.y > 300 && terrainAt(map, (o.x0 + o.x1) / 2, o.y - 120) !== '.' && terrainAt(map, (o.x0 + o.x1) / 2, o.y - 30) !== '.');
  Object.assign(w, { mode: 'wall', x: (l.x0 + l.x1) / 2, y: l.y - 150, t: 0 });
  st.inv = 99; st.camY = Math.max(0, l.y - 250);
  const modes = new Set();
  run(actTower, st, 4, () => ({ moveY: -1 }), (s) => { modes.add(s.wall.mode); return s.wall.mode === 'ledge'; });
  assert.ok(modes.has('mantle'), 'he hauls himself up');
  assert.equal(w.mode, 'ledge'); assert.equal(w.y, l.y);
  // walk along it
  const x0 = w.x, toward = x0 - l.x0 < l.x1 - x0 ? 1 : -1;
  run(actTower, st, 0.1, () => ({ moveX: toward }));
  assert.ok(Math.abs(w.x - x0) > 15 && w.mode === 'ledge', 'he walks the ledge');
  // and down off it
  run(actTower, st, 1, () => ({ moveY: 1 }), (s) => s.wall.mode === 'wall');
  assert.equal(w.mode, 'wall'); assert.ok(w.y < l.y);
});

test('Act V: the painted edge stops him, and dry ivy tears if he lingers', () => {
  const st = actTower.create({ seed: 1, carry: {} });
  const w = st.wall; st.inv = 99;
  Object.assign(w, { mode: 'wall', x: 300, y: 600 });
  run(actTower, st, 3, () => ({ moveX: -1 }));
  assert.ok(w.x >= CLIMB_MAPS.cliff.x0, `held at the cloth's edge (x ${w.x})`);
  const cr = w.crumbles[0];
  Object.assign(w, { mode: 'wall', x: cr.x, y: cr.y - CLIMB.hands * 0.6 });
  st.inv = 0; const before = st.lanterns;
  run(actTower, st, 1.2, () => ({}), (s) => s.wall.mode === 'fall');
  assert.ok(cr.gone, 'the dry ivy tears'); assert.equal(st.lanterns, before - 1);
});

test('Act V: climbing on up the cliff reaches the clifftop and the dive', () => {
  const st = actTower.create({ seed: 1, carry: {} });
  run(actTower, st, 90, (s) => { s.inv = 99; return climbBot()(s); }, (s) => s.phase !== 'cliff');
  assert.equal(st.phase, 'dive', `phase ${st.phase} at ${Math.round(st.wall.x)},${Math.round(st.wall.y)}`);
});

test('Act V: the tower wall is climbed to her window', () => {
  const st = actTower.create({ seed: 1, carry: {}, from: { scene: 3 } });
  assert.equal(st.wall.name, 'tower');
  assert.ok(TOWER_TOP > 1000);
  run(actTower, st, 90, (s) => { s.inv = 99; return climbBot((q) => (q.wall.y > 1250 ? TOWER_WINDOW.x : null))(s); }, (s) => s.phase !== 'tower');
  assert.ok(['window', 'iris'].includes(st.phase), `phase ${st.phase} at ${Math.round(st.wall.x)},${Math.round(st.wall.y)}`);
});

test('Act V: reaching the window plays the window shot and wins', () => {
  const st = actTower.create({ seed: 1, carry: {}, from: { scene: 4 } });
  assert.equal(st.wall.mode, 'ledge', 'the halfway checkpoint stands him on its ledge');
  run(actTower, st, 60, (s) => { s.inv = 99; return climbBot((q) => (q.wall.y > 1250 ? TOWER_WINDOW.x : null))(s); }, (s) => s.phase !== 'tower');
  assert.ok(['window', 'iris'].includes(st.phase) || st.status === 'won', st.phase);
  run(actTower, st, FILM_T.window + FILM_T.iris + 1);
  assert.equal(st.status, 'won');
});

test('Tower rescue: right-hand fires fade from pickup, clear by the ground, and the escape is on the right',()=>{
 const st=actBurning.create({from:{scene:0}});st.haz=[];st.nextHaz=999;
 st.p.x=HOUSE.beloved;st.p.f=2;st.p.y=HOUSE.floors[2];
 assert.equal(towerEscapeFire(st),1);actBurning.step(st,DT,{});
 assert.equal(st.p.carry,true);assert.equal(st.escapeT,0);assert.equal(towerEscapeFire(st),1);
 run(actBurning,st,2);assert.ok(towerEscapeFire(st)>0&&towerEscapeFire(st)<1);
 run(actBurning,st,20,s=>{
  if(s.p.conn)return{moveY:1};
  const target=s.p.f===2?720:800;
  return Math.abs(s.p.x-target)<15?{moveY:1}:{moveX:Math.sign(target-s.p.x)};
 },s=>s.p.f===0);
 assert.equal(st.phase,'house');assert.equal(st.p.f,0);assert.equal(towerEscapeFire(st),0,'the ground-floor route is completely clear');
 st.p.x=HOUSE.door;actBurning.step(st,DT,{});assert.equal(st.phase,'house','the old left-hand doorway cannot finish the rescue');
 run(actBurning,st,6,()=>({moveX:1}),s=>s.phase!=='house');assert.equal(st.phase,'quay');
 assert.equal(st.checkpoint.scene,2);assert.equal(st.p.face,1);
});

test('Tower escape: waiting also extinguishes the right fires, and checkpoints retain the fade',()=>{
 const st=actBurning.create({from:{scene:1,escapeT:3,escapeFire:.6}});st.haz=[];st.nextHaz=999;
 assert.equal(towerEscapeFire(st),.6);
 st.p.x=720;st.p.f=1;st.p.y=HOUSE.floors[1];actBurning.step(st,DT,{});assert.equal(towerEscapeFire(st),.5);
 st.p.x=HOUSE.beloved;st.p.f=2;st.p.y=HOUSE.floors[2];actBurning.step(st,DT,{});assert.equal(towerEscapeFire(st),.5,'climbing back up cannot restore a higher flame level');
 run(actBurning,st,TOWER_ESCAPE.fireSeconds+1);
 assert.equal(st.p.f,2);assert.equal(towerEscapeFire(st),0);
 st.p.y=HOUSE.floors[2];actBurning.step(st,DT,{});assert.equal(towerEscapeFire(st),0,'moving upward cannot rekindle extinguished fires');
});

test('Act VI: out on the cliff, push the barrel over, walk the wedding street and into the light', () => {
  const st = actBurning.create({ seed: 4, carry: { sleepers: 5 }, from: { scene: 2 } });
  assert.equal(st.phase, 'quay');
  run(actBurning, st, 20, () => ({ moveX: 1 }), (s) => s.phase !== 'quay');
  assert.equal(st.phase, 'barrel', st.phase);
  assert.equal(st.checkpoint.scene, 3, 'renumbered to the film scene');
  // the fight: walk up to her, leap her fire, strike beside her (a fresh
  // press each time); then she hides in the barrel and he pushes it over
  let last = false;
  const fresh = (want) => { const a = want && !last; last = want; return a; };
  run(actBurning, st, 60, (s) => {
    if (!s.duel) return { moveX: 1 };
    const fire = s.duel.bolts.some((b) => b.x > s.w.x && b.x - s.w.x < 90);
    return { moveX: duelReach(s) ? 0 : 1, a: fire, aHeld: true, x: fresh(duelReach(s) && s.duel.state !== 'reel') };
  }, (s) => s.phase !== 'barrel');
  assert.equal(st.phase, 'victory');
  run(actBurning, st, FILM_T.victory + FILM_T.victoryFade + 0.1);
  assert.equal(st.phase, 'wedding', st.phase);
  assert.equal(st.checkpoint.scene, 4);
  run(actBurning, st, 20, () => ({ moveX: 1 }), (s) => s.phase !== 'wedding');
  assert.equal(st.phase, 'apotheosis');
  run(actBurning, st, 20, (s) => ({ moveX: s.w.x < APOTH.mark ? 1 : 0, a: Math.abs(s.w.x - APOTH.mark) < 20, aHeld: true }));
  assert.equal(st.phase, 'finale', 'the final tableau holds for the rolling credits');
  assert.equal(st.status, 'play', 'the ending is not cut short by the old iris');
  assert.equal(actBurning.mood(st), 'wedding');
  run(actBurning, st, FINALE_END + 1);
  assert.equal(st.status, 'play', 'free play continues after the credits');
  assert.ok(st.creditsT > FINALE_END);
  assert.equal(st.result.ending, 'wedding');
});

test("Act VI: the witch's last stand: her fire costs a lantern, X strikes, three blows beat her, Aurora's barrel traps her and rolls without a fight", () => {
  const st = actBurning.create({ seed: 4, carry: {}, from: { scene: 3, introDone: true } });
  assert.ok(st.duel && !st.barrel, 'she fights before she hides');
  st.w.x = AURORA.shieldX + 80; // ahead of Aurora's protection, in the line of fire
  const lanterns = st.lanterns;
  run(actBurning, st, 8, () => ({}), (s) => s.lanterns < lanterns);
  assert.equal(st.lanterns, lanterns - 1, 'standing still, her fire reaches him');
  // A leaps; X swings the sword, a blow only when it reaches her; walking
  // into her does nothing
  const s2 = actBurning.create({ seed: 4, carry: {}, from: { scene: 3, introDone: true } });
  actBurning.step(s2, 1 / 60, { a: true });
  assert.equal(s2.duel.hp, DUEL.hp);
  assert.ok(!s2.w.on, 'a leap');
  const s3 = actBurning.create({ seed: 4, carry: {}, from: { scene: 3, introDone: true } });
  actBurning.step(s3, 1 / 60, { x: true });
  assert.equal(s3.duel.hp, DUEL.hp, 'a swing out of reach misses');
  s3.duel.next = 99;
  run(actBurning, s3, 3, () => ({ moveX: 1 }));
  assert.equal(s3.duel.hp, DUEL.hp, 'walking into her is no blow');
  let last = false;
  const fresh = (want) => { const a = want && !last; last = want; return a; };
  let trapped = false;
  run(actBurning, s2, 20, (s) => { if (s.duel?.state === 'trap') trapped = true; return s.duel ? { moveX: duelReach(s) ? 0 : 1, x: fresh(duelReach(s) && s.duel.state !== 'reel') } : {}; }, (s) => !s.duel);
  assert.ok(trapped, "Aurora's barrel drops over her");
  assert.ok(!s2.duel && s2.barrel, 'beaten, she hides in her barrel');
  const x0 = s2.barrel.x;
  run(actBurning, s2, 10, () => ({ moveX: 1 }), (s) => s.phase !== 'barrel');
  assert.ok(s2.phase === 'wedding' || s2.barrel?.fallT != null || s2.barrel.x > x0, 'he rolls it to the edge');
});

test('Battle entrance: Aurora drives the witch back before the prince arrives, with combat input locked',()=>{
 const st=actBurning.create({from:{scene:3}});const lanterns=st.lanterns;
 assert.ok(st.battleIntro);assert.equal(st.w.x,BATTLE_INTRO.heroFrom);assert.equal(st.duel.x,BATTLE_INTRO.witchFrom);
 assert.equal(actBurning.touchLive(st),false);assert.equal(actBurning.hud(st),null);assert.equal(actBurning.focus(st),null);
 run(actBurning,st,1,()=>({moveX:1,a:true,x:true}));
 assert.equal(st.w.x,BATTLE_INTRO.heroFrom);assert.ok(st.duel.x>BATTLE_INTRO.witchFrom&&st.duel.x<DUEL.x);
 assert.equal(st.duel.hp,3);assert.equal(st.lanterns,lanterns);assert.deepEqual(st.duel.bolts,[]);
 run(actBurning,st,BATTLE_INTRO.faceoff+.2,()=>({moveX:-1,x:true}),s=>battleIntroFrame(s).stage==='arrival');
 assert.equal(st.duel.x,DUEL.x);run(actBurning,st,1);
 assert.ok(st.w.x>BATTLE_INTRO.heroFrom&&st.w.x<BATTLE_INTRO.handoff);
 assert.equal(st.shelteredAz,null);assert.equal(st.duel.hp,3);
});

test('Battle entrance: set Azurine behind Aurora, step forward, and save a ready-to-fight retry',()=>{
 const st=actBurning.create({from:{scene:3}});
 run(actBurning,st,BATTLE_INTRO_END+1,()=>({a:true,x:true,moveX:1}),s=>battleIntroFrame(s).stage==='rise');
 assert.ok(st.shelteredAz);assert.equal(st.shelteredAz.x,BATTLE_INTRO.shelter);assert.ok(st.shelteredAz.x<AURORA.x);
 assert.equal(st.p.carry,false);assert.equal(actBurning.touchLive(st),false);
 run(actBurning,st,BATTLE_INTRO_END,()=>({}),s=>!s.battleIntro);
 assert.equal(st.battleIntro,null);assert.equal(st.w.x,BATTLE_INTRO.ready);assert.ok(st.w.x>AURORA.x);
 assert.equal(st.phaseT,0);assert.equal(st.duel.hp,3);assert.equal(st.duel.t,0);assert.equal(actBurning.touchLive(st),true);
 assert.equal(st.checkpoint.introDone,true);assert.equal(st.checkpoint.scene,3);
 const retry=actBurning.create({from:st.checkpoint});assert.equal(retry.battleIntro,null);assert.equal(retry.w.x,BATTLE_INTRO.ready);
 assert.equal(retry.shelteredAz.x,BATTLE_INTRO.shelter);assert.equal(retry.p.carry,false);
});

test('Battle entrance: Azurine remains safely sheltered through the fight and barrel push',()=>{
 const st=actBurning.create({from:{scene:3,introDone:true}}),az=JSON.stringify(st.shelteredAz);
 st.w.x=AURORA.x-30;run(actBurning,st,8);
 assert.equal(JSON.stringify(st.shelteredAz),az);assert.equal(st.lanterns,3);
 st.duel=null;st.barrel={x:DUEL.x,rot:0,fallT:null};run(actBurning,st,2,()=>({moveX:1}));
 assert.equal(JSON.stringify(st.shelteredAz),az);
});

test('Witch duel: each successful hit shoves him halfway back and immediately starts another attack',()=>{
 const st=actBurning.create({from:{scene:3, introDone: true}});st.duel.next=99;
 st.w.x=st.duel.x-DUEL.reach-18+3;
 const lanterns=st.lanterns;actBurning.step(st,DT,{x:true});
 assert.equal(st.duel.hp,2);assert.equal(st.duel.state,'reel');const reset=duelResetX(st);
 run(actBurning,st,DUEL.reel+.1,()=>({x:true,moveX:1}),s=>s.duel.state==='counter');
 assert.equal(st.duel.hp,2,'spam cannot chain the next hit during her recoil');
 assert.equal(st.w.x,reset);assert.equal(st.w.on,true);assert.equal(st.lanterns,lanterns,'the successful-hit shove causes no damage');
 assert.ok(st.duel.bolts.some(b=>b.counter));assert.equal(duelReach(st),false);
 run(actBurning,st,.4,()=>({moveX:1}));assert.equal(st.lanterns,lanterns-1,'walking straight back into the counterattack gets hit');
});

test('Witch duel: a fresh jump on the next approach clears the counterattack',()=>{
 const st=actBurning.create({from:{scene:3, introDone: true}});st.duel.next=99;st.w.x=st.duel.x-DUEL.reach-18+3;
 actBurning.step(st,DT,{x:true});run(actBurning,st,1,()=>({}),s=>s.duel.state==='counter');
 const lanterns=st.lanterns;actBurning.step(st,DT,{moveX:1,a:true,aHeld:true});
 run(actBurning,st,.45,()=>({moveX:1,aHeld:true}));assert.equal(st.lanterns,lanterns);
 assert.ok(st.w.y<BARREL.y-DUEL.boltH);assert.equal(st.duel.hp,2);
});

test('Witch duel: three jump approaches beat her at the edge, with two resets and a large barrel to push',()=>{
 const st=actBurning.create({from:{scene:3, introDone: true}}),events=[];let last=false;
 assert.equal(st.duel.x+BARREL.hw,BARREL.edge);
 for(let t=0;t<30&&st.duel;t+=DT){
  const fire=st.duel.bolts.some(b=>b.x>st.w.x&&b.x-st.w.x<100);
  const strike=duelReach(st);actBurning.step(st,DT,{moveX:strike?0:1,a:fire&&st.w.on,aHeld:true,x:strike&&!last});last=strike;
  events.push(...st.events);st.events.length=0;
 }
 assert.equal(st.duel,null);assert.ok(st.barrel);assert.equal(st.lanterns,3);
 assert.equal(events.filter(e=>e.type==='witchStruck').length,3);
 assert.equal(events.filter(e=>e.type==='witchBlast'&&e.repel).length,2);
 assert.equal(events.filter(e=>e.type==='witchBolt'&&e.counter).length,2);
 assert.equal(st.barrel.x+BARREL.hw,BARREL.edge,'the barrel rests at the very lip');
});

test('Act VI: Aurora always faces right and turns incoming fire into harmless, temporary smoke', () => {
  const st = actBurning.create({ from: { scene: 3, introDone: true } });
  st.w.x = AURORA.x - 35;
  assert.equal(auroraFacing(st), 1);
  st.duel.next = 99;
  st.duel.bolts = [{ x: AURORA.shieldX + 2 }];
  const lanterns = st.lanterns;
  actBurning.step(st, DT);
  assert.equal(st.duel.bolts.length, 0);
  assert.equal(st.lanterns, lanterns);
  assert.equal(st.smoke.length, 1);
  assert.ok(st.events.some(e => e.type === 'auroraQuenches'));
  run(actBurning, st, AURORA.smokeLife + 0.1);
  assert.equal(st.smoke.length, 0);
  assert.equal(st.lanterns, lanterns, 'smoke cannot cost a lantern');
  st.w.x = AURORA.shieldX + 80;
  assert.equal(auroraFacing(st), 1);
  st.duel.bolts = [{ x: st.w.x + 10 }];
  actBurning.step(st, DT);
  assert.equal(st.lanterns, lanterns - 1, 'fire ahead of her still needs to be leapt');
});

test('Act VI: victory sounds once after the witch disappears, never during defeat, trapping or falling', () => {
  const st = actBurning.create({ seed: 4, carry: {}, from: { scene: 3, introDone: true } });
  const seen = [];
  let last = false;
  for (let t = 0; t < 60 && ['barrel', 'victory'].includes(st.phase); t += DT) {
    const strike = !!st.duel && duelReach(st) && st.duel.state !== 'reel';
    const input = st.duel ? { moveX: duelReach(st) ? 0 : 1, x: strike && !last } : { moveX: 1 };
    last = strike;
    actBurning.step(st, DT, input);
    for (const e of st.events) {
      seen.push(e);
      if (e.sound === 'victoryStinger') {
        assert.equal(st.phase, 'victory');
        assert.ok(st.barrel.fallT >= FILM_T.barrelFall, 'the entire barrel fade has finished');
      }
    }
    st.events.length = 0;
  }
  assert.equal(st.phase, 'wedding');
  for (const type of ['witchBeaten', 'witchInBarrel', 'barrelFall']) {
    assert.ok(seen.some(e => e.type === type), type);
    assert.ok(seen.filter(e => e.type === type).every(e => !e.sound), 'no early flourish');
  }
  assert.deepEqual(seen.filter(e => e.sound === 'victoryStinger').map(e => e.type), ['witchGone']);
  for (let i = 0; i < 60; i++) {
    actBurning.step(st, DT, {});
    assert.ok(!st.events.some(e => e.sound === 'victoryStinger'), 'no repeat in the wedding');
    st.events.length = 0;
  }
});

test('Act VI: the empty cliff fades with the last chord, then the wedding fades in gradually', () => {
  const st = actBurning.create({ from: { scene: 3, introDone: true } });
  st.duel = null;
  st.barrel = { x: BARREL.edge, fallT: FILM_T.barrelFall - DT / 2, rot: 0 };
  actBurning.step(st, DT);
  assert.equal(st.phase, 'victory');
  assert.equal(actBurning.fade(st), 0);
  run(actBurning, st, FILM_T.victory - 0.1, () => ({ a: true, moveX: 1 }));
  assert.equal(st.phase, 'victory', 'input cannot skip the flourish');
  assert.equal(actBurning.fade(st), 0);
  st.phaseT = FILM_T.victory + FILM_T.victoryFade / 2;
  assert.ok(Math.abs(actBurning.fade(st) - 0.5) < 1e-9);
  run(actBurning, st, FILM_T.victoryFade / 2 + 0.1);
  assert.equal(st.phase, 'wedding');
  assert.ok(actBurning.fade(st) > 0.8, 'wedding starts behind black and fades in');
  assert.ok(FILM_T.victory < 3.5 && FILM_T.victory + FILM_T.victoryFade < 5.2, 'fade follows the audible final chord, before the silent MP3 tail');
  assert.ok(FILM_T.weddingFade > 2.5);
});

test('Act VI: the wedding stays black and still for its musical lead, then reveals gradually', () => {
  const st = actBurning.create({from:{scene:4}}), x=st.w.x;
  run(actBurning,st,FILM_T.weddingLead-0.1,()=>({moveX:1,a:true}));
  assert.equal(st.w.x,x);assert.equal(st.w.on,true);
  assert.equal(actBurning.fade(st),1);
  st.phaseT=FILM_T.weddingLead+FILM_T.weddingFade/2;
  assert.ok(Math.abs(actBurning.fade(st)-0.5)<1e-9);
});

test('Act VI: celebratory jumps lift the couple together and ripple through guests by distance', () => {
  const st = actBurning.create({ carry: { sleepers: 4 }, from: { scene: 4 } });
  st.phaseT = FILM_T.weddingLead;
  assert.ok(weddingGuests(st).every(([id]) => guestHop(st, id) === 0));
  actBurning.step(st, DT, { a: true, aHeld: true });
  assert.equal(st.w.on, false); assert.equal(st.az.on, false);
  assert.equal(st.w.y, st.az.y, 'Azurine follows the same leap arc');
  assert.equal(st.cheers.length, 1);
  const expected = [...weddingGuests(st)].sort((a,b) => Math.abs(a[1]-st.w.x)-Math.abs(b[1]-st.w.x)).map(([id])=>id);
  assert.deepEqual(st.cheers[0].order, expected);
  st.clock += CELEBRATION.stagger / 2;
  assert.ok(guestHop(st, expected[0]) > 0);
  assert.equal(guestHop(st, expected[1]), 0, 'the next guest has not jumped yet');
  run(actBurning, st, 3);
  assert.equal(st.w.on, true); assert.equal(st.az.on, true);
  assert.equal(st.cheers.length, 0, 'the wave finishes cleanly');
  assert.ok(actBurning.touchLive(st), 'touch jumping remains available');
});

test('Act VI: walking across the final tableau never ends it; jump beneath Aurora to ascend', () => {
  const st = actBurning.create({ from: { scene: 4 } });
  st.phaseT = FILM_T.weddingLead;
  run(actBurning,st,20,()=>({moveX:1}),s=>s.phase!=='wedding');
  assert.equal(st.phase, 'apotheosis');
  run(actBurning, st, 3, () => ({ moveX: 1 }));
  run(actBurning, st, 2, () => ({ moveX: -1 }));
  assert.equal(st.riseT, null);
  actBurning.step(st, DT, { a: true });
  assert.equal(st.riseT, null, 'jumping away from Aurora is only a celebration');
  run(actBurning, st, 1);
  st.w.x = APOTH.mark; st.w.vx = 0;
  run(actBurning, st, 3);
  assert.equal(st.riseT, null, 'standing in the light does not trigger the ending');
  actBurning.step(st, DT, { a: true, aHeld: true });
  assert.equal(st.riseT, 0);
  assert.equal(st.w.on, false); assert.equal(st.az.on, false);
  run(actBurning, st, FILM_T.rise + 0.1);
  assert.equal(st.phase, 'finale');
});

test('Wedding: climb the painted stairs, cross the whole doorway together, and return to the same guests',()=>{
 const st=actBurning.create({carry:{sleepers:4},from:{scene:4}});st.phaseT=5;st.weddingIntro=false;
 st.petals[0].got=true;st.petalsGot=1;st.score=20;
 run(actBurning,st,2,()=>({moveX:1}));
 assert.ok(st.w.stairs);assert.ok(st.w.y<WEDDING.y-40);
 const high=st.w.y;run(actBurning,st,.6,()=>({moveX:-1}));assert.ok(st.w.y>high,'walking back descends');
 st.w.x=WEDDING.gate;st.w.y=weddingFloor(st.w.x);st.w.vx=0;st.az.x=WEDDING.gate-100;st.az.y=weddingFloor(st.az.x);
 actBurning.step(st,DT,{});assert.equal(st.phase,'wedding','the prince waits for Azurine to cross');
 run(actBurning,st,3,()=>({moveX:1}),s=>s.phase!=='wedding');assert.equal(st.phase,'apotheosis');
 run(actBurning,st,3,()=>({moveX:-1}),s=>s.phase==='wedding');assert.equal(st.phase,'wedding');
 assert.equal(st.weddingIntro,false);assert.equal(actBurning.touchLive(st),true,'touch movement remains active immediately outside');assert.equal(st.weddingMusicStarted,true);assert.equal(st.petalsGot,1);assert.equal(st.score,20);assert.ok(st.petals[0].got);
 actBurning.step(st,1/144,{moveX:-1});assert.equal(st.phase,'wedding','high refresh-rate return cannot re-enter the door');
 const landing=st.w.y;run(actBurning,st,2,()=>({moveX:-1}));assert.ok(st.w.y>landing,'the return path comes down the stairs');
});

test('The backward exit needs a continuous one-second hold; releasing or walking away resets it',()=>{
 const st=actBurning.create({from:{scene:4}});st.phaseT=5;st.weddingIntro=false;
 run(actBurning,st,20,()=>({moveX:1}),s=>s.phase!=='wedding');
 st.w.x=APOTH.x0;st.w.vx=0;
 run(actBurning,st,.7,()=>({moveX:-1}));assert.equal(st.phase,'apotheosis');assert.ok(st.backT>.6);
 actBurning.step(st,DT,{});assert.equal(st.backT,0);
 run(actBurning,st,.7,()=>({moveX:-1}));assert.equal(st.phase,'apotheosis');
 actBurning.step(st,DT,{moveX:1});assert.equal(st.backT,0);
 run(actBurning,st,1.2,()=>({moveX:-1}),s=>s.phase==='wedding');assert.equal(st.phase,'wedding');
 assert.equal(st.weddingIntro,false);
 // Even holding forward immediately must first finish the short descent.
 run(actBurning,st,.8,()=>({moveX:1}),s=>!s.weddingExit);assert.equal(st.phase,'wedding');
 assert.equal(st.weddingExit,false);assert.ok(st.w.x < WEDDING.door-40);
 run(actBurning,st,.2,()=>({moveX:1}));assert.equal(st.phase,'wedding');
 run(actBurning,st,3,()=>({moveX:1}),s=>s.phase!=='wedding');assert.equal(st.phase,'apotheosis');
});

test('Credits free play: held aloft until the roll begins, then released slowly by any direction, visit both sets and jump again without restarting credits',()=>{
 const st=actBurning.create({from:{scene:4}});st.phaseT=5;st.weddingIntro=false;
 run(actBurning,st,20,()=>({moveX:1}),s=>s.phase!=='wedding');
 st.w.x=APOTH.mark;st.w.vx=0;st.az.x=APOTH.mark-70;
 actBurning.step(st,DT,{a:true,aHeld:true});run(actBurning,st,FILM_T.rise+.1);
 assert.equal(st.flight,'hold');assert.equal(st.lift,140);assert.equal(st.phase,'finale');
 run(actBurning,st,3);assert.equal(st.flight,'hold');
 actBurning.step(st,DT,{moveY:1});assert.equal(st.flight,'hold','held aloft until the credits begin to roll');
 run(actBurning,st,FINALE.celebrate-3);assert.equal(st.flight,'hold');const firstClock=st.creditsT;
 actBurning.step(st,DT,{moveY:1});assert.equal(st.flight,'descend');assert.ok(st.lift>130);
 run(actBurning,st,FILM_T.descend/2,()=>({moveY:1}));assert.ok(st.lift>20&&st.lift<120,'a slow descent');
 run(actBurning,st,FILM_T.descend/2+.1,()=>({moveY:1}));assert.equal(st.flight,null);assert.equal(st.w.on,true);assert.equal(st.az.on,true);
 assert.equal(st.w.y,APOTH.y);assert.ok(st.creditsT>firstClock);
 const beforeJump=st.creditsT;actBurning.step(st,DT,{a:true});run(actBurning,st,FILM_T.rise+.1);
 assert.equal(st.flight,'hold');assert.ok(st.creditsT>beforeJump,'a repeated jump never restarts the roll');
 run(actBurning,st,FILM_T.descend+.1,()=>({moveX:-1}));run(actBurning,st,8,()=>({moveX:-1}),s=>s.phase==='wedding');
 assert.equal(st.phase,'wedding');const outsideClock=st.creditsT;
 run(actBurning,st,20,()=>({moveX:1}),s=>s.phase!=='wedding');assert.equal(st.phase,'finale');assert.ok(st.creditsT>outsideClock);
 run(actBurning,st,FINALE_END+1);assert.equal(st.status,'play');assert.equal(st.phase,'finale');
});

test('Act V: from the clifftop he walks to the edge and dives into the sea gap', () => {
  const st = actTower.create({ seed: 1, carry: {}, from: { scene: 0 } });
  st.phase = 'dive'; st.phaseT = 0;
  run(actTower, st, 12, (s) => ({ moveX: 1, a: s.w && s.w.x > DIVE.edge - 60 }), (s) => s.phase === 'swim');
  assert.equal(st.phase, 'swim');
});

test('Act VI: a checkpoint in the tower resumes in the tower', () => {
  const st = actBurning.create({ seed: 4, carry: {}, from: { scene: 1 } });
  assert.equal(st.phase, 'house'); assert.ok(st.p.carry, 'carrying her');
});

// From each surface, the take-off point of a full-speed leap that lands on
// the next surface ahead (through the real movement code), or null.
function takeoffs() {
  const S = surfaces().filter((p) => p.id !== 'L7').sort((a, b) => a.x0 - b.x0), out = {};
  for (const p of S) {
    if (p.x1 >= EXIT_X) break;
    out[p.id] = null;
    for (let x = p.x0 + 20; x <= p.x1 && !out[p.id]; x += 4) {
      const cv = createCavern({ x }); cv.drops = []; Object.assign(cv.s, { y: p.y, on: p.id, vx: 280 });
      let land = null;
      for (let t = 0, first = true; t < 2 && !land; t += DT, first = false) {
        stepCavern(cv, DT, { moveX: 1, a: first, aHeld: true }, { hit: () => { land = 'pool'; }, pearl: () => {}, events: [], graceLeft: () => 1 });
        if (!land && cv.s.on && cv.s.on !== p.id) land = cv.s.on;
      }
      const q = S.find((r) => r.id === land);
      if (q && q.x0 > p.x0) out[p.id] = x;
    }
  }
  return out;
}

test('Act IV cavern: every surface has a leap to the next one ahead', () => {
  for (const [id, x] of Object.entries(takeoffs())) assert.ok(x != null, `no way on from ${id}`);
});

test('Act IV cavern: a prince who keeps moving reaches the night sea untouched by stalactites', () => {
  const T = takeoffs(), st = act4.create({ carry: {}, from: { scene: 5 } });
  assert.equal(st.phase, 'cavern');
  let clock = 0, lost = [];
  run(act4, st, 60, (s) => {
    const c = s.cv?.s;
    if (s.lanterns + lost.length < 3) lost.push(`${c.x.toFixed(0)},${c.y.toFixed(0)}`);
    return { moveX: 1, aHeld: true, a: !!(c?.on && T[c.on] != null && c.x >= T[c.on]), beat: (clock += DT) / BEAT };
  }, (s) => s.phase !== 'cavern');
  assert.equal(st.lanterns, 3, `touched at ${lost} (take-offs ${JSON.stringify(T)})`);
  assert.ok(['iris'].includes(st.phase) || st.status === 'won', `${st.phase} at x ${st.cv.s.x.toFixed(0)} on ${st.cv.s.on} t ${st.t.toFixed(1)}`);
});

test('Act IV cavern: a pool costs a lantern and puts him back on firm rock', () => {
  const st = act4.create({ carry: {}, from: { scene: 5 } });
  Object.assign(st.cv.s, { x: 600, y: 700, on: null, vy: 300 });
  st.grace = 0;
  act4.step(st, DT, { beat: 0 });
  assert.equal(st.lanterns, 2);
  assert.ok(st.cv.s.y <= 600 && st.cv.s.x < 560, `respawned at ${st.cv.s.x}`);
});

test('Act IV (film): the whale hangs half as many hooks or fewer, two of them higher', () => {
  assert.ok(HOOKS.length <= 5, `${HOOKS.length} hooks`);
  assert.ok(HOOKS.filter((h) => h.tipY <= 150).length >= 2);
});

test('Act IV (film): the beach leads on into the cavern', () => {
  const st = act4.create({ carry: {}, from: { scene: 4 } });
  st.phase = 'shore'; st.phaseT = 99;
  act4.step(st, DT, { beat: 0 });
  assert.equal(st.phase, 'cavern');
  assert.equal(act4.scenes.length, 7);
});

const manifest = JSON.parse(await readFile(new URL('../assets/manifest.json', import.meta.url)));
const files = Object.values(manifest.slots).filter((s) => s.edition === 'film' && (s.interim || s.status === 'delivered')).map((s) => s.interim || s.file);
for (const f of files) await access(new URL('../assets/' + f, import.meta.url));
test('every interim cut-out and tableau the manifest names exists', () => { assert.ok(files.length >= 60, String(files.length)); });

console.log(`\n${n} tests passed`);

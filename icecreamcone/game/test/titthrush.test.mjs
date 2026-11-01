import test from 'node:test';
import assert from 'node:assert/strict';
import create, { BOX } from '../src/games/titthrush.js';
import entry from '../src/more/titthrush.js';
import { run, env, blank } from './harness.mjs';

const pass = entry.pass;
const TAU = Math.PI * 2;

// A hopper: it watches the hand come round and, a moment before the dotted
// line will cross a clock, presses, with its timing off by up to `noise`
// seconds either way (a person anticipates the sweep, but not exactly).
// `aim` is how near the middle it waits for (1 takes any line through the
// clock, 0.25 waits for a bullseye); `gold` goes for the gold watch first;
// `wait` is how long it takes to settle after landing; `skip` is the chance
// it lets a chance go by; `see` is how far it looks along the line (a
// beginner only trusts what the dotted line shows).
function hopper({ noise = 0.1, aim = 1, gold = false, wait = 0.3, skip = 0, see = true, seed = 1 } = {}) {
  let r = seed * 7919;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  let t = 0;
  let since = 0;
  let pressAt = null;
  let decided = null;
  let pressed = false;
  return (game) => {
    t += 1 / 60;
    if (game.state !== 'ride') {
      since = 0;
      pressAt = null;
      decided = null;
      pressed = false;
      return { kind: 'controller' };
    }
    since += 1 / 60;
    if (pressAt !== null && t >= pressAt) {
      pressAt = null;
      pressed = true;
      return { kind: 'controller', action: true };
    }
    if (pressed) {
      pressed = false;
      return { kind: 'controller' };
    }
    if (pressAt === null && since > wait) {
      const lead = 0.15; // it presses this far ahead of the moment it judges right
      const w = (TAU / game.period()) * game.on.dir;
      const hit = game.aim(game.on.a + w * lead);
      const goldOut = gold && game.clocks.some((c) => c.kind === 4 && c !== game.on && c.fade <= 0);
      const ok = hit && hit.off <= aim && (!see || hit.dist <= game.aimLen() + hit.clock.r) && (!goldOut || hit.clock.kind === 4);
      if (ok && decided !== hit.clock) {
        decided = hit.clock;
        if (rnd() < skip) return { kind: 'controller' };
        const u = (rnd() + rnd() + rnd() - 1.5) / 1.5; // roughly bell-shaped, -1..1
        pressAt = t + lead + u * noise;
      } else if (!hit) decided = null;
    }
    return { kind: 'controller' };
  };
}

const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
const beginnerBot = (seed) => hopper({ noise: 0.11, aim: 0.85, wait: 0.5, skip: 0.25, seed });
const clumsyBot = (seed) => hopper({ noise: 0.3, aim: 0.9, wait: 0.7, skip: 0.35, seed });
const goodBot = (seed) => hopper({ noise: 0.035, aim: 0.3, gold: true, wait: 0.25, see: false, seed });

// Mashing: pressing every few frames (it never gets a grip, so never lets go).
const eager = () => {
  let k = 0;
  return () => ({ kind: 'controller', action: k++ % 4 < 2 });
};
// Pressing steadily three times a second without looking: it hops whenever it
// can, wherever the hand points.
const steady = () => {
  let k = 0;
  return () => ({ kind: 'controller', action: k++ % 20 === 0 });
};
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

// The clumsy hopper's timing error is in seconds (0.3 s, three times the
// medium's), so it misses more as the hands speed up and the clocks shrink.
const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);
const BOTS = {
  idle: () => () => ({}),
  mash: () => eager(),
  blind: () => steady(),
  clumsy: clumsyBot,
  medium: beginnerBot, // the old beginner
  good: goodBot,
};
const TABLE = {};
for (const level of ['easier', 'normal', 'harder']) {
  TABLE[level] = {};
  for (const [name, b] of Object.entries(BOTS)) TABLE[level][name] = SEEDS.map((seed) => run(create, { seed, bot: b(seed), difficulty: level }).game.score);
}
const passRate = (a) => a.filter((s) => s >= pass).length / a.length;
console.log(`titthrush pass ${pass}`);
for (const [level, row] of Object.entries(TABLE)) console.log(level, Object.entries(row).map(([n, a]) => `${n} ${Math.round(mean(a))} [${Math.min(...a)}-${Math.max(...a)}] ${Math.round(passRate(a) * 100)}%`).join(' · '));

test('titthrush: at Normal a medium hopper passes, a good one far more; mashing, blind hopping and idling do not', () => {
  const t = TABLE.normal;
  assert.ok(passRate(t.medium) >= 0.75, `medium ${t.medium}`);
  assert.ok(mean(t.good) >= mean(t.medium) * 1.4, `good ${t.good} vs medium ${t.medium}`);
  assert.ok(passRate(t.clumsy) < passRate(t.medium) && mean(t.clumsy) < mean(t.medium) - 5, `clumsy ${t.clumsy}`);
  for (const n of ['idle', 'mash', 'blind']) assert.ok(Math.max(...t[n]) < pass, `${n} ${t[n]}`);
  assert.ok(Math.max(...t.mash) <= 2, `mashing never gets a grip: ${t.mash}`);
});

// A missed hop costs only time, and a faster hand offers more hops, so the
// score rises with the pace for anyone who keeps up: Easier helps a clumsy
// hopper less than it would in a game scored on accuracy.
test('titthrush: Easier lets a clumsy hopper pass more often than Normal; mashing, blind hopping and idling still fail', () => {
  const t = TABLE.easier;
  assert.ok(passRate(t.clumsy) >= 0.6, `clumsy ${t.clumsy}`);
  assert.ok(passRate(t.clumsy) > passRate(TABLE.normal.clumsy), `clumsy at Normal ${TABLE.normal.clumsy}`);
  for (const n of ['idle', 'mash', 'blind']) assert.ok(Math.max(...t[n]) < pass, `${n} ${t[n]}`);
});

test('titthrush: Harder ends hard: the good hopper scores clearly more than the medium one', () => {
  const t = TABLE.harder;
  assert.ok(mean(t.good) > mean(t.medium) * 1.4, `good ${mean(t.good)} vs medium ${mean(t.medium)}`);
  assert.ok(mean(t.clumsy) < mean(TABLE.normal.clumsy), `clumsy ${mean(t.clumsy)} vs Normal ${mean(TABLE.normal.clumsy)}`);
});

test('titthrush: the knobs at each level: Easier stays gentle, Harder opens near medium', () => {
  const at = (level, seconds) => {
    const game = create(env(1, { difficulty: level }));
    for (let i = 0; i < seconds * 60; i++) game.update(1 / 60, blank());
    return { period: game.period(), r: game.radius(), aim: game.aimLen() };
  };
  for (const level of ['easier', 'normal', 'harder']) {
    const row = [0, 15, 30, 44.9].map((s) => at(level, s));
    console.log('titthrush ramp', level, row.map((k) => `${k.period.toFixed(2)} s r ${k.r.toFixed(0)} line ${k.aim.toFixed(0)}`).join(' | '));
    for (let i = 1; i < row.length; i++) assert.ok(row[i].period <= row[i - 1].period && row[i].aim <= row[i - 1].aim, `${level} gets harder`);
  }
  assert.ok(at('easier', 44.9).period > 3.1, 'Easier never sweeps fast');
  assert.ok(at('harder', 0).period < 3.1 && at('harder', 44.9).period < 2.05, 'Harder opens near medium and ends hard');
});

test('titthrush: letting go flies along the hand; lined up, it lands on that clock and scores', () => {
  const game = create(env(3));
  game.update(1 / 60, blank());
  const target = game.clocks.find((c) => c !== game.on);
  const start = game.on;
  // turn the hand to point straight at the target's middle
  start.a = Math.atan2(target.x - start.x, -(target.y - start.y));
  start.dir = 0; // hold the hand still for the test
  for (let i = 0; i < 45; i++) game.update(1 / 60, blank());
  game.update(1 / 60, blank({ action: true, actionPressed: true }));
  assert.equal(game.state, 'fly');
  for (let i = 0; i < 90 && game.state === 'fly'; i++) game.update(1 / 60, blank());
  assert.equal(game.on, target, 'it grabbed the clock it was lined up with');
  assert.equal(game.score, 2, 'through the middle: a bullseye, two points');
  assert.equal(game.bulls, 1);
  // the clock it left fades away, and another swings in to keep two to hop to
  for (let i = 0; i < 60; i++) game.update(1 / 60, blank());
  assert.ok(!game.clocks.includes(start), 'the old clock has gone');
  assert.equal(game.clocks.filter((c) => c !== game.on && c.kind !== 4).length, 2);
});

test('titthrush: a hop that misses tumbles, costs no points, and flutters back to the clock it left', () => {
  const game = create(env(2));
  game.update(1 / 60, blank());
  const start = game.on;
  start.dir = 0;
  start.a = Math.PI; // straight down, at the cobbles
  for (let i = 0; i < 45; i++) game.update(1 / 60, blank());
  game.score = 5;
  game.streak = 3;
  game.update(1 / 60, blank({ action: true, actionPressed: true }));
  for (let i = 0; i < 60 && game.state === 'fly'; i++) game.update(1 / 60, blank());
  assert.equal(game.state, 'fall');
  assert.equal(game.misses, 1);
  assert.equal(game.score, 5, 'a miss costs only time');
  assert.equal(game.streak, 0);
  for (let i = 0; i < 200 && game.state !== 'ride'; i++) game.update(1 / 60, blank());
  assert.equal(game.state, 'ride');
  assert.equal(game.on, start);
  // pressing while it is still getting a grip does nothing
  game.update(1 / 60, blank({ action: true, actionPressed: true }));
  assert.equal(game.state, 'ride');
});

test('titthrush: the gold watch is worth three and leaves if not reached; every fifth hop in a row adds one', () => {
  const game = create(env(4));
  for (let i = 0; i < 60 * 25 && !game.clocks.some((c) => c.kind === 4); i++) game.update(1 / 60, blank());
  const gold = game.clocks.find((c) => c.kind === 4);
  assert.ok(gold, 'the gold watch shows up');
  for (let i = 0; i < 60 * 7; i++) game.update(1 / 60, blank());
  assert.ok(!game.clocks.includes(gold), 'it leaves when its time is up');

  const g2 = create(env(5));
  g2.update(1 / 60, blank());
  g2.streak = 4;
  const target = g2.clocks.find((c) => c !== g2.on);
  target.kind = 4;
  target.life = 99;
  g2.on.dir = 0;
  // aim a little off the middle: not a bullseye
  const d = Math.hypot(target.x - g2.on.x, target.y - g2.on.y);
  g2.on.a = Math.atan2(target.x - g2.on.x, -(target.y - g2.on.y)) + Math.asin((target.r * 0.7) / d);
  for (let i = 0; i < 45; i++) g2.update(1 / 60, blank());
  g2.update(1 / 60, blank({ action: true, actionPressed: true }));
  for (let i = 0; i < 90 && g2.state === 'fly'; i++) g2.update(1 / 60, blank());
  assert.equal(g2.on, target);
  assert.equal(g2.score, 4, 'three for the gold watch and one for five in a row');
  assert.equal(g2.golds, 1);
});

test('titthrush: it gets harder, and the clocks stay where a narrow screen can see them', () => {
  const game = create(env(6));
  const early = { period: game.period(), r: game.radius(), aim: game.aimLen() };
  const bot = hopper({ noise: 0.03, aim: 0.5, seed: 6 });
  let backwards = false;
  const third = { period: 0, r: 0, aim: 0 };
  const move = { early: 0, late: 0 };
  for (let i = 0; i < 60 * 44; i++) {
    const o = bot(game);
    game.update(1 / 60, blank({ ...o, actionPressed: !!o.action }));
    if (i === 60 * 15) Object.assign(third, { period: game.period(), r: game.radius(), aim: game.aimLen() });
    const part = game.elapsed < 15 ? 'early' : game.elapsed > 30 ? 'late' : null;
    for (const c of game.clocks) if (part) move[part] = Math.max(move[part], c.sway + Math.abs(c.vx));
    for (const c of game.clocks) {
      assert.ok(c.bx >= BOX.x0 - 1 && c.bx <= BOX.x1 + 1 && c.by >= BOX.y0 - 1 && c.by <= BOX.y1 + 1, 'clock in the box');
      if (c.dir < 0) backwards = true;
    }
  }
  assert.ok(game.period() < early.period * 0.75, 'the hands sweep faster');
  assert.ok(game.radius() < early.r * 0.8, 'the clocks get smaller');
  assert.ok(game.aimLen() < early.aim * 0.6, 'the dotted line gets shorter');
  assert.ok(backwards, 'the cuckoo clock (backwards) joins in');
  // the first third stays gentle: a third of the way in, each knob has moved
  // well under a third of the way to its end
  const moved = (k) => (early[k] - third[k]) / (early[k] - game[{ period: 'period', r: 'radius', aim: 'aimLen' }[k]]());
  for (const k of ['period', 'r', 'aim']) assert.ok(moved(k) < 0.3, `${k} has moved ${moved(k).toFixed(2)} of the way by 15 s`);
  assert.equal(move.early, 0, 'no swaying or drifting clocks in the first third');
  assert.ok(move.late > 40, `clocks sway and drift late: ${move.late}`);
  assert.equal(game.span, 1060);
  assert.ok(BOX.x1 - BOX.x0 + 2 * 100 * 1.2 <= game.span + 100);
});

// The Trush is one size whatever it does: perched on a hand, singing as it
// lands, flying and flustered on the cobbles, measured against how big each
// picture is painted (design/source/pose-scales.json). It used to shrink by
// an eighth every time it landed and sang.
test('titthrush: every painted pose shows the Trush the same size', async () => {
  const { withArt, shownSizes, sizeCheck } = await import('./sprite-rig.mjs');
  await import('../src/subjects.js');
  const undo = withArt();
  try {
    const game = create(env(1));
    game.update(1 / 60, blank());
    const at = (o) => (gm) => Object.assign(gm, { state: 'ride', sing: 0, shake: 0, vx: 600, vy: -200, bx: 800, by: 400 }, o);
    const sizes = shownSizes(game, 'titthrush', {
      perched: at({}),
      singing: at({ sing: 0.3 }),
      flying: at({ state: 'fly' }),
      flustered: at({ state: 'fall' }),
    }, ['sprites.titthrushHop', 'sprites.titthrushSing', 'sprites.titthrushFluster']);
    const { fails, table } = sizeCheck(sizes, 'perched');
    console.log('titthrush pose sizes', table);
    assert.equal(Object.keys(table).length, 4, 'each pose drew one picture');
    assert.deepEqual(fails, []);
  } finally {
    undo();
  }
});

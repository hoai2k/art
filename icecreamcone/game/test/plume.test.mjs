import test from 'node:test';
import assert from 'node:assert/strict';
import create from '../src/games/plume.js';
import { BIRDS } from '../src/birds.js';
import { run, env, blank } from './harness.mjs';

const pass = BIRDS.find((b) => b.id === 'plume').pass;
const steer = (game, p) => {
  const d = p.x - game.x;
  return { x: Math.max(-1, Math.min(1, d / 40)), action: Math.abs(d) < 30 };
};
const ok = (p) => p.soggy <= 0 && p.bloomT <= 0 && p.soak < 0.85;

// A gardener: waters the tallest Plume until it blooms or starts to sweat,
// then moves on to the next tallest. `skill` slows its hand and sometimes
// sends it to a Plume at random.
function gardener(skill = 1, seed = 1) {
  let r = seed * 7919;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  let target = null;
  return (game) => {
    if (!target || !ok(target)) {
      const cands = game.plants.filter(ok).sort((a, b) => b.growth - a.growth);
      target = (rnd() < skill ? cands[0] : cands[Math.floor(rnd() * cands.length)]) || null;
    }
    if (!target) return {};
    const o = steer(game, target);
    return { ...o, x: o.x * (0.4 + 0.6 * skill) };
  };
}

// Holding the water on and sweeping back and forth along the bench.
const sweeper = () => {
  let d = 1;
  return (game) => {
    if (game.x > 1450) d = -1;
    if (game.x < 150) d = 1;
    return { x: d, action: true };
  };
};

// A clumsy gardener: slow hand, picks a Plume half at random, and is late to
// notice when to move on (`lag` seconds after a Plume blooms, sweats or goes
// soggy), so faster soaking and drying cost it more.
function clumsy(lag, seed) {
  let r = seed * 7919;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  let target = null;
  let bad = 0;
  return (game) => {
    bad = target && !ok(target) ? bad + 1 / 60 : 0;
    if (!target || bad > lag) {
      bad = 0;
      const cands = game.plants.filter(ok).sort((a, b) => b.growth - a.growth);
      target = (rnd() < 0.3 ? cands[0] : cands[Math.floor(rnd() * cands.length)]) || null;
    }
    if (!target) return {};
    const o = steer(game, target);
    return { ...o, x: o.x * 0.58 };
  };
}

const masher = (seed) => {
  let r = seed * 31;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  let d = 0;
  return () => {
    if (rnd() < 0.03) d = rnd() * 2 - 1;
    return { x: d, action: rnd() < 0.5 };
  };
};

const SEEDS = Array.from({ length: 16 }, (_, i) => i + 1);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const BOTS = {
  idle: () => () => ({}),
  mash: (seed) => masher(seed),
  sweep: () => sweeper(),
  hold: () => () => ({ action: true }),
  clumsy: (seed) => clumsy(2.5, seed),
  medium: (seed) => gardener(0.15, seed),
  good: (seed) => gardener(1, seed),
};
const TABLE = {};
for (const level of ['easier', 'normal', 'harder']) {
  TABLE[level] = {};
  for (const [name, bot] of Object.entries(BOTS)) TABLE[level][name] = SEEDS.map((seed) => run(create, { seed, bot: bot(seed), difficulty: level }).game.score);
}
const passRate = (a) => a.filter((s) => s >= pass).length / a.length;
console.log(`plume pass ${pass}`);
for (const [level, row] of Object.entries(TABLE)) console.log(level, Object.entries(row).map(([n, a]) => `${n} ${mean(a).toFixed(1)} [${Math.min(...a)}-${Math.max(...a)}] ${Math.round(passRate(a) * 100)}%`).join(' · '));

// Holding the water on the middle Plume without moving is not asserted: it
// blooms it again and again through the soggy pauses (about 8 a round), more
// than the pass mark. See design.md.
test('plume: at Normal a medium gardener passes, a good one more; idle, mashing and sweeping do not', () => {
  const t = TABLE.normal;
  assert.ok(passRate(t.medium) >= 0.75, `medium ${t.medium}`);
  assert.ok(Math.min(...t.good) > Math.max(...t.medium) - 1, `good ${t.good}`);
  assert.equal(Math.max(...t.idle), 0);
  for (const n of ['idle', 'mash', 'sweep']) assert.ok(Math.max(...t[n]) < pass, `${n} ${t[n]}`);
  assert.ok(Math.max(...t.sweep) < Math.min(...t.good), `sweep ${t.sweep}`);
});

test('plume: Easier lets a clumsy gardener pass; idle, mashing and sweeping still fail', () => {
  const t = TABLE.easier;
  assert.ok(passRate(t.clumsy) >= 0.75 && mean(t.clumsy) > mean(TABLE.normal.clumsy), `clumsy ${t.clumsy}`);
  for (const n of ['idle', 'mash', 'sweep']) assert.ok(Math.max(...t[n]) < pass, `${n} ${t[n]}`);
});

test('plume: Harder ends hard: the good gardener scores clearly more; a clumsy one does worse', () => {
  const t = TABLE.harder;
  assert.ok(mean(t.good) > mean(t.medium) + 2, `good ${mean(t.good)} vs medium ${mean(t.medium)}`);
  assert.ok(mean(t.clumsy) < mean(TABLE.normal.clumsy), `clumsy ${mean(t.clumsy)}`);
  assert.ok(passRate(t.clumsy) < passRate(TABLE.normal.clumsy), `clumsy ${t.clumsy}`);
});

// The knobs by thirds of the round at Normal.
test('plume: the knobs harden third by third at Normal', () => {
  const game = create(env(1));
  const look = () => ({ d: game.d(), dry: game.dryRate(), soak: game.soakRate() });
  const step = (s) => { for (let i = 0; i < s * 60; i++) game.update(1 / 60, blank()); };
  const start = look();
  step(15);
  const third = look();
  step(15);
  const two = look();
  step(14.9);
  const end = look();
  console.log('plume ramp', { start, third, two, end });
  for (const [a, b] of [[start, third], [third, two], [two, end]]) assert.ok(a.dry < b.dry && a.soak < b.soak);
  assert.ok(third.d < 0.3, 'the first third stays gentle');
});

test('plume: the pots dry slowly at first and fast at the end', () => {
  const game = create(env(1));
  const dryness = () => game.plants.reduce((s, p) => s + p.dry, 0);
  let d0 = dryness();
  for (let i = 0; i < 120; i++) game.update(1 / 60, blank());
  const early = dryness() - d0;
  while (game.elapsed < 42) game.update(1 / 60, blank());
  for (const p of game.plants) p.dry = 0;
  d0 = dryness();
  for (let i = 0; i < 120; i++) game.update(1 / 60, blank());
  const late = dryness() - d0;
  assert.ok(late > early * 3, `two seconds' drying: ${early} early vs ${late} late`);
  assert.ok(game.dryRate() > 3 * 0.06);
});

test('plume: watering one Plume too long makes it soggy', () => {
  const game = create(env(1));
  const p = game.plants[2]; // the rose starts above the middle one
  for (let i = 0; i < 60 * 8 && !game.soggies; i++) {
    p.growth = 0.3; // keep it from blooming, to test the soak alone
    game.update(1 / 60, blank({ action: true }));
  }
  assert.equal(game.soggies, 1);
  assert.ok(p.soggy > 0);
});

test('plume: a dry Plume wilts and loses its growth', () => {
  const game = create(env(1));
  const p = game.plants[0];
  p.growth = 0.7;
  p.dry = 1;
  for (let i = 0; i < 120; i++) game.update(1 / 60, blank());
  assert.ok(p.growth < 0.7, `growth ${p.growth}`);
  assert.ok(p.wilt > 0.5);
});

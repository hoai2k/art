import test from 'node:test';
import assert from 'node:assert/strict';
import create from '../src/games/gullfinch.js';
import { BIRDS } from '../src/birds.js';
import { run, env, blank } from './harness.mjs';

const pass = BIRDS.find((b) => b.id === 'gullfinch').pass;

// A player with human timing: aims at each note with a normally distributed
// error of `sd` seconds, now and then misses one outright (`lapse`), and
// winds the stick (two turns a second) when the spring is below `windBelow`
// and no note is due for a moment.
function player({ sd = 0.05, lapse = 0.04, windBelow = 0.5, seed = 7 } = {}) {
  let r = seed;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
  let aimFor = null;
  let aim = 0;
  return (game) => {
    const next = game.notes.find((n) => n.state === 'wait');
    let action = false;
    let spin = 0;
    if (next) {
      if (aimFor !== next) {
        aimFor = next;
        aim = rnd() < lapse ? -9 : gauss() * sd;
      }
      if (game.until(next) <= aim) action = true;
    }
    const gap = !next || game.until(next) > 0.6;
    if (gap && game.spring < windBelow) spin = 0.2;
    return { action, spin };
  };
}

const masher = (seed) => {
  let r = seed * 31;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  return () => ({ action: rnd() < 0.5, spin: rnd() < 0.3 ? 0.5 : 0 });
};
const SEEDS = Array.from({ length: 16 }, (_, i) => i + 1);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
// Timing errors are in seconds, so a quicker song with tighter windows costs
// the looser players more.
const BOTS = {
  idle: () => () => ({}),
  mash: (seed) => masher(seed),
  clumsy: (seed) => player({ sd: 0.14, lapse: 0.12, seed: seed * 17 }),
  medium: (seed) => player({ sd: 0.1, lapse: 0.1, seed: seed * 17 }),
  good: (seed) => player({ sd: 0.03, lapse: 0.01, seed: seed * 5 }),
};
const TABLE = {};
for (const level of ['easier', 'normal', 'harder']) {
  TABLE[level] = {};
  for (const [name, bot] of Object.entries(BOTS)) TABLE[level][name] = SEEDS.map((seed) => run(create, { seed, bot: bot(seed), difficulty: level }).game.score);
}
const passRate = (a) => a.filter((s) => s >= pass).length / a.length;
console.log(`gullfinch pass ${pass}`);
for (const [level, row] of Object.entries(TABLE)) console.log(level, Object.entries(row).map(([n, a]) => `${n} ${Math.round(mean(a))} [${Math.min(...a)}-${Math.max(...a)}] ${Math.round(passRate(a) * 100)}%`).join(' · '));

test('gullfinch: at Normal a medium player passes; a clumsy one seldom; idle and mashing do not', () => {
  const t = TABLE.normal;
  assert.ok(passRate(t.medium) >= 0.75, `medium ${t.medium}`);
  assert.ok(passRate(t.clumsy) <= 0.4, `clumsy ${t.clumsy}`);
  assert.equal(Math.max(...t.idle), 0);
  for (const n of ['idle', 'mash']) assert.ok(Math.max(...t[n]) < pass, `${n} ${t[n]}`);
});

test('gullfinch: winding pays', () => {
  const steady = [1, 2, 3].map((seed) => run(create, { seed, bot: player({ seed: seed * 13 }) }).game.score);
  const lazy = run(create, { seed: 1, bot: player({ windBelow: 0 }) }).game.score;
  assert.ok(lazy < mean(steady) * 0.85, `winding pays: ${lazy} vs ${mean(steady)}`);
});

test('gullfinch: Easier lets a clumsy player pass more often; idle and mashing still fail', () => {
  const t = TABLE.easier;
  assert.ok(passRate(t.clumsy) >= 0.6 && passRate(t.clumsy) > passRate(TABLE.normal.clumsy), `clumsy ${t.clumsy}`);
  for (const n of ['idle', 'mash']) assert.ok(Math.max(...t[n]) < pass, `${n} ${t[n]}`);
});

test('gullfinch: Harder ends hard: the good player scores clearly more; a clumsy one does worse', () => {
  const t = TABLE.harder;
  assert.ok(mean(t.good) > mean(t.medium) * 1.6, `good ${mean(t.good)} vs medium ${mean(t.medium)}`);
  assert.ok(mean(t.clumsy) < mean(TABLE.normal.clumsy), `clumsy ${mean(t.clumsy)}`);
  for (const n of ['idle', 'mash']) assert.ok(Math.max(...t[n]) < pass, `${n} ${t[n]}`);
});

// The knobs by thirds of the song at Normal.
test('gullfinch: the knobs harden third by third at Normal', () => {
  const game = create(env(1));
  const look = () => ({ d: game.d(), bpm: game.bpm(), win: game.windows(), drain: game.drain() });
  const total = Math.max(...game.notes.map((n) => n.b)) + 2;
  const seen = [look()];
  for (const p of [1 / 3, 2 / 3, 0.99]) {
    while (game.beat < p * total && !game.done) game.update(1 / 60, blank({ spin: 0.7 }));
    seen.push(look());
  }
  console.log('gullfinch ramp', seen);
  for (let i = 1; i < seen.length; i++) assert.ok(seen[i].bpm > seen[i - 1].bpm && seen[i].win < seen[i - 1].win && seen[i].drain > seen[i - 1].drain);
  assert.ok(seen[1].d < 0.3, 'the first third stays gentle');
});

test('gullfinch: the song starts slow and forgiving and ends quick and tight', () => {
  const game = create(env(1));
  const start = { bpm: game.bpm(), win: game.windows(), spring: game.spring };
  for (let i = 0; i < 60; i++) game.update(1 / 60, blank());
  const drainStart = start.spring - game.spring;
  while (game.d() < 0.75 && !game.done) game.update(1 / 60, blank({ spin: 0.7 }));
  const end = { bpm: game.bpm(), win: game.windows() };
  game.spring = 1;
  for (let i = 0; i < 60; i++) game.update(1 / 60, blank());
  const drainEnd = 1 - game.spring;
  assert.ok(end.bpm > start.bpm * 1.3, `tempo ${start.bpm} to ${end.bpm}`);
  assert.ok(end.win < start.win * 0.8, `timing windows ${start.win} to ${end.win}`);
  assert.ok(drainEnd > drainStart * 1.8, `spring drain ${drainStart} to ${drainEnd}`);
});

test('gullfinch: mashing the action plays nothing well', () => {
  let k = 0;
  const { game } = run(create, { seed: 2, bot: () => ({ action: k++ % 4 < 2 }) });
  assert.ok(game.score < pass, `mash ${game.score}`);
});

test('gullfinch: a tap far from any note winds the spring', () => {
  const game = create(env(1));
  game.spring = 0.5;
  game.update(1 / 60, blank({ action: true, actionPressed: true }));
  assert.ok(game.spring > 0.5);
  assert.equal(game.counts.miss, 0);
});

test('gullfinch: the song ends, and runs slower with the spring run down', () => {
  const full = run(create, { seed: 1, bot: () => ({ spin: 0.3 }) }).t;
  const idle = run(create, { seed: 1 }).t;
  assert.ok(full > 35 && full < 60, `song length ${full}`);
  assert.ok(idle > full, `${idle} > ${full}`);
});

// The Gramophone Gullfinch is one size in every painted pose (standing, singing), and stands on the
// same line: measured against how big each picture is painted
// (design/source/pose-scales.json).
test('gullfinch: every painted pose shows the Gramophone Gullfinch the same size, on the same feet', async () => {
  const { withArt, birdSizes, sizeCheck } = await import('./sprite-rig.mjs');
  const undo = withArt();
  try {
    const feet = { 'bird.gullfinch#0': 0.987, 'sprites.gullfinchSing#0': 0.986 };
    const sizes = await birdSizes('gullfinch', { standing: {}, singing: { sing: 1 } }, feet);
    const { fails, table } = sizeCheck(sizes, 'standing');
    console.log('gullfinch pose sizes', table);
    assert.deepEqual(fails, []);
    const y0 = sizes.standing[0].feetY;
    for (const [name, [d]] of Object.entries(sizes)) assert.ok(Math.abs(d.feetY - y0) < 4, `${name}: feet at ${d.feetY.toFixed(1)}, standing at ${y0.toFixed(1)}`);
  } finally {
    undo();
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import create from '../src/games/milkmidge.js';
import entry from '../src/more/milkmidge.js';
import { run, env, blank } from './harness.mjs';

const pass = entry.pass;

// A milkman: picks the next house that wants milk, starts winding up just in
// time to let go in front of it, and lets go at the charge for its step.
// `aim` (pixels) and `lag` (fraction of the step's width) are how far off
// its hand is; `careless` is the chance it throws at a "No milk" house too.
// `pace`: its hand gets looser as the float speeds up (a clumsy
// player), more than in step with it.
function milkman({ aim = 0, lag = 0, careless = 0, pace = false, seed = 1 } = {}) {
  let r = seed * 7919;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  let target = null;
  let goal = 0;
  let dx = 0;
  const skipped = new Set();
  return (game) => {
    if (!game.holding) {
      const h = game.houses
        .filter((h) => h.got < h.wants || h.note)
        .filter((h) => !skipped.has(h))
        .find((h) => h.x - game.fx > -h.half * 0.3);
      if (!h) return {};
      if (h.note && !h.decided) {
        h.decided = true;
        if (rnd() >= careless) skipped.add(h);
        return {};
      }
      if (h.note && skipped.has(h)) return {};
      const k = pace ? (game.floatSpeed() / 140) ** 2 : 1;
      target = h;
      goal = game.chargeFor(h.stepY + (rnd() * 2 - 1) * aim * k);
      dx = (rnd() * 2 - 1) * lag * k * h.half;
      const hold = goal * game.windTime();
      if (h.x + dx - game.fx <= game.speed * hold) return { action: true };
      return {};
    }
    // holding: let go at the charge for the step
    if (game.charge >= goal || game.dir < 0) {
      skipped.add(target);
      return { action: false };
    }
    return { action: true };
  };
}

// Tapping as fast as it can, and holding for random lengths.
const masher = (game, t) => ({ action: Math.floor(t * 60) % 4 < 2 });
function flinger(seed = 1) {
  let r = seed * 48271;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  let until = 0;
  let holding = false;
  return (game, t) => {
    if (t >= until) {
      holding = !holding;
      until = t + (holding ? 0.1 + rnd() * 1.2 : 0.05 + rnd() * 0.3);
    }
    return { action: holding };
  };
}

const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const BOTS = {
  idle: () => () => ({}),
  mash: () => masher,
  fling: (seed) => flinger(seed),
  clumsy: (seed) => milkman({ aim: 26, lag: 0.8, careless: 0.3, pace: true, seed }),
  medium: (seed) => milkman({ aim: 26, lag: 1.1, careless: 0.25, seed }),
  good: (seed) => milkman({ aim: 6, lag: 0.3, seed }),
};
const TABLE = {};
for (const level of ['easier', 'normal', 'harder']) {
  TABLE[level] = {};
  for (const [name, bot] of Object.entries(BOTS)) TABLE[level][name] = SEEDS.map((seed) => run(create, { seed, bot: bot(seed), difficulty: level }).game.score);
}
const passRate = (a) => a.filter((s) => s >= pass).length / a.length;
console.log(`milkmidge pass ${pass}`);
for (const [level, row] of Object.entries(TABLE)) console.log(level, Object.entries(row).map(([n, a]) => `${n} ${Math.round(mean(a))} [${Math.min(...a)}-${Math.max(...a)}] ${Math.round(passRate(a) * 100)}%`).join(' · '));

test('milkmidge: at Normal a medium milkman passes, a good one more; idling, mashing and flinging do not', () => {
  const t = TABLE.normal;
  assert.ok(passRate(t.medium) >= 0.75, `medium ${t.medium}`);
  assert.ok(mean(t.good) > mean(t.medium), `good ${t.good}`);
  assert.ok(passRate(t.clumsy) < 0.5, `clumsy ${t.clumsy}`);
  for (const n of ['idle', 'mash', 'fling']) assert.ok(Math.max(...t[n]) < pass, `${n} ${t[n]}`);
  const idle = run(create, { seed: 1 }).game;
  assert.equal(idle.score, 0);
  assert.ok(idle.done);
});

// Every pint scores, so a slower float also means fewer houses for everyone:
// Easier helps a clumsy milkman less than it would in a game scored on
// accuracy. It still lets him pass far more often than Normal.
test('milkmidge: Easier lets a clumsy milkman pass more often than Normal; idling, mashing and flinging still do not', () => {
  const t = TABLE.easier;
  assert.ok(passRate(t.clumsy) >= 0.6, `clumsy ${t.clumsy}`);
  assert.ok(passRate(t.medium) >= 0.75, `medium ${t.medium}`);
  assert.ok(passRate(t.clumsy) > passRate(TABLE.normal.clumsy), `clumsy at Normal ${TABLE.normal.clumsy}`);
  for (const n of ['idle', 'mash', 'fling']) assert.ok(Math.max(...t[n]) < pass, `${n} ${t[n]}`);
});

test('milkmidge: Harder ends hard: the good milkman scores clearly more than the medium one', () => {
  const t = TABLE.harder;
  assert.ok(mean(t.good) > mean(t.medium) * 1.3, `good ${mean(t.good)} vs medium ${mean(t.medium)}`);
  assert.ok(mean(t.clumsy) < mean(TABLE.normal.clumsy), `clumsy ${mean(t.clumsy)} vs Normal ${mean(TABLE.normal.clumsy)}`);
});

// The round starts gentle and ends harder, read from the game's own knobs as
// it plays, third by third: steps nearer and wider, fewer dogs and cards,
// houses further apart and a slower float at the start; the first third
// stays on the gentle side.
test('milkmidge: the street starts gentle and ends harder', () => {
  const game = create(env(5));
  const look = () => ({ speed: game.floatSpeed(), gap: game.houseGap(), depth: (game.stepLo() + game.stepHi()) / 2, half: game.stepHalf(), hazards: game.dogChance() + game.cardChance() });
  const step = (s) => { for (let i = 0; i < s * 60; i++) game.update(1 / 60, blank()); };
  const start = look();
  step(15);
  const third = look();
  step(15);
  const two = look();
  step(14.9);
  const end = look();
  console.log('milkmidge ramp', { start, third, two, end });
  for (const [x, y] of [[start, third], [third, two], [two, end]]) {
    assert.ok(x.speed < y.speed && x.gap > y.gap, 'the float speeds up and the houses close in');
    assert.ok(x.depth > y.depth && x.half > y.half, 'steps go back and narrow');
    assert.ok(x.hazards < y.hazards, 'more dogs and cards');
  }
  assert.ok(start.depth > end.depth + 25, 'early steps are nearer the pavement');
  assert.ok(start.half > end.half * 1.2, 'early steps are wider');
  assert.ok(end.speed > start.speed * 1.4, 'the float speeds up');
  assert.ok(third.speed - start.speed < (end.speed - start.speed) / 3, 'the first third stays on the gentle side');
});

// Holds for exactly the charge that lands on a step, in front of it.
function throwAt(game, h, dy = 0) {
  const goal = game.chargeFor(h.stepY + dy);
  const hold = goal * game.windTime();
  // fast-forward the street so it lets go right in front of the step
  game.fx = h.x - game.speed * hold;
  game.update(1 / 60, blank({ action: true, actionPressed: true }));
  while (game.charge < goal && game.dir > 0) game.update(1 / 60, blank({ action: true }));
  game.update(1 / 60, blank());
  for (let i = 0; i < 90; i++) game.update(1 / 60, blank());
}

test('milkmidge: a pint on the mat scores two; one on a "No milk" step comes back', () => {
  const game = create(env(3));
  const h = game.houses.find((h) => !h.note);
  throwAt(game, h);
  assert.equal(h.got, 1);
  assert.equal(game.perfects, 1);
  assert.equal(game.score, 2);
  const n = game.houses[game.houses.length - 1];
  n.note = true;
  n.wants = 0;
  n.dog = null;
  throwAt(game, n);
  assert.equal(game.refused, 1);
  assert.equal(game.score, 1);
});

test('milkmidge: a pint at the edge of the step scores one', () => {
  const game = create(env(3));
  const h = game.houses.find((h) => !h.note);
  throwAt(game, h, game.tol() * 0.75); // lands near the step's front edge
  assert.equal(h.got, 1);
  assert.equal(game.perfects, 0);
  assert.equal(game.score, 1);
});

test('milkmidge: a smash near a sleeping dog wakes it and costs one', () => {
  const game = create(env(4));
  const h = game.houses[2];
  h.dog = { side: 1, x: h.x + 120, y: (h.stepY + 615) / 2, awake: 0, woke: false };
  game.score = 5;
  // a quick tap: the bottle falls short, in the garden by the dog
  game.fx = h.x;
  game.update(1 / 60, blank({ action: true, actionPressed: true }));
  for (let i = 0; i < 8; i++) game.update(1 / 60, blank({ action: true }));
  for (let i = 0; i < 90; i++) game.update(1 / 60, blank());
  assert.equal(game.smashes, 1);
  assert.equal(game.woken, 1);
  assert.equal(game.score, 4);
});

test('milkmidge: a plain smash costs no points, only a moment to fetch another bottle', () => {
  const game = create(env(6));
  for (const h of game.houses) h.dog = null;
  game.score = 3;
  game.update(1 / 60, blank({ action: true, actionPressed: true }));
  game.update(1 / 60, blank());
  for (let i = 0; i < 40; i++) game.update(1 / 60, blank());
  assert.equal(game.smashes, 1);
  assert.equal(game.score, 3);
  assert.ok(game.reload > 0);
  game.update(1 / 60, blank({ action: true, actionPressed: true }));
  assert.equal(game.holding, false);
});

test('milkmidge: holding past the farthest step swings the wind-up back down', () => {
  const game = create(env(1));
  game.update(1 / 60, blank({ action: true, actionPressed: true }));
  let top = 0;
  for (let i = 0; i < 60 * 1.9; i++) {
    game.update(1 / 60, blank({ action: true }));
    top = Math.max(top, game.charge);
  }
  assert.equal(top, 1);
  assert.ok(game.charge < 0.8 && game.dir < 0, `charge ${game.charge}`);
});

// The Midge is one size whatever it does: standing (its portrait), winding
// up, flinging, pleased and startled, measured against how big each picture
// is painted (design/source/pose-scales.json).
test('milkmidge: every painted pose shows the Midge the same size', async () => {
  const { withArt, shownSizes, sizeCheck } = await import('./sprite-rig.mjs');
  await import('../src/subjects.js');
  const undo = withArt();
  try {
    const game = create(env(1));
    const at = (o) => (gm) => Object.assign(gm, { holding: false, fling: 0, mood: null, charge: 0 }, o);
    const sizes = shownSizes(game, 'milkmidge', {
      standing: at({}),
      winding: at({ holding: true }),
      flinging: at({ fling: 0.2 }),
      pleased: at({ mood: { kind: 'pleased', t: Math.PI / 12 } }),
      startled: at({ mood: { kind: 'startled', t: 0 } }),
    }, ['subject.milkmidge', 'sprites.midgeThrow', 'sprites.midgeMoods']);
    const { fails, table } = sizeCheck(sizes, 'standing');
    console.log('milkmidge pose sizes', table);
    assert.equal(Object.keys(table).length, 5, 'each pose drew one picture');
    assert.deepEqual(fails, []);
  } finally {
    undo();
  }
});

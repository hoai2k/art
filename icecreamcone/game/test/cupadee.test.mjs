import test from 'node:test';
import assert from 'node:assert/strict';
import create from '../src/games/cupadee.js';
import { BIRDS } from '../src/birds.js';
import { run, env, blank } from './harness.mjs';

const pass = BIRDS.find((b) => b.id === 'cupadee').pass;

// A pourer that watches the cup and the tea still falling, and lets go when
// the whole lot will reach the line. `err` is how far off its judgement is,
// a different miss for each cup, like a person's: in time, not in cup-fulls,
// so it grows on smaller cups (which fill faster) and on cups that move.
function pourer(err = 0, seed = 1) {
  let r = seed * 7919;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  const miss = new Map();
  return (game) => {
    const b = game.birds.find((b) => b.state === 'serve');
    if (!b) return { action: false };
    if (b.motion === 'stroll' && Math.abs(b.x - game.streamX) > (b.size / 400) * 84 - 18) return { action: false };
    if (!miss.has(b)) miss.set(b, ((rnd() * 2 - 1) * err * (b.motion === 'still' ? 1 : 1.3)) / b.cap);
    const falling = game.parcels.reduce((s, p) => s + p.vol, 0) / b.cap;
    return { action: b.fill + falling + 0.03 / b.cap < b.line + miss.get(b) };
  };
}

// Mashing: tapping the action at random.
function masher(seed) {
  let r = seed * 31;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  return () => ({ action: rnd() < 0.5 });
}

const SEEDS = Array.from({ length: 16 }, (_, i) => i + 1);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const BOTS = {
  idle: () => () => ({}),
  mash: (seed) => masher(seed),
  hold: () => () => ({ action: true }),
  clumsy: (seed) => pourer(0.22, seed),
  medium: (seed) => pourer(0.14, seed),
  good: (seed) => pourer(0.04, seed),
};
const TABLE = {};
for (const level of ['easier', 'normal', 'harder']) {
  TABLE[level] = {};
  for (const [name, bot] of Object.entries(BOTS)) TABLE[level][name] = SEEDS.map((seed) => run(create, { seed, bot: bot(seed), difficulty: level }).game.score);
}
const passRate = (a) => a.filter((s) => s >= pass).length / a.length;
console.log(`cupadee pass ${pass}`);
for (const [level, row] of Object.entries(TABLE)) console.log(level, Object.entries(row).map(([n, a]) => `${n} ${Math.round(mean(a))} [${Math.min(...a)}-${Math.max(...a)}] ${Math.round(passRate(a) * 100)}%`).join(' · '));

test('cupadee: at Normal a medium pourer passes, a sharp one earns far more; idle, mashing and holding do not', () => {
  const t = TABLE.normal;
  assert.ok(passRate(t.medium) >= 0.75, `medium ${t.medium}`);
  assert.ok(Math.min(...t.good) >= pass * 2.5, `good ${t.good}`);
  assert.ok(passRate(t.clumsy) <= 0.5, `clumsy ${t.clumsy}`);
  assert.equal(Math.max(...t.idle), 0);
  for (const n of ['idle', 'mash', 'hold']) assert.ok(Math.max(...t[n]) < pass, `${n} ${t[n]}`);
});

// Points come per cup, and big still cups take longer to fill, so a gentler
// round also serves fewer cups: Easier helps a clumsy pourer only a little.
test('cupadee: Easier lets a clumsy pourer pass more often than Normal; idle, mashing and holding still fail', () => {
  const t = TABLE.easier;
  assert.ok(passRate(t.clumsy) > passRate(TABLE.normal.clumsy), `clumsy ${t.clumsy} vs ${TABLE.normal.clumsy}`);
  assert.ok(passRate(t.medium) >= 0.9, `medium ${t.medium}`);
  for (const n of ['idle', 'mash', 'hold']) assert.ok(Math.max(...t[n]) < pass, `${n} ${t[n]}`);
});

test('cupadee: Harder ends hard: the good pourer scores clearly more; a clumsy one does worse than at Normal', () => {
  const t = TABLE.harder;
  assert.ok(mean(t.good) > mean(t.medium) * 1.8, `good ${mean(t.good)} vs medium ${mean(t.medium)}`);
  assert.ok(mean(t.clumsy) < mean(TABLE.normal.clumsy), `clumsy ${mean(t.clumsy)} vs ${mean(TABLE.normal.clumsy)}`);
});

// The knobs, third by third at Normal: lines stray further, more small and
// moving cups, Cupadees less patient; the first third stays gentle.
test('cupadee: the knobs harden third by third at Normal', () => {
  const game = create(env(1));
  const look = () => ({ d: game.d(), spread: game.lineSpread(), small: game.smallChance(), tiny: game.tinyChance(), stroll: game.strollChance(), patience: game.patienceNow() });
  const step = (s) => { for (let i = 0; i < s * 60; i++) game.update(1 / 60, blank()); };
  const start = look();
  step(15);
  const third = look();
  step(15);
  const two = look();
  step(14.9);
  const end = look();
  console.log('cupadee ramp', { start, third, two, end });
  for (const [a, b] of [[start, third], [third, two], [two, end]]) {
    assert.ok(a.d < b.d && a.patience > b.patience && a.tiny <= b.tiny && a.stroll <= b.stroll, 'harder each third');
  }
  assert.ok(third.d < 0.3, 'the first third stays gentle');
  assert.ok(end.d < 1, 'Normal never reaches full hard');
});

test('cupadee: holding on too long spills the cup and breaks the combo', () => {
  const game = create(env(1));
  game.streak = 3;
  for (let i = 0; i < 60 * 12 && !game.spills; i++) game.update(1 / 60, blank({ action: true }));
  assert.equal(game.spills, 1);
  assert.equal(game.streak, 0);
  assert.equal(game.score, 0);
});

test('cupadee: a fill right on the line is Perfect', () => {
  const game = create(env(1));
  let t = 0;
  while (!game.birds.some((b) => b.state === 'serve') && t < 5) {
    game.update(1 / 60, blank());
    t += 1 / 60;
  }
  const b = game.birds.find((b) => b.state === 'serve');
  b.fill = b.line;
  for (let i = 0; i < 40; i++) game.update(1 / 60, blank());
  assert.equal(game.perfects, 1);
  assert.equal(game.score, 100);
  assert.ok(Number.isInteger(game.score));
});

// The Cupadee is one size in every painted pose (standing, beak open), and stands on the
// same line: measured against how big each picture is painted
// (design/source/pose-scales.json).
test('cupadee: every painted pose shows the Cupadee the same size, on the same feet', async () => {
  const { withArt, birdSizes, sizeCheck } = await import('./sprite-rig.mjs');
  const undo = withArt();
  try {
    const feet = { 'bird.cupadee#0': 0.964, 'sprites.cupadeeOpen#0': 0.962 };
    const sizes = await birdSizes('cupadee', { standing: {}, open: { open: true } }, feet);
    const { fails, table } = sizeCheck(sizes, 'standing');
    console.log('cupadee pose sizes', table);
    assert.deepEqual(fails, []);
    const y0 = sizes.standing[0].feetY;
    for (const [name, [d]] of Object.entries(sizes)) assert.ok(Math.abs(d.feetY - y0) < 4, `${name}: feet at ${d.feetY.toFixed(1)}, standing at ${y0.toFixed(1)}`);
  } finally {
    undo();
  }
});

test('cupadee: the round starts with big, still cups and ends with small, moving ones', () => {
  const early = [];
  const late = [];
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const game = create(env(seed));
    const seen = new Set(game.birds);
    while (!game.done) {
      game.update(1 / 60, blank({ action: false }));
      for (const b of game.birds) {
        if (seen.has(b)) continue;
        seen.add(b);
        (game.elapsed < 15 ? early : game.elapsed > 30 ? late : []).push(b);
      }
    }
  }
  const hard = (b) => (b.kind !== 'big' ? 1 : 0) + (b.motion !== 'still' ? 1 : 0);
  const mean = (a, f) => a.reduce((s, b) => s + f(b), 0) / a.length;
  assert.ok(early.length && late.length);
  assert.ok(mean(early, hard) < 0.5, `early cups mostly big and still: ${mean(early, hard)}`);
  assert.ok(mean(late, hard) > mean(early, hard) + 0.7, `late cups harder: ${mean(early, hard)} vs ${mean(late, hard)}`);
  assert.ok(mean(late, (b) => b.cap) < mean(early, (b) => b.cap) * 0.85, 'late cups smaller');
  assert.ok(mean(late, (b) => b.patience) < mean(early, (b) => b.patience), 'late Cupadees less patient');
});

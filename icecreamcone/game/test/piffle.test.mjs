import test from 'node:test';
import assert from 'node:assert/strict';
import create from '../src/games/piffle.js';
import { BIRDS } from '../src/birds.js';
import { run, env, blank } from './harness.mjs';

const pass = BIRDS.find((b) => b.id === 'piffle').pass;

// A player who steers the stick toward where the seam will be in `look`
// seconds, with a reaction `lag` (it sees the needle as it was a few frames
// ago), and hurries while the seam ahead is fairly straight (`dare`: the
// sideways drift per px it will still hurry through; 0 never hurries).
function sewer({ look = 0.12, lag = 6, dare = 0, gain = 30 } = {}) {
  const seen = [];
  return (game) => {
    seen.push(game.x);
    const x = seen.length > lag ? seen[seen.length - 1 - lag] + (game.x - seen[seen.length - 1 - lag]) * 0.5 : game.x;
    const ahead = game.dist + game.speed() * look;
    const target = game.seamX(ahead);
    const bend = Math.abs(game.seamX(game.dist + 260) - game.seamX(game.dist)) / 260;
    return { x: Math.max(-1, Math.min(1, (target - x) / gain)), action: dare > 0 && bend < dare };
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
// The lag is in frames, so a faster quilt and tighter bends cost a slow
// sewer more and more.
const BOTS = {
  idle: () => () => ({}),
  mash: (seed) => masher(seed),
  clumsy: () => sewer({ lag: 40, gain: 120, look: 0 }),
  medium: () => sewer({ lag: 16, gain: 60, look: 0 }),
  good: () => sewer({ lag: 4, dare: 1.2 }),
};
const TABLE = {};
for (const level of ['easier', 'normal', 'harder']) {
  TABLE[level] = {};
  for (const [name, bot] of Object.entries(BOTS)) TABLE[level][name] = SEEDS.map((seed) => run(create, { seed, bot: bot(seed), difficulty: level }).game.score);
}
const passRate = (a) => a.filter((s) => s >= pass).length / a.length;
console.log(`piffle pass ${pass}`);
for (const [level, row] of Object.entries(TABLE)) console.log(level, Object.entries(row).map(([n, a]) => `${n} ${Math.round(mean(a))} [${Math.min(...a)}-${Math.max(...a)}] ${Math.round(passRate(a) * 100)}%`).join(' · '));

test('piffle: at Normal a medium sewer passes; a clumsy one seldom; idle and mashing do not', () => {
  const t = TABLE.normal;
  assert.ok(passRate(t.medium) >= 0.75, `medium ${t.medium}`);
  assert.ok(passRate(t.clumsy) <= 0.5, `clumsy ${t.clumsy}`);
  for (const n of ['idle', 'mash']) assert.ok(Math.max(...t[n]) < pass, `${n} ${t[n]}`);
});

test('piffle: Easier lets a clumsy sewer pass; idle and mashing still fail', () => {
  const t = TABLE.easier;
  assert.ok(passRate(t.clumsy) >= 0.75, `clumsy ${t.clumsy}`);
  for (const n of ['idle', 'mash']) assert.ok(Math.max(...t[n]) < pass, `${n} ${t[n]}`);
});

test('piffle: Harder ends hard: the good sewer scores clearly more; a clumsy one does worse', () => {
  const t = TABLE.harder;
  assert.ok(mean(t.good) > mean(t.medium) + 40, `good ${mean(t.good)} vs medium ${mean(t.medium)}`);
  assert.ok(mean(t.clumsy) < mean(TABLE.normal.clumsy), `clumsy ${mean(t.clumsy)}`);
  for (const n of ['idle', 'mash']) assert.ok(Math.max(...t[n]) < pass, `${n} ${t[n]}`);
});

// The knobs by thirds of the round at Normal.
test('piffle: the knobs harden third by third at Normal', () => {
  const game = create(env(1));
  const look = () => ({ d: game.d(), speed: game.quiltSpeed(), gap: game.bendGap(), swing: game.bendSwing() });
  const step = (s) => { for (let i = 0; i < s * 60; i++) game.update(1 / 60, blank()); };
  const start = look();
  step(15);
  const third = look();
  step(15);
  const two = look();
  step(14.9);
  const end = look();
  console.log('piffle ramp', { start, third, two, end });
  for (const [a, b] of [[start, third], [third, two], [two, end]]) assert.ok(a.speed < b.speed && a.gap > b.gap && a.swing < b.swing);
  assert.ok(third.d < 0.3, 'the first third stays gentle');
});

test('piffle: the quilt starts slow with a gentle seam and ends fast and twisty', () => {
  const game = create(env(1));
  const sample = () => {
    // how far the seam swings over the next 600 px of quilt
    let swing = 0;
    for (let s = 0; s < 600; s += 20) swing += Math.abs(game.seamX(game.dist + s + 20) - game.seamX(game.dist + s));
    return { speed: game.speed(), swing };
  };
  // the first stretch of seam is laid at the start; look at what lies ahead later
  for (let i = 0; i < 60 * 12; i++) game.update(1 / 60, blank({ x: Math.sign(game.seamX(game.dist) - game.x) }));
  const early = sample();
  while (game.elapsed < 44) game.update(1 / 60, blank({ x: Math.sign(game.seamX(game.dist) - game.x) }));
  const late = sample();
  assert.ok(late.speed > early.speed * 1.3, `speed ${early.speed} to ${late.speed}`);
  assert.ok(late.swing > early.swing * 1.5, `seam swing per 600 px ${early.swing} to ${late.swing}`);
});

test('piffle: a stitch on the seam scores, one off it does not', () => {
  const game = create(env(1));
  // the first stretch of seam runs straight down the middle
  for (let i = 0; i < 60; i++) game.update(1 / 60, blank());
  assert.ok(game.score > 0);
  const before = game.score;
  game.x = game.seamX(game.dist) + 200;
  for (let i = 0; i < 20; i++) game.update(1 / 60, blank());
  assert.equal(game.score, before);
  assert.ok(game.wobbly > 0);
});

test('piffle: holding the action sews faster', () => {
  const a = create(env(1));
  const b = create(env(1));
  for (let i = 0; i < 120; i++) {
    a.update(1 / 60, blank());
    b.update(1 / 60, blank({ action: true }));
  }
  assert.ok(b.dist > a.dist * 1.4);
});

test('piffle: B slows the quilt and the needle; a trigger slows only the needle', () => {
  const go = (over) => {
    const game = create(env(1));
    const x0 = game.x;
    for (let i = 0; i < 30; i++) game.update(1 / 60, blank({ x: 1, ...over }));
    return { dist: game.dist, moved: game.x - x0 };
  };
  const plain = go({});
  const slow = go({ slow: true });
  const fine = go({ trigger: 1 });
  assert.ok(slow.dist < plain.dist * 0.7 && slow.moved < plain.moved * 0.8, `slow ${JSON.stringify(slow)} vs ${JSON.stringify(plain)}`);
  assert.ok(Math.abs(fine.dist - plain.dist) < 1e-6, 'a trigger leaves the quilt at its pace');
  assert.ok(fine.moved < plain.moved * 0.6, `fine ${JSON.stringify(fine)} vs ${JSON.stringify(plain)}`);
  // RT steering finely doesn't also hurry: only A (actionA) does.
  const rt = go({ trigger: 1, action: true, actionA: false });
  assert.ok(Math.abs(rt.dist - plain.dist) < 1e-6, 'RT held is not the action here');
});

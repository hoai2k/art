// Points: the score scaled by the difficulty it was earned at (src/points.js),
// worked out by the shell from each change in a game's score.
import test from 'node:test';
import assert from 'node:assert/strict';
import { multiplier, addPoints, shownPoints, dNow, pointsFor } from '../src/points.js';
import { curve, LEVELS } from '../src/games/difficulty.js';
import { BIRDS } from '../src/birds.js';
import coot from '../src/games/coot.js';
import crow from '../src/games/crow.js';
import { run, env, blank } from './harness.mjs';

const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

test('points: a score at d = 0 earns 1x, at d = 1 earns 2x, in a straight line between', () => {
  assert.equal(multiplier(0), 1);
  assert.equal(multiplier(1), 2);
  assert.equal(multiplier(0.5), 1.5);
  assert.equal(addPoints(0, 10, 0), 10);
  assert.equal(addPoints(0, 10, 1), 20);
  assert.ok(near(addPoints(5, 3, 0.25), 8.75));
  // d outside 0..1 (or not a number) is clamped
  assert.equal(multiplier(-1), 1);
  assert.equal(multiplier(3), 2);
  assert.equal(multiplier(NaN), 1);
});

test('points: penalties scale too, and points never go below 0', () => {
  assert.equal(addPoints(10, -2, 0), 8);
  assert.equal(addPoints(10, -2, 1), 6);
  assert.equal(addPoints(3, -5, 0.5), 0);
  assert.equal(addPoints(0, -1, 0), 0);
});

test('points: the exact tally is kept; whole numbers are shown', () => {
  const g = { score: 0, d: () => 0.25 };
  const p = pointsFor(g);
  p.step(() => (g.score += 1));
  p.step(() => (g.score += 1));
  assert.equal(p.exact, 2.5);
  assert.equal(p.shown, shownPoints(2.5));
  p.step(() => {}); // nothing scored: nothing added
  assert.equal(p.exact, 2.5);
  // the difficulty is read before the update: the moment the action was taken
  let d = 0;
  const h = { score: 0, d: () => d };
  const q = pointsFor(h);
  q.step(() => {
    h.score += 4;
    d = 1;
  });
  assert.equal(q.exact, 4);
});

test('points: a best-so-far score (Scoop Stack) earns only when it rises', () => {
  const g = { score: 0, d: () => 0.5 };
  const p = pointsFor(g);
  for (const s of [1, 2, 3, 3, 3, 4]) p.step(() => (g.score = Math.max(g.score, s)));
  assert.equal(p.exact, 4 * 1.5);
});

test('points: Puddle Hop reads its difficulty from dNow (its d is the distance walked)', () => {
  assert.equal(dNow({ d: 900, dNow: () => 0.3 }), 0.3);
  assert.equal(dNow({ d: () => 0.7 }), 0.7);
  assert.equal(dNow({}), 0);
});

// Every game exposes its own difficulty curve, so the shell needs no table of
// round lengths: time (most), beats (Gullfinch), rounds (Dodo, Glass Harp),
// shots or time (Shuttercluck).
test('points: all 28 games give their difficulty now, in 0..1, rising through the round', async () => {
  assert.equal(BIRDS.length, 28);
  for (const b of BIRDS) {
    const { default: create } = await import(`../src/games/${b.id}.js`);
    const start = {};
    for (const level of LEVELS) {
      const g = create(env(1, { difficulty: level }));
      assert.ok(typeof g.dNow === 'function' || typeof g.d === 'function', `${b.id} has a difficulty`);
      start[level] = dNow(g);
      assert.ok(start[level] >= 0 && start[level] <= 1, `${b.id} ${level} ${start[level]}`);
    }
    assert.ok(start.harder > start.normal && start.normal >= start.easier, `${b.id} starts ordered: ${JSON.stringify(start)}`);
    // Run it idle (or mashing, for games that wait on the player) and watch d rise.
    let r = 7;
    const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    const g = create(env(1, { difficulty: 'normal' }));
    let last = dNow(g);
    let rose = false;
    for (let t = 0; t < 400 && !g.done; t += 1 / 30) {
      const press = rnd() < 0.2;
      g.update(1 / 30, blank({ x: rnd() * 2 - 1, y: rnd() * 2 - 1, action: press, actionPressed: press, left: rnd() < 0.05, right: rnd() < 0.05 }));
      const d = dNow(g);
      assert.ok(d >= last - 1e-9, `${b.id}: d never falls (${last} to ${d})`);
      if (d > last + 1e-6) rose = true;
      last = d;
    }
    assert.ok(rose, `${b.id}: d rises through the round`);
  }
});

// The same plain score, earned at an even rate through a 45 s round: Harder
// earns more points than Normal, and Normal more than Easier.
test('points: the same play earns more at Harder than Normal, and at Normal than Easier', () => {
  const pts = {};
  for (const level of LEVELS) {
    const dAt = curve({ difficulty: level });
    const g = { score: 0, elapsed: 0, d: () => dAt(g.elapsed / 45) };
    const p = pointsFor(g);
    for (let i = 0; i < 45; i++) p.step(() => { g.score += 1; g.elapsed += 1; });
    pts[level] = p.exact;
    assert.equal(g.score, 45);
  }
  assert.ok(pts.harder > pts.normal && pts.normal > pts.easier, JSON.stringify(pts));
  assert.ok(pts.easier >= 45 && pts.harder <= 90);
});

// The same with real games and their bots: per unit of score, Harder pays
// more than Normal and Normal more than Easier (the scores themselves differ,
// since the games play differently, so it is compared per unit).
function chaser(game) {
  const top = { x: game.x - 86 };
  const good = game.items.filter((i) => i.kind !== 'pickle' && i.kind !== 'sock').sort((a, b) => b.y - a.y)[0];
  const bad = game.items.filter((i) => (i.kind === 'pickle' || i.kind === 'sock') && i.y > 300).sort((a, b) => b.y - a.y)[0];
  let target = good ? good.x : top.x;
  if (bad && Math.abs(bad.x - top.x) < 90) target = top.x + (bad.x > top.x ? -200 : 200);
  return { x: Math.max(-1, Math.min(1, (target - top.x) / 60)) };
}
// Crow: a steady hand, pressing at random about twice a second.
function presser(seed) {
  let r = seed * 31;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  return () => {
    const a = rnd() < 0.035;
    return { action: a, x: rnd() * 2 - 1, y: rnd() * 2 - 1 };
  };
}
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
for (const [name, create, bot] of [['coot', coot, () => chaser], ['crow', crow, presser]]) {
  test(`points: ${name}'s bot earns more per unit at Harder than Normal than Easier`, () => {
    const rate = {};
    for (const level of LEVELS) {
      let score = 0;
      let points = 0;
      for (const seed of SEEDS) {
        const r = run(create, { seed, bot: bot(seed), difficulty: level });
        assert.ok(r.points >= 0);
        score += r.game.score;
        points += r.points;
      }
      assert.ok(score > 0, `${name} ${level} scores`);
      rate[level] = points / score;
      assert.ok(rate[level] >= 1 && rate[level] <= 2, `${name} ${level} ${rate[level]}`);
    }
    console.log(name, 'points per unit', Object.entries(rate).map(([l, v]) => `${l} ${v.toFixed(2)}`).join(' · '));
    assert.ok(rate.harder > rate.normal && rate.normal > rate.easier, JSON.stringify(rate));
  });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import create from '../src/games/peeper.js';
import { BIRDS } from '../src/birds.js';
import { run, env, blank } from './harness.mjs';

const pass = BIRDS.find((b) => b.id === 'peeper').pass;
const CATCH_Y = 860 - 150;

// A sharp reader: runs to where the next needed letter will be when it
// reaches the Peeper, and steps aside from wrong letters about to land on it.
function reader({ speed = 1, look = 1, react = 0 } = {}) {
  return (game) => {
    const need = game.word[game.idx];
    const eta = (l) => (CATCH_Y - l.y) / l.vy;
    const live = game.letters.filter((l) => !l.dead && l.y < CATCH_Y + 20 && l.age >= react);
    const want = live.filter((l) => l.ch === need && eta(l) > -0.05).sort((a, b) => eta(a) - eta(b))[0];
    let target = want ? game.letterX(want, Math.max(0, eta(want)) * look) : game.x;
    const soon = want ? eta(want) : 9;
    for (const l of live) {
      if (l.ch === need || eta(l) > 0.45 || eta(l) < -0.1 || eta(l) > soon) continue;
      const lx = game.letterX(l, Math.max(0, eta(l)));
      if (Math.abs(lx - target) < 100) target = lx + (target >= lx ? 110 : -110);
    }
    const d = target - game.x;
    return { x: Math.max(-1, Math.min(1, d / 40)) * speed };
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
// The slower readers notice a letter only once it has fallen a while
// (`react` seconds), so quicker letters leave them less time to get there.
const BOTS = {
  idle: () => () => ({}),
  mash: (seed) => masher(seed),
  wander: () => (game, t) => ({ x: Math.sin(t * 0.7) }),
  clumsy: () => reader({ speed: 0.3, look: 0, react: 0.8 }),
  medium: () => reader({ speed: 0.5, look: 0, react: 0.6 }),
  good: () => reader(),
};
const TABLE = {};
for (const level of ['easier', 'normal', 'harder']) {
  TABLE[level] = {};
  for (const [name, bot] of Object.entries(BOTS)) TABLE[level][name] = SEEDS.map((seed) => run(create, { seed, bot: bot(seed), difficulty: level }).game.score);
}
const passRate = (a) => a.filter((s) => s >= pass).length / a.length;
console.log(`peeper pass ${pass}`);
for (const [level, row] of Object.entries(TABLE)) console.log(level, Object.entries(row).map(([n, a]) => `${n} ${Math.round(mean(a))} [${Math.min(...a)}-${Math.max(...a)}] ${Math.round(passRate(a) * 100)}%`).join(' · '));

test('peeper: at Normal a medium reader passes, a sharp one always; idle, mashing and wandering do not', () => {
  const t = TABLE.normal;
  assert.ok(passRate(t.medium) >= 0.75, `medium ${t.medium}`);
  assert.ok(Math.min(...t.good) >= pass, `good ${t.good}`);
  assert.ok(passRate(t.clumsy) <= 0.5, `clumsy ${t.clumsy}`);
  for (const n of ['idle', 'mash', 'wander']) assert.ok(Math.max(...t[n]) < pass, `${n} ${t[n]}`);
});

test('peeper: Easier lets a clumsy reader pass; idle, mashing and wandering still fail', () => {
  const t = TABLE.easier;
  assert.ok(passRate(t.clumsy) >= 0.75 && passRate(t.clumsy) > passRate(TABLE.normal.clumsy), `clumsy ${t.clumsy}`);
  for (const n of ['idle', 'mash', 'wander']) assert.ok(Math.max(...t[n]) < pass, `${n} ${t[n]}`);
});

test('peeper: Harder ends hard: the sharp reader scores clearly more; a clumsy one does worse', () => {
  const t = TABLE.harder;
  assert.ok(mean(t.good) > mean(t.medium) + 10, `good ${mean(t.good)} vs medium ${mean(t.medium)}`);
  assert.ok(mean(t.clumsy) < mean(TABLE.normal.clumsy), `clumsy ${mean(t.clumsy)}`);
  for (const n of ['idle', 'mash', 'wander']) assert.ok(Math.max(...t[n]) < pass, `${n} ${t[n]}`);
});

// The knobs by thirds of the round at Normal.
test('peeper: the knobs harden third by third at Normal', () => {
  const game = create(env(1));
  const look = () => ({ d: game.d(), fall: game.fall(), sway: game.sway(), gap: game.gap(), need: game.needShare() });
  const step = (s) => { for (let i = 0; i < s * 60; i++) game.update(1 / 60, blank()); };
  const start = look();
  step(15);
  const third = look();
  step(15);
  const two = look();
  step(14.9);
  const end = look();
  console.log('peeper ramp', { start, third, two, end });
  for (const [a, b] of [[start, third], [third, two], [two, end]]) assert.ok(a.fall < b.fall && a.sway < b.sway && a.gap > b.gap && a.need > b.need);
  assert.ok(third.d < 0.3, 'the first third stays gentle');
});

test('peeper: letters start slow, steady and helpful, and end fast and swaying', () => {
  const early = [];
  const late = [];
  for (const seed of [1, 2, 3, 4]) {
    const game = create(env(seed));
    const seen = new Set();
    while (!game.done) {
      game.update(1 / 60, blank());
      for (const l of game.letters) {
        if (seen.has(l)) continue;
        seen.add(l);
        const half = game.elapsed < 15 ? early : game.elapsed > 30 ? late : null;
        if (half) half.push({ vy: l.vy, amp: l.amp });
      }
    }
  }
  const avg = (a, f) => a.reduce((s, x) => s + f(x), 0) / a.length;
  assert.ok(late.length > early.length * 1.2, `more letters late: ${early.length} vs ${late.length}`);
  assert.ok(avg(late, (l) => l.vy) > avg(early, (l) => l.vy) * 1.6, 'they fall faster');
  assert.ok(avg(late, (l) => l.amp) > avg(early, (l) => l.amp) * 2, 'they sway wider');
});

test('peeper: right letters stamp the word, wrong ones smudge, a word pays its length', () => {
  const game = create(env(4));
  const word = game.word;
  // catch a wrong letter first: no points to lose, the score stays at 0
  const wrong = 'Z';
  game.letters.push({ ch: wrong, bx: game.x, y: CATCH_Y, vy: 100, amp: 0, w: 1, ph: 0, age: 0, rot: 0, seed: 1 });
  game.update(1 / 60, blank());
  assert.equal(game.score, 0);
  assert.equal(game.smudged, 1);
  for (const ch of word) {
    game.letters.push({ ch, bx: game.x, y: CATCH_Y, vy: 100, amp: 0, w: 1, ph: 0, age: 0, rot: 0, seed: 1 });
    game.update(1 / 60, blank());
  }
  assert.equal(game.words, 1);
  assert.equal(game.score, word.length * 2);
  assert.ok(game.word.length > word.length, 'the next word is longer');
});

test('peeper: the needed letter keeps coming', () => {
  const game = create(env(9));
  let gapMax = 0;
  let gap = 0;
  for (let i = 0; i < 60 * 44; i++) {
    game.update(1 / 60, blank());
    const has = game.letters.some((l) => !l.dead && l.ch === game.word[game.idx]);
    gap = has ? 0 : gap + 1 / 60;
    gapMax = Math.max(gapMax, gap);
  }
  assert.ok(gapMax < 1.5, `the needed letter was missing for ${gapMax.toFixed(2)} s`);
});

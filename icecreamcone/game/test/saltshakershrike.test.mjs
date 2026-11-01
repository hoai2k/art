import test from 'node:test';
import assert from 'node:assert/strict';
import create from '../src/games/saltshakershrike.js';
import bird from '../src/more/saltshakershrike.js';
import { run, env, blank } from './harness.mjs';

const pass = bird.pass;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Where a pinch shaken now would have to fall to land on plate p: its x
// when the salt reaches its food.
function landing(game, p, extra = 0) {
  const q = { a: p.a + game.omega() * extra };
  let T = game.fall(game.at(q).food);
  for (let i = 0; i < 3; i++) T = game.fall(game.at(q, T).food);
  return { x: game.at(q, T).x, a: q.a + game.omega() * T };
}

// A cook: takes the plates nearest the diner first, shakes where each will
// be when the salt lands, and counts the pinches it sends. `skill` slows it,
// leads too little, aims looser and now and then loses count (one pinch too
// many). `clumsy` is a weaker player still: it leads less, shakes slowly,
// looks up late when it moves on to the next plate and loses count more.
const C = { lead: 0.3, tol: 40, lose: 0.15, speed: 0.5, beat: 0.5, react: 0.7 };
function cook(skill = 1, seed = 1, clumsy = false) {
  let r = seed * 7919;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  const sent = new Map();
  let pressed = false;
  let cur = null;
  let ready = 0;
  return (game, t) => {
    if (pressed) {
      pressed = false;
      return {};
    }
    const p = game.plates
      .filter((p) => !p.dessert && p.n > (sent.get(p.id) || 0) && landing(game, p).a < Math.PI - 0.12)
      .sort((a, b) => b.a - a.a)[0];
    if (!p) return {};
    if (clumsy && p.id !== cur) {
      cur = p.id;
      ready = t + C.react;
    }
    if (clumsy && t < ready) return {};
    const full = landing(game, p).x;
    const aim = skill >= 1 ? full : p.x + (full - p.x) * (clumsy ? C.lead : 0.7);
    const dx = aim - game.x;
    if (Math.abs(dx) < (skill >= 1 ? 12 : clumsy ? C.tol : 26) && game.cool <= 0) {
      pressed = true;
      let n = (sent.get(p.id) || 0) + 1;
      if (skill < 1 && rnd() < (clumsy ? C.lose : 0.12)) n--; // lost count
      sent.set(p.id, n);
      if (clumsy) ready = t + C.beat;
      return { action: true };
    }
    // a good cook keeps pace with where the plate is going
    const follow = skill >= 1 ? (landing(game, p, 0.05).x - full) / 0.05 / 950 : 0;
    return { x: clamp(follow + dx / 50, -1, 1) * (clumsy ? C.speed : 0.55 + 0.45 * skill) };
  };
}

// Mashing: shake as fast as possible, from one spot or wandering about.
const masher = (seed, still) => {
  let r = seed * 31;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  let d = 0;
  return (game, t) => {
    if (rnd() < 0.02) d = rnd() * 2 - 1;
    return { x: still ? 0 : d, action: Math.floor(t * 8) % 2 === 0 };
  };
};

// Follows the plate nearest the diner and shakes all the way.
const salter = () => (game, t) => {
  const p = game.plates.filter((p) => !p.dessert && p.a < Math.PI - 0.3).sort((a, b) => b.a - a.a)[0];
  if (!p) return {};
  const dx = landing(game, p).x - game.x;
  return { x: clamp(dx / 50, -1, 1), action: Math.floor(t * 8) % 2 === 0 };
};

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const BOTS = {
  idle: () => () => ({}),
  mash: (seed) => masher(seed, false),
  still: (seed) => masher(seed, true),
  salter: () => salter(),
  clumsy: (seed) => cook(0.3, seed, true), // slow, leads little, loses count often
  medium: (seed) => cook(0.4, seed), // competent, not expert: handles medium
  good: (seed) => cook(1, seed),
};
// Every bot at every level, once (the tests below read this table).
const TABLE = {};
for (const level of ['easier', 'normal', 'harder']) {
  TABLE[level] = {};
  for (const [name, bot] of Object.entries(BOTS)) TABLE[level][name] = SEEDS.map((seed) => {
    return run(create, { seed, bot: bot(seed), difficulty: level }).game.score;
  });
}
const passRate = (a) => a.filter((s) => s >= pass).length / a.length;
console.log(`saltshakershrike pass ${pass}`);
for (const [level, row] of Object.entries(TABLE)) console.log(level, Object.entries(row).map(([n, a]) => `${n} ${Math.round(mean(a))} [${Math.min(...a)}-${Math.max(...a)}] ${Math.round(passRate(a) * 100)}%`).join(' · '));

test('saltshakershrike: at Normal a medium player opens the next page, a clumsy one seldom; idle, mashing and over-salting never', () => {
  const t = TABLE.normal;
  assert.equal(Math.max(...t.idle), 0);
  assert.ok(passRate(t.medium) >= 0.9, `medium ${t.medium}`);
  assert.ok(passRate(t.clumsy) <= 0.35, `clumsy at Normal ${t.clumsy}`);
  assert.ok(mean(t.good) >= mean(t.medium), `good ${t.good}`);
  for (const name of ['mash', 'still', 'salter']) assert.ok(Math.max(...t[name]) < pass, `${name} must not pass at Normal: ${t[name]}`);
});

test('saltshakershrike: Easier lets a clumsy cook pass, but not idling or mashing', () => {
  const t = TABLE.easier;
  assert.ok(passRate(t.clumsy) >= 0.75, `clumsy at Easier ${t.clumsy}`);
  assert.ok(passRate(TABLE.normal.clumsy) < passRate(t.clumsy), 'Easier is easier for the clumsy cook');
  for (const name of ['idle', 'mash', 'still', 'salter']) assert.ok(Math.max(...t[name]) < pass, `${name} must not pass at Easier: ${t[name]}`);
});

// Points come from plates served, so a busier table pays more to whoever
// keeps up: the hard end is where records are made.
test('saltshakershrike: Harder ends hard: the good cook scores clearly more there; a clumsy one falls apart', () => {
  const t = TABLE.harder;
  assert.ok(mean(t.good) > mean(t.medium) + 4, `good ${mean(t.good)} vs medium ${mean(t.medium)} at Harder`);
  assert.ok(mean(t.good) > mean(TABLE.normal.good) + 6, `good at Harder ${mean(t.good)} vs Normal ${mean(TABLE.normal.good)}`);
  assert.ok(mean(t.clumsy) < mean(TABLE.normal.clumsy) * 0.7, 'Harder is harder for the clumsy cook');
});

// A plate with its order, alone on the table under the Shrike, the table stopped.
function onePlate(n, dessert = false) {
  const game = create(env(1));
  game.spawnT = 99;
  game.update(1 / 60, blank());
  const a = Math.PI / 2;
  game.plates = [{ id: 99, a, x: game.at({ a }).x, y: game.at({ a }).y, n, got: 0, kind: dessert ? 6 : 0, dessert, who: 0, wob: 0, set: 0 }];
  game.omega = () => 0;
  return game;
}
// Shakes `k` pinches straight down onto the plate and lets them land.
function shake(game, k) {
  const p = game.plates[0];
  game.x = p.x;
  for (let i = 0; i < k; i++) {
    game.update(1 / 60, blank({ action: true, actionPressed: true }));
    for (let j = 0; j < 15; j++) game.update(1 / 60, blank());
  }
  for (let j = 0; j < 60; j++) game.update(1 / 60, blank());
}
// Turns the table until the diner has the plate.
function serve(game) {
  game.omega = () => 0.5;
  for (let i = 0; i < 60 * 10 && game.plates.length; i++) game.update(1 / 60, blank());
}

test('saltshakershrike: just right scores three, one out scores one, more is a frown, none is nothing', () => {
  for (const [n, k, pts] of [[3, 3, 3], [3, 2, 1], [3, 4, 1], [3, 5, 0], [2, 0, 0], [1, 0, 0]]) {
    const game = onePlate(n);
    shake(game, k);
    assert.equal(game.plates[0].got, k, `pinches landed for ${n}/${k}`);
    serve(game);
    assert.equal(game.score, pts, `order ${n}, shook ${k}`);
  }
});

test('saltshakershrike: salt that misses the plate lands on the table', () => {
  const game = onePlate(2);
  game.x = 500;
  game.update(1 / 60, blank({ action: true, actionPressed: true }));
  for (let j = 0; j < 60; j++) game.update(1 / 60, blank());
  assert.equal(game.plates[0].got, 0);
  assert.equal(game.spilt, 1);
});

test('saltshakershrike: a pudding wants no salt; salting one costs one', () => {
  const plain = onePlate(0, true);
  serve(plain);
  assert.equal(plain.score, 0);
  assert.equal(plain.frowns, 0);
  const salted = onePlate(0, true);
  salted.score = 5;
  shake(salted, 1);
  serve(salted);
  assert.equal(salted.score, 4);
  assert.equal(salted.frowns, 1);
});

test('saltshakershrike: plates creep at the ends of the table and swing fast across the middle', () => {
  const game = create(env(1));
  const w = game.omega();
  const vx = (a) => Math.abs(game.at({ a: a + 0.01 }).x - game.at({ a }).x) / (0.01 / w);
  assert.ok(vx(Math.PI / 2) > 4 * vx(0.1), `middle ${vx(Math.PI / 2)} vs end ${vx(0.1)}`);
});

// What the plates want, third by third of the round, at a level.
function orders(difficulty) {
  const thirds = [0, 1, 2].map(() => ({ n: [], gaps: [], turn: [] }));
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const game = create(env(seed, { difficulty }));
    const seen = new Set();
    let lastSpawn = null;
    while (!game.done) {
      game.update(1 / 60, blank());
      const third = thirds[Math.min(2, Math.floor(game.elapsed / 15))];
      third.turn.push(game.omega());
      for (const p of game.plates) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        if (lastSpawn !== null) third.gaps.push(game.elapsed - lastSpawn);
        lastSpawn = game.elapsed;
        if (!p.dessert) third.n.push(p.n);
      }
    }
  }
  return thirds;
}

test('saltshakershrike: the lunch rush builds: one and two pinches at first, more and faster at the end', () => {
  const [a, , c] = orders('normal');
  assert.ok(Math.max(...a.n) <= 2, `the first third wants at most two pinches: ${a.n}`);
  assert.ok(a.n.filter((n) => n === 1).length > a.n.length * 0.7, `the first third is mostly one pinch: ${a.n}`);
  assert.ok(Math.max(...c.n) >= 4 && mean(c.n) > mean(a.n) + 1, `the last third wants more: ${mean(a.n)} vs ${mean(c.n)}`);
  assert.ok(mean(c.turn) > mean(a.turn) * 1.4, `the table turns faster: ${mean(a.turn)} vs ${mean(c.turn)}`);
  assert.ok(mean(c.gaps) < mean(a.gaps) * 0.75, `plates come closer together: ${mean(a.gaps)} vs ${mean(c.gaps)}`);
});

test('saltshakershrike: Easier stays at one and two pinches on a slow table; Harder opens at medium', () => {
  const easier = orders('easier');
  assert.ok(Math.max(...easier.flatMap((t) => t.n)) <= 2, 'never more than two pinches at Easier');
  assert.ok(Math.max(...easier[2].turn) < 0.5, 'the table stays slow');
  const harder = orders('harder');
  const normal = orders('normal');
  assert.ok(mean(harder[0].n) > mean(normal[0].n) + 0.4, `Harder's opening wants more: ${mean(normal[0].n)} vs ${mean(harder[0].n)}`);
  assert.ok(Math.max(...harder[2].n) === 5, 'Harder ends with five-pinch orders');
});

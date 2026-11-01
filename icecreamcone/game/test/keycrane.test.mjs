import test from 'node:test';
import assert from 'node:assert/strict';
import create from '../src/games/keycrane.js';
import entry from '../src/more/keycrane.js';
import { run, env, blank } from './harness.mjs';

const pass = entry.pass;

// An operator, played like the keyboard: full left or right, let go in time
// to stop over the ring (tapping to fix a near miss), wait until the swing
// has settled to `settle` of the ring's catch width, drop, and carry the
// prize to the chute, easing off whenever it swings past `care`. `speed` is
// how far it pushes the stick. `aim` (px) is how far to one side of the ring
// it stops, picked afresh for each try, so smaller rings catch out a loose
// eye (a clumsy player).
function operator({ speed = 1, settle = 0.5, care = 0.45, pick = 'near', aim = 0, seed = 1 } = {}) {
  let r = seed * 7919;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  let off = 0;
  let misses = 0;
  let pressed = false;
  let target = null;
  return (game) => {
    if (pressed) {
      pressed = false;
      return {};
    }
    if (game.state !== 'top') return {};
    if (game.misses !== misses) {
      misses = game.misses;
      off = (rnd() * 2 - 1) * aim;
    }
    if (game.carry) {
      target = null;
      const [fx] = game.foot();
      if (Math.abs(game.th) > care) return {};
      return { x: fx > 190 ? -speed : 0 };
    }
    if (!target || !game.prizes.includes(target) || target.falling) {
      const cands = game.prizes.filter((p) => !p.falling);
      if (!cands.length) return {};
      cands.sort((a, b) => (pick === 'gold' ? (b.golden - a.golden) * 1000 : 0) + Math.abs(a.x - game.x) - Math.abs(b.x - game.x));
      target = cands[0];
      off = (rnd() * 2 - 1) * aim;
    }
    const rx = game.ring(target)[0] + off;
    const [fx] = game.foot();
    const d = rx - game.x;
    const stop = Math.abs(game.v) / 6;
    if (Math.abs(d) > stop + 5) return { x: Math.sign(d) * (Math.abs(d) < 50 ? 0.25 : speed) };
    if (Math.abs(game.v) > 30) return {};
    // the claws drift out further as the string lengthens: wait until still enough
    const swing = Math.abs(fx - rx) + Math.abs(game.om) * 400;
    if (swing < game.tolerance(target) * settle) {
      pressed = true;
      return { action: true };
    }
    return {};
  };
}

// Drops wherever it happens to be, as fast as it can, wandering about.
const masher = () => (game, t) => ({ x: Math.sin(t * 1.3) * 0.8, action: Math.floor(t * 8) % 2 === 0 });

const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const BOTS = {
  idle: () => () => ({}),
  mash: () => masher(),
  clumsy: (seed) => operator({ speed: 0.3, settle: 0.4, care: 0.2, aim: 50, seed }), // slow, and stops to one side of the ring
  medium: () => operator({ speed: 0.6, settle: 0.4, care: 0.25 }), // the old beginner
  good: () => operator({ speed: 1, settle: 1.8, care: 0.3, pick: 'gold' }),
};
const TABLE = {};
for (const level of ['easier', 'normal', 'harder']) {
  TABLE[level] = {};
  for (const [name, bot] of Object.entries(BOTS)) TABLE[level][name] = SEEDS.map((seed) => run(create, { seed, bot: bot(seed), difficulty: level }).game.score);
}
const passRate = (a) => a.filter((s) => s >= pass).length / a.length;
console.log(`keycrane pass ${pass}`);
for (const [level, row] of Object.entries(TABLE)) console.log(level, Object.entries(row).map(([n, a]) => `${n} ${Math.round(mean(a))} [${Math.min(...a)}-${Math.max(...a)}] ${Math.round(passRate(a) * 100)}%`).join(' · '));

test('keycrane: at Normal a medium operator passes, a good one more; mashing and idling do not', () => {
  const t = TABLE.normal;
  assert.ok(passRate(t.medium) >= 0.75, `medium ${t.medium}`);
  assert.ok(mean(t.good) > mean(t.medium), `good ${t.good}`);
  for (const n of ['idle', 'mash']) assert.ok(Math.max(...t[n]) < pass, `${n} ${t[n]}`);
});

// The winch sets the pace (each try takes a few seconds whatever the level),
// and five prizes is a low bar, so even a slow, loose operator mostly passes
// at Normal too: the levels change the score less here than in most games.
test('keycrane: Easier lets a clumsy operator pass, at least as often as Normal; mashing and idling still do not', () => {
  const t = TABLE.easier;
  assert.ok(passRate(t.clumsy) >= 0.75, `clumsy ${t.clumsy}`);
  assert.ok(passRate(t.clumsy) >= passRate(TABLE.normal.clumsy), `clumsy at Normal ${TABLE.normal.clumsy}`);
  for (const n of ['idle', 'mash']) assert.ok(Math.max(...t[n]) < pass, `${n} ${t[n]}`);
});

test('keycrane: Harder ends hard: the good operator scores clearly more than the medium one', () => {
  const t = TABLE.harder;
  assert.ok(mean(t.good) > mean(t.medium) * 1.15, `good ${mean(t.good)} vs medium ${mean(t.medium)}`);
  assert.ok(passRate(t.clumsy) < passRate(TABLE.normal.clumsy), `clumsy ${t.clumsy}`);
  assert.ok(mean(t.clumsy) <= mean(TABLE.normal.clumsy), `clumsy ${mean(t.clumsy)} vs Normal ${mean(TABLE.normal.clumsy)}`);
});

// The round starts gentle and ends harder, read from the prizes the cabinet
// actually holds as an operator plays: the rings on the first jumble are
// bigger than those that drop in late, and late on the swing settles more
// slowly and a carried prize slips more easily.
test('keycrane: the cabinet starts gentle and ends harder', () => {
  const game = create(env(2));
  const first = game.prizes.map((p) => p.ringR);
  const look = () => ({ damp: game.damp(), slip: game.slipAngle() });
  const start = look();
  const late = [];
  const seen = new Set(game.prizes);
  const bot = operator({ speed: 1, settle: 1.8, care: 0.3 });
  let t = 0;
  while (!game.done) {
    const over = bot(game, t) || {};
    game.update(1 / 60, blank({ ...over, actionPressed: !!over.action }));
    t += 1 / 60;
    for (const p of game.prizes) {
      if (seen.has(p)) continue;
      seen.add(p);
      if (game.elapsed > 30 && !p.golden) late.push(p.ringR);
    }
  }
  const end = look();
  const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  console.log('keycrane ramp', { first, late, start, end });
  assert.ok(late.length >= 2, `prizes dropped in late: ${late.length}`);
  assert.ok(avg(first) > avg(late) * 1.25, 'early rings are bigger');
  assert.ok(end.damp < start.damp && end.slip < start.slip, 'late swings settle slower and prizes slip sooner');
  // third by third from the game's own knobs: the first third stays gentle
  const g2 = create(env(2));
  const knobs = () => ({ ring: g2.ringNow(), damp: g2.damp(), slip: g2.slipAngle() });
  const looks = [knobs()];
  for (let i = 1; i <= 45 * 60 - 1; i++) {
    g2.update(1 / 60, blank());
    if (i === 15 * 60 || i === 30 * 60 || i === 45 * 60 - 1) looks.push(knobs());
  }
  for (let i = 1; i < looks.length; i++) {
    const [x, y] = [looks[i - 1], looks[i]];
    assert.ok(x.ring > y.ring && x.damp > y.damp && x.slip > y.slip, `third ${i} is harder than the one before`);
  }
  assert.ok(looks[0].ring - looks[1].ring < (looks[0].ring - looks[3].ring) / 3, 'the first third stays on the gentle side');
});

test('keycrane: dropping straight onto a ring hooks the prize; the chute scores it', () => {
  const game = create(env(1));
  const p = game.prizes[0];
  game.x = p.x;
  game.th = 0;
  game.om = 0;
  game.update(1 / 60, blank({ actionPressed: true, action: true }));
  for (let i = 0; i < 120 && !game.carry; i++) game.update(1 / 60, blank());
  assert.equal(game.carry, p, 'hooked');
  for (let i = 0; i < 120 && game.state !== 'top'; i++) game.update(1 / 60, blank());
  // carry it over the chute, gently
  for (let i = 0; i < 600 && game.score === 0; i++) {
    const [fx] = game.foot();
    game.update(1 / 60, blank({ x: Math.abs(game.th) > 0.4 ? 0 : Math.max(-0.6, Math.min(0.6, (185 - fx) / 150)) }));
  }
  assert.ok(game.score >= 1, `score ${game.score}`);
});

test('keycrane: a swinging Crane misses the ring', () => {
  const game = create(env(1));
  const p = game.prizes[0];
  game.prizes = [p]; // nothing else to hook by luck
  game.x = p.x;
  game.th = 0.5; // swinging hard
  game.update(1 / 60, blank({ actionPressed: true, action: true }));
  for (let i = 0; i < 300 && game.state !== 'up'; i++) game.update(1 / 60, blank());
  assert.equal(game.carry, null);
  assert.ok(game.misses >= 1);
});

test('keycrane: swinging too hard while carrying makes the prize slip', () => {
  const game = create(env(1));
  const p = game.prizes[0];
  game.prizes = game.prizes.filter((q) => q !== p);
  game.carry = p;
  game.state = 'top';
  game.L = 230;
  game.x = 900;
  // yank the trolley one way and the other, in time with the swing
  for (let i = 0; i < 300 && game.carry; i++) game.update(1 / 60, blank({ x: game.om > 0 ? -1 : 1 }));
  assert.equal(game.carry, null);
  assert.equal(game.slips, 1);
});

test('keycrane: rings get smaller as time goes on', () => {
  const game = create(env(3));
  const early = Math.max(...game.prizes.map((p) => p.ringR));
  game.elapsed = 40;
  // force a respawn
  game.respawn.push(0);
  game.prizes.length = 3;
  game.update(1 / 60, blank());
  const late = game.prizes[game.prizes.length - 1];
  assert.ok(late.ringR < early, `${late.ringR} < ${early}`);
});

test('keycrane: the hanging and startled Crane are drawn at one scale (the key within 4%)', async () => {
  const { readFileSync } = await import('node:fs');
  const M = JSON.parse(readFileSync(new URL('../../design/source/sprite-measures.json', import.meta.url))).keycrane;
  // all three poses are drawn with the same HANG_SCALE, so the key must measure the same in each cell
  const all = [...M.hang, ...M.startle];
  for (const v of all) assert.ok(Math.abs(v / all[0] - 1) <= 0.04, `${all}`);
});

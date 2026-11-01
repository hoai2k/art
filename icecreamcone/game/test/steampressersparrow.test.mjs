import test from 'node:test';
import assert from 'node:assert/strict';
import create from '../src/games/steampressersparrow.js';
import entry from '../src/more/steampressersparrow.js';
import { run, env, blank } from './harness.mjs';
import { makeRng } from '../src/games/index.js';

const pass = entry.pass;

// A presser: goes to the nearest crease and runs the iron along it, end to
// end and back, until it's flat, then on to the next. `speed` is how hard it
// pushes the stick; with `steam` it puffs at the start of each stroke.
function presser({ speed = 0.6, steam = false, kind = 'keyboard', rest = 0 } = {}) {
  let crease = null;
  let idx = 0;
  let dir = 1;
  let press = false;
  return (game, t) => {
    if (press) {
      press = false;
      return {};
    }
    // a clumsy presser looks away for `rest` seconds in every three
    if (rest && t % 3 < rest) return {};
    const open = game.open();
    if (!open.length) return {};
    if (!crease || crease.done || !open.includes(crease)) {
      const d = (c) => Math.min(Math.hypot(c.pts[0].x - game.x, c.pts[0].y - game.y), Math.hypot(c.pts[c.pts.length - 1].x - game.x, c.pts[c.pts.length - 1].y - game.y));
      crease = open.sort((a, b) => d(a) - d(b))[0];
      const p0 = crease.pts[0];
      const p1 = crease.pts[crease.pts.length - 1];
      if (Math.hypot(p0.x - game.x, p0.y - game.y) <= Math.hypot(p1.x - game.x, p1.y - game.y)) {
        idx = 0;
        dir = 1;
      } else {
        idx = crease.pts.length - 1;
        dir = -1;
      }
    }
    let q = crease.pts[idx];
    if (Math.hypot(q.x - game.x, q.y - game.y) < 28) {
      if (idx + dir < 0 || idx + dir >= crease.pts.length) {
        dir = -dir;
        if (steam && game.tank >= 1) press = true;
      }
      idx += dir;
      q = crease.pts[idx];
    }
    const dx = q.x - game.x;
    const dy = q.y - game.y;
    const l = Math.hypot(dx, dy) || 1;
    return { x: (dx / l) * speed, y: (dy / l) * speed, action: press, kind };
  };
}

// Stays where it is and puffs steam whenever it can.
const camper = () => (game, t) => ({ action: Math.floor(t * 6) % 2 === 0 });
// Sweeps the whole board, row by row, puffing steam all the while.
const sweeper = () => {
  let row = 0;
  let d = 1;
  return (game, t) => {
    const rows = [430, 500, 570, 640, 710];
    const ty = rows[row];
    if ((d > 0 && game.x > 1370) || (d < 0 && game.x < 250)) {
      d = -d;
      row = (row + 1) % rows.length;
    }
    return { x: d, y: Math.max(-1, Math.min(1, (ty - game.y) / 40)), action: Math.floor(t * 4) % 2 === 0 };
  };
};

// Presses at random: the stick anywhere, steam now and then.
const masher = (seed) => {
  const rnd = makeRng(seed * 7 + 3);
  let x = 0;
  let y = 0;
  return () => {
    if (rnd() < 0.05) {
      x = rnd() * 2 - 1;
      y = rnd() * 2 - 1;
    }
    return { x, y, action: rnd() < 0.2 };
  };
};

const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const BOTS = {
  idle: () => () => ({}),
  mash: (s) => masher(s),
  camp: () => camper(),
  sweep: () => sweeper(),
  clumsy: () => presser({ speed: 0.3, rest: 1 }), // slow on the stick, looks away a third of the time, no steam
  medium: () => presser({ speed: 0.45 }), // the old beginner
  good: () => presser({ speed: 0.75, steam: true, kind: 'controller' }),
};
const TABLE = {};
for (const level of ['easier', 'normal', 'harder']) {
  TABLE[level] = {};
  for (const [name, b] of Object.entries(BOTS)) TABLE[level][name] = SEEDS.map((seed) => run(create, { seed, bot: b(seed), difficulty: level }).game.score);
}
const passRate = (a) => a.filter((s) => s >= pass).length / a.length;
console.log(`steampressersparrow pass ${pass}`);
for (const [level, row] of Object.entries(TABLE)) console.log(level, Object.entries(row).map(([n, a]) => `${n} ${Math.round(mean(a))} [${Math.min(...a)}-${Math.max(...a)}] ${Math.round(passRate(a) * 100)}%`).join(' · '));

test('steampressersparrow: at Normal a medium presser passes, a good one more; camping, sweeping, mashing and idling do not', () => {
  const t = TABLE.normal;
  assert.ok(passRate(t.medium) >= 0.75, `medium ${t.medium}`);
  assert.ok(mean(t.good) > mean(t.medium), `good ${t.good}`);
  assert.ok(passRate(t.clumsy) <= 0.5, `clumsy ${t.clumsy}`);
  for (const n of ['idle', 'mash', 'camp', 'sweep']) assert.ok(Math.max(...t[n]) < pass, `${n} ${t[n]}`);
});

// Points come from creases pressed, and pressing takes the same work at any
// level, so Easier (fewer creases, more time) lifts a clumsy presser less than
// it would in a game scored on accuracy. It still passes more often there.
test('steampressersparrow: Easier lets a clumsy presser pass more often than Normal; nobody passes without pressing', () => {
  const t = TABLE.easier;
  assert.ok(passRate(t.clumsy) >= 0.6, `clumsy ${t.clumsy}`);
  assert.ok(passRate(t.clumsy) > passRate(TABLE.normal.clumsy), `clumsy at Normal ${TABLE.normal.clumsy}`);
  for (const n of ['idle', 'mash', 'camp', 'sweep']) assert.ok(Math.max(...t[n]) < pass, `${n} ${t[n]}`);
});

test('steampressersparrow: Harder ends hard: the good presser scores clearly more than the medium one', () => {
  const t = TABLE.harder;
  assert.ok(mean(t.good) > mean(t.medium) * 1.25, `good ${mean(t.good)} vs medium ${mean(t.medium)}`);
  assert.ok(mean(t.clumsy) <= mean(TABLE.normal.clumsy), `clumsy ${mean(t.clumsy)} vs Normal ${mean(TABLE.normal.clumsy)}`);
});

// The knobs third by third at each level, read from the game as it plays.
test('steampressersparrow: the ramp, third by third', () => {
  for (const level of ['easier', 'normal', 'harder']) {
    const game = create(env(1, { difficulty: level }));
    const look = () => ({ n: game.creaseCount(), limit: game.timeLimit(), silk: game.silkChance() });
    const at = [look()];
    for (const s of [15, 15, 14.9]) {
      for (let i = 0; i < s * 60; i++) game.update(1 / 60, blank());
      at.push(look());
    }
    console.log('steampressersparrow ramp', level, at.map((a) => `${a.n.toFixed(1)} creases ${a.limit.toFixed(1)} s silk ${a.silk.toFixed(2)}`).join(' | '));
    for (let i = 1; i < at.length; i++) {
      assert.ok(at[i].n >= at[i - 1].n && at[i].limit <= at[i - 1].limit, `${level} gets harder`);
    }
    if (level === 'normal') {
      assert.ok(at[1].n < (at[0].n + at[3].n) / 2, 'the first third stays gentle');
      assert.ok(at[3].n > at[0].n + 3 && at[3].limit < at[0].limit - 4, 'the end is much harder than the start');
    }
  }
  assert.ok(create(env(1, { difficulty: 'easier' })).creaseCount() === 2, 'every level but Harder opens on the easy anchor');
  assert.ok(create(env(1, { difficulty: 'harder' })).creaseCount() > 3.5, 'Harder opens near medium');
});

test('steampressersparrow: running the iron along a crease presses it out', () => {
  const game = create(env(1));
  for (let i = 0; i < 30; i++) game.update(1 / 60, blank()); // let the garment slide in
  const c = game.open()[0];
  const before = game.score;
  for (let pass = 0; pass < 6 && !c.done; pass++) {
    for (const q of pass % 2 ? [...c.pts].reverse() : c.pts) {
      for (let i = 0; i < 6; i++) {
        game.update(1 / 60, blank({ pointer: { active: true, x: q.x, y: q.y } }));
      }
    }
  }
  assert.ok(c.done, 'crease pressed out');
  assert.ok(game.score > before);
});

test('steampressersparrow: lingering with steam scorches the cloth', () => {
  const game = create(env(1));
  for (let i = 0; i < 30; i++) game.update(1 / 60, blank());
  game.score = 10;
  for (let i = 0; i < 180 && !game.scorches; i++) game.update(1 / 60, blank({ action: i % 30 === 0, actionPressed: i % 30 === 0 }));
  assert.equal(game.scorches, 1);
  assert.equal(game.score, 9);
});

test('steampressersparrow: dry, it takes much longer to scorch; steam presses faster', () => {
  const dry = create(env(1));
  for (let i = 0; i < 30; i++) dry.update(1 / 60, blank());
  let t = 0;
  while (!dry.scorches && t < 10) {
    dry.update(1 / 60, blank());
    t += 1 / 60;
  }
  assert.ok(t > 2, `dry scorch after ${t.toFixed(2)} s`);
  // the same short stroke, dry and with steam
  const flat = (steam) => {
    const game = create(env(1));
    for (let i = 0; i < 30; i++) game.update(1 / 60, blank());
    const q = game.open()[0].pts[2];
    game.x = q.x;
    game.y = q.y;
    game.update(1 / 60, blank({ action: steam, actionPressed: steam }));
    for (let i = 0; i < 12; i++) game.update(1 / 60, blank());
    return q.flat;
  };
  assert.ok(flat(true) > flat(false) * 1.6, `${flat(true)} vs ${flat(false)}`);
});

test('steampressersparrow: the next garment comes when its time runs out, and later ones have more creases', () => {
  const game = create(env(1));
  const first = game.garment;
  const n0 = first.creases.length;
  for (let i = 0; i < 60 * 33; i++) game.update(1 / 60, blank());
  assert.notEqual(game.garment, first);
  assert.ok(game.count >= 3);
  assert.ok(game.garment.creases.length >= n0, `${game.garment.creases.length} >= ${n0}`);
});

test('steampressersparrow: the round starts gentle and ends hard: fewer, shorter-lived creases and no silk early, more creases and less time late', () => {
  const early = [];
  const late = [];
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    let seen = null;
    run(create, {
      seed,
      bot: (() => {
        const b = presser({ speed: 0.75, steam: true, kind: 'controller' });
        return (game, t) => {
          if (game.garment !== seen) {
            seen = game.garment;
            const p = seen.at / 45;
            if (p < 1 / 3) early.push(seen);
            else if (p > 2 / 3) late.push(seen);
          }
          return b(game, t);
        };
      })(),
    });
  }
  const avg = (a, f) => a.reduce((s, x) => s + f(x), 0) / a.length;
  const n0 = avg(early, (G) => G.creases.length);
  const n1 = avg(late, (G) => G.creases.length);
  const l0 = avg(early, (G) => G.limit / G.creases.length);
  const l1 = avg(late, (G) => G.limit / G.creases.length);
  assert.ok(early.length > 4 && late.length > 4);
  assert.ok(n1 > n0 + 1, `creases early ${n0.toFixed(2)}, late ${n1.toFixed(2)}`);
  assert.ok(l1 < l0 * 0.75, `seconds per crease early ${l0.toFixed(2)}, late ${l1.toFixed(2)}`);
  assert.ok(early.every((G) => !G.silk && G.w < 850 || G.kind === 'hanky'), 'early garments are small, no silk');
  assert.ok(late.some((G) => G.silk), 'silk comes late');
});

test('steampressersparrow: with a pointer, only a tap on the iron puffs steam', () => {
  const game = create(env(1));
  const ptr = (x, y, press) => blank({ kind: 'pointer', action: press, actionPressed: press, pointer: { active: true, x, y, down: press, pressed: press } });
  game.update(1 / 60, ptr(game.x + 500, game.y, true)); // a finger down far from the iron: it moves, no steam
  assert.equal(game.steam, 0);
  assert.equal(game.tank, 3);
  for (let i = 0; i < 10; i++) game.update(1 / 60, ptr(game.x, game.y, false));
  game.update(1 / 60, ptr(game.x, game.y - 40, true)); // a tap on the iron
  assert.ok(game.steam > 0);
});

test('steampressersparrow: with the keyboard a short tap only nudges the iron', () => {
  const game = create(env(1));
  const x0 = game.x;
  for (let i = 0; i < 6; i++) game.update(1 / 60, blank({ x: 1, kind: 'keyboard' }));
  for (let i = 0; i < 30; i++) game.update(1 / 60, blank({ kind: 'keyboard' }));
  const moved = game.x - x0;
  assert.ok(moved > 5 && moved < 90, `moved ${moved}`);
});

test('steampressersparrow: the pressing and scorched Sparrow are drawn at one scale (the handle within 4%)', async () => {
  const { readFileSync } = await import('node:fs');
  const M = JSON.parse(readFileSync(new URL('../../design/source/sprite-measures.json', import.meta.url))).steampressersparrow;
  // both sheets are drawn with the same PRESS_SCALE, so the iron's handle must measure the same in each cell
  const all = [...M.press, ...M.scorch];
  for (const v of all) assert.ok(Math.abs(v / all[0] - 1) <= 0.04, `${all}`);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import create from '../src/games/broomwhisk.js';
import entry from '../src/more/broomwhisk.js';
import { run, env, blank } from './harness.mjs';

const pass = entry.pass;
const R = 74;

// A sweeper: picks the leaf that is quickest to get into the pan, walks
// round behind it, and pushes it in a straight line to the pan's mouth,
// flicking it the last stretch when `flick` is on. `skill` 0..1 sets its
// speed and how carefully it lines up (below 0, slower and looser still).
function sweeper(skill = 1, { flick = true } = {}) {
  let target = null;
  let pushing = false;
  let press = false;
  const speed = 0.5 + 0.5 * skill;
  const toward = (b, x, y, k = 1) => {
    const dx = x - b.x;
    const dy = (y - b.y) * 2;
    const d = Math.hypot(dx, dy) || 1;
    const s = Math.min(1, d / 40) * k;
    return { x: (dx / d) * s, y: (dy / d) * s };
  };
  return (game) => {
    if (press) {
      press = false;
      return {};
    }
    const b = game.broom;
    const pan = game.pan;
    const mouth = { x: pan.x + pan.dx * 20, y: pan.y + (pan.dy * 20) / 2 };
    const live = game.items.filter((it) => it.z <= 0);
    if (!target || !game.items.includes(target) || target.z > 0) {
      pushing = false;
      target = live.sort((a, c) => cost(a) - cost(c))[0] || null;
    }
    function cost(it) {
      return Math.hypot(it.x - b.x, (it.y - b.y) * 2) + 1.4 * Math.hypot(it.x - mouth.x, (it.y - mouth.y) * 2);
    }
    if (!target) return toward(b, 800, 700, 0.5);
    const ux = mouth.x - target.x;
    const uy = (mouth.y - target.y) * 2;
    const ud = Math.hypot(ux, uy) || 1;
    const behind = {
      x: Math.max(80, Math.min(1520, target.x - (ux / ud) * (R + 34))),
      y: Math.max(482, Math.min(872, target.y - ((uy / ud) * (R + 34)) / 2)),
    };
    const bx = target.x - b.x;
    const by = (target.y - b.y) * 2;
    const bd = Math.hypot(bx, by) || 1;
    const aligned = (bx * ux + by * uy) / (bd * ud);
    if (pushing && (aligned < 0.9 - 0.06 * (1 - skill) || bd > R + 90)) pushing = false;
    if (!pushing) {
      // go round: aim for the point behind it, keeping clear of it on the way
      const d = Math.hypot(behind.x - b.x, (behind.y - b.y) * 2);
      if (d < 26) pushing = true;
      let m = toward(b, behind.x, behind.y, speed);
      if (bd < R + 60 && aligned < 0.5) {
        // too close and on the wrong side: step sideways first
        const sx = -by / bd;
        const sy = bx / bd;
        const sgn = sx * (behind.x - b.x) + sy * (behind.y - b.y) * 2 > 0 ? 1 : -1;
        m = { x: m.x * 0.3 + sx * sgn * speed, y: m.y * 0.3 + (sy * sgn * speed) };
      }
      return m;
    }
    const m = toward(b, mouth.x, mouth.y, speed * 0.85);
    // steer the leaf onto the line to the mouth
    const err = (bx * uy - by * ux) / ud / bd;
    m.x -= (-uy / ud) * err * 0.6;
    m.y -= (ux / ud) * err * 0.6;
    if (flick && ud < 260 && aligned > 0.95 && bd < R + 40 && game.flickCool <= 0) {
      press = true;
      return { ...m, action: true };
    }
    return m;
  };
}

// Running about at random and flicking all the time.
function flailer(seed = 1) {
  let r = seed * 7919;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  let dir = { x: 1, y: 0 };
  let until = 0;
  return (game, t) => {
    if (t > until) {
      dir = { x: rnd() * 2 - 1, y: rnd() * 2 - 1 };
      until = t + 0.5 + rnd();
    }
    return { ...dir, action: Math.floor(t * 4) % 2 === 0 };
  };
}
// Wandering in smooth loops, pushing whatever happens to be in the way.
const wander = (seed = 1) => (game, t) => ({ x: Math.sin(t * 0.9 + seed), y: Math.sin(t * 1.3 + seed * 2), action: Math.floor(t * 2 + seed) % 5 === 0 });
// Sweeping straight back and forth along the floor.
const zigzag = () => {
  let d = 1;
  return (game, t) => {
    if (game.broom.x > 1450) d = -1;
    if (game.broom.x < 150) d = 1;
    return { x: d, y: Math.sin(t * 0.7) };
  };
};

// Sweeping is physical, so single runs vary: a dozen of each.
const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const BOTS = {
  idle: () => () => ({}),
  flail: (seed) => flailer(seed),
  zigzag: () => zigzag(),
  wander: (seed) => wander(seed),
  clumsy: () => sweeper(-0.5, { flick: false }), // slow and loose in lining up
  medium: () => sweeper(0.3, { flick: false }), // the old beginner
  good: () => sweeper(1, { flick: false }),
  flicker: () => sweeper(1),
};
const TABLE = {};
for (const level of ['easier', 'normal', 'harder']) {
  TABLE[level] = {};
  for (const [name, bot] of Object.entries(BOTS)) TABLE[level][name] = SEEDS.map((seed) => run(create, { seed, bot: bot(seed), difficulty: level }).game.score);
}
const passRate = (a) => a.filter((s) => s >= pass).length / a.length;
const MASH = ['idle', 'flail', 'zigzag', 'wander'];
console.log(`broomwhisk pass ${pass}`);
for (const [level, row] of Object.entries(TABLE)) console.log(level, Object.entries(row).map(([n, a]) => `${n} ${Math.round(mean(a))} [${Math.min(...a)}-${Math.max(...a)}] ${Math.round(passRate(a) * 100)}%`).join(' · '));

test('broomwhisk: at Normal a medium sweeper passes, a good one more; flailing and idling do not', () => {
  const t = TABLE.normal;
  assert.ok(passRate(t.medium) >= 0.75, `medium ${t.medium}`);
  assert.ok(mean(t.good) > mean(t.medium) + 2, `good ${t.good}`);
  assert.ok(passRate(t.flicker) >= 0.75, `flicking ${t.flicker}`);
  assert.ok(passRate(t.clumsy) < 0.5, `clumsy ${t.clumsy}`);
  for (const n of MASH) assert.ok(Math.max(...t[n]) < pass, `${n} ${t[n]}`);
  assert.equal(run(create, { seed: 1 }).game.score, 0);
});

// What a slow sweeper lacks is speed about the floor, and no level changes
// that: gusts leave swept things alone and the funnel forgives near misses,
// so Easier's softer gusts and wider pan help it hardly at all, and its
// fewer leaves lower everyone's ceiling. Easier is no harder for it than
// Normal, and the medium sweeper passes there as surely.
test('broomwhisk: Easier is no harder than Normal for a clumsy or medium sweeper; flailing and idling still fail', () => {
  const t = TABLE.easier;
  assert.ok(passRate(t.clumsy) >= passRate(TABLE.normal.clumsy), `clumsy ${t.clumsy} vs Normal ${TABLE.normal.clumsy}`);
  assert.ok(passRate(t.medium) >= 0.75, `medium ${t.medium}`);
  for (const n of MASH) assert.ok(Math.max(...t[n]) < pass, `${n} ${t[n]}`);
});

test('broomwhisk: Harder ends hard: the good sweeper scores clearly more than the medium one', () => {
  const t = TABLE.harder;
  assert.ok(mean(t.good) > mean(t.medium) * 1.15, `good ${mean(t.good)} vs medium ${mean(t.medium)}`);
  assert.ok(mean(t.flicker) > mean(t.medium) * 1.3, `flicker ${mean(t.flicker)} vs medium ${mean(t.medium)}`);
  assert.ok(mean(t.clumsy) <= mean(TABLE.normal.clumsy), `clumsy ${mean(t.clumsy)} vs Normal ${mean(TABLE.normal.clumsy)}`);
});

// The round starts gentle and ends harder, read from what the game does:
// the gusts that come late blow harder, with less warning and more often,
// leaves fall faster, and the pan's mouth is narrower than at the start.
test('broomwhisk: the courtyard starts gentle and ends harder', () => {
  const game = create(env(2));
  const gusts = [];
  let last = null;
  const falls = { early: 0, late: 0 };
  const seen = new Set(game.items);
  const mouth0 = game.mouth();
  const knobs = () => ({ leaf: game.leafGap(), gust: game.gustGap(), power: game.gustPower(), warn: game.gustWarn(), mouth: game.mouth() });
  const looks = [knobs()];
  for (let i = 0; i < 45 * 60 && !game.done; i++) {
    if (i === 15 * 60 || i === 30 * 60 || i === 45 * 60 - 1) looks.push(knobs());
    game.items = game.items.filter((it) => it.z > 0); // keep the floor clear so leaves keep falling
    game.update(1 / 60, blank());
    if (game.gust && game.gust !== last) gusts.push({ at: game.elapsed, power: game.gust.power, warn: game.gust.warn });
    last = game.gust;
    for (const it of game.items) {
      if (seen.has(it)) continue;
      seen.add(it);
      if (game.elapsed < 15) falls.early++;
      else if (game.elapsed > 30) falls.late++;
    }
  }
  console.log('broomwhisk ramp', { gusts, falls, mouth: [mouth0, game.mouth()] });
  assert.ok(gusts.length >= 3, `gusts ${gusts.length}`);
  assert.ok(gusts[0].at > 12, 'no gust in the first twelve seconds');
  const a = gusts[0];
  const z = gusts[gusts.length - 1];
  assert.ok(z.power > a.power * 1.3 && z.warn < a.warn, 'late gusts blow harder, with less warning');
  assert.ok(gusts[gusts.length - 1].at - gusts[gusts.length - 2].at < gusts[1].at - gusts[0].at, 'and come more often');
  assert.ok(falls.late > falls.early, `leaves fall faster late: ${falls.early} vs ${falls.late}`);
  assert.ok(game.mouth() < mouth0, 'the pan mouth narrows');
  console.log('broomwhisk knobs by thirds', looks);
  for (let i = 1; i < looks.length; i++) {
    const [x, y] = [looks[i - 1], looks[i]];
    assert.ok(x.leaf > y.leaf && x.gust > y.gust && x.power < y.power && x.warn > y.warn && x.mouth > y.mouth, `third ${i} is harder than the one before`);
  }
  assert.ok(looks[0].leaf - looks[1].leaf < (looks[0].leaf - looks[3].leaf) / 3, 'the first third stays on the gentle side');
});

test('broomwhisk: the broom pushes a leaf on with its own speed, and it slides on', () => {
  const game = create(env(1));
  game.items = [];
  game.items.push({ kind: 'leaf', x: 900, y: 760, z: 0, vx: 0, vy: 0, vz: 0, rot: 0, spin: 0, col: '#999', swept: 0, ph: 0 });
  game.broom.x = 700;
  game.broom.y = 760;
  game.gustT = 99;
  for (let i = 0; i < 40; i++) game.update(1 / 60, blank({ x: 1 }));
  const leaf = game.items[0];
  assert.ok(leaf.vx > 300, `pushed: ${leaf.vx}`);
  assert.ok(leaf.swept > 0);
  const x = leaf.x;
  for (let i = 0; i < 30; i++) game.update(1 / 60, blank());
  assert.ok(leaf.x > x + 40, 'it slides on after the broom stops');
  assert.ok(Math.abs(leaf.vx) < 300, 'and slows down');
});

test('broomwhisk: only swept things go in the pan; others bump off', () => {
  const game = create(env(1));
  game.gustT = 99;
  game.leafT = 99;
  game.items = [];
  const p = game.pan; // the left wall, facing right
  game.broom.x = 1300;
  game.items.push({ kind: 'leaf', x: p.x + 20, y: p.y, z: 0, vx: -50, vy: 0, vz: 0, rot: 0, spin: 0, col: '#999', swept: 0, ph: 0 });
  game.items.push({ kind: 'gold', x: p.x + 20, y: p.y + 10, z: 0, vx: -50, vy: 0, vz: 0, rot: 0, spin: 0, col: '#999', swept: 2, ph: 0 });
  game.update(1 / 60, blank());
  assert.equal(game.score, 3, 'the swept golden leaf counts three');
  assert.equal(game.items.length, 1);
  assert.equal(game.bumps, 1);
  assert.ok(game.items[0].vx > 0, 'the unswept leaf bumps off');
});

test('broomwhisk: a flick sends what is in front of the broom skidding', () => {
  const game = create(env(1));
  game.gustT = 99;
  game.items = [];
  game.items.push({ kind: 'leaf', x: 700 - R - 60, y: 760, z: 0, vx: 0, vy: 0, vz: 0, rot: 0, spin: 0, col: '#999', swept: 0, ph: 0 });
  game.items.push({ kind: 'leaf', x: 700 + R + 60, y: 760, z: 0, vx: 0, vy: 0, vz: 0, rot: 0, spin: 0, col: '#999', swept: 0, ph: 0 });
  game.broom.x = 700;
  game.broom.y = 760; // facing left
  game.update(1 / 60, blank({ action: true, actionPressed: true }));
  assert.ok(game.items[0].vx < -300, 'the one in front flies');
  assert.equal(game.items[1].vx, 0, 'the one behind does not');
});

test('broomwhisk: a gust blows the loose leaves, and the pan moves after eight', () => {
  const game = create(env(5));
  game.elapsed = 36; // a gust four fifths of the way in, at about medium strength
  game.leafT = 99;
  game.gustT = 0.01;
  const before = game.items.map((it) => it.x);
  for (let i = 0; i < 60 * 3; i++) game.update(1 / 60, blank());
  assert.equal(game.gusts, 1);
  const moved = game.items.filter((it, i) => Math.abs(it.x - before[i]) > 60).length;
  assert.ok(moved >= game.items.length - 1, `moved ${moved} of ${game.items.length}`);
  const g2 = create(env(1));
  g2.gustT = 99;
  const p0 = { ...g2.pan };
  for (let i = 0; i < 8; i++) g2.items.push({ kind: 'leaf', x: p0.x + 10, y: p0.y, z: 0, vx: 0, vy: 0, vz: 0, rot: 0, spin: 0, col: '#999', swept: 2, ph: 0 });
  g2.update(1 / 60, blank());
  for (let i = 0; i < 60; i++) g2.update(1 / 60, blank());
  assert.ok(g2.pan.x !== p0.x || g2.pan.y !== p0.y, 'the pan moved');
});

test('broomwhisk: the funnel draws a swept near miss in; gusts leave swept things alone', () => {
  const game = create(env(1));
  game.gustT = 99;
  game.leafT = 99;
  game.items = [];
  const p = game.pan; // the left wall, facing right
  game.broom.x = 1300;
  // a near miss: just past the mouth's side, sliding slowly
  game.items.push({ kind: 'leaf', x: p.x + 80, y: p.y + 58, z: 0, vx: -60, vy: 0, vz: 0, rot: 0, spin: 0, col: '#999', swept: 3, ph: 0 });
  for (let i = 0; i < 90 && game.items.length; i++) game.update(1 / 60, blank());
  assert.equal(game.score, 1, 'it slid in');
  const g2 = create(env(2));
  g2.leafT = 99;
  g2.items = [];
  g2.items.push({ kind: 'leaf', x: 800, y: 700, z: 0, vx: 0, vy: 0, vz: 0, rot: 0, spin: 0, col: '#999', swept: 3, ph: 0 });
  g2.items.push({ kind: 'leaf', x: 800, y: 820, z: 0, vx: 0, vy: 0, vz: 0, rot: 0, spin: 0, col: '#999', swept: 0, ph: 0 });
  g2.broom.x = 200;
  g2.broom.y = 520;
  g2.gust = { dir: 1, warn: 0, t: 1, ty: 0 };
  for (let i = 0; i < 30; i++) g2.update(1 / 60, blank());
  assert.ok(Math.abs(g2.items[0].x - 800) < 5, 'the swept leaf stays');
  assert.ok(g2.items[1].x > 830, 'the loose leaf blows');
});

// The Broomwhisk is one size whatever it does: standing (its portrait),
// flicking, braced against a gust, sweeping across, pushing into the picture
// and pleased, measured against how big each picture is painted
// (design/source/pose-scales.json).
test('broomwhisk: every painted pose shows the Broomwhisk the same size', async () => {
  const { withArt, shownSizes, sizeCheck } = await import('./sprite-rig.mjs');
  await import('../src/subjects.js');
  const undo = withArt();
  try {
    const game = create(env(1));
    const at = (o, b = {}) => (gm) => {
      Object.assign(gm, { flickT: 0, proudT: 0, gust: null }, o);
      Object.assign(gm.broom, { vx: 0, vy: 0, x: 800, y: 700 }, b);
    };
    const sizes = shownSizes(game, 'broomwhisk', {
      standing: at({}),
      flicking: at({ flickT: 0.2 }),
      braced: at({ gust: { dir: 1, warn: 0, t: 1, ty: 0 } }),
      sweeping: at({}, { vx: 300 }),
      pushing: at({}, { vy: 200 }),
      pleased: at({ proudT: 0.5 }),
    }, ['subject.broomwhisk', 'sprites.broomwhiskSweep', 'sprites.broomwhiskPoses']);
    const { fails, table } = sizeCheck(sizes, 'standing');
    console.log('broomwhisk pose sizes', table);
    assert.equal(Object.keys(table).length, 6, 'each pose drew one picture');
    assert.deepEqual(fails, []);
  } finally {
    undo();
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import create from '../src/games/sawbird.js';
import entry from '../src/more/sawbird.js';
import { run, env, blank } from './harness.mjs';

const pass = entry.pass;

// A sawyer: strokes back and forth to `reach` (with the stick, or on a
// controller by holding A to push and letting go to pull), pausing a little
// at each end, and steers the cut back to the line and round the knots ahead.
// `skill` shortens its strokes, adds pauses, makes it see knots later, slow to
// notice the cut wandering, and shakes its hand.
function sawyer(skill = 1, seed = 1, pump = false) {
  let r = seed * 7919;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  let side = -1;
  let wait = 0;
  let shake = 0;
  return (game) => {
    const reach = 0.75 + 0.25 * skill;
    if (wait > 0) wait -= 1 / 60;
    else if (Math.abs(game.s - side * (pump ? 0.97 : reach)) < 0.08) {
      side = -side;
      wait = (1 - skill) * 0.25 * rnd();
    }
    const p = game.plank;
    // Where the cut should be: on the line, or beside a knot coming up.
    let want = 0;
    const look = 40 + 60 * skill;
    const k = p.knots.find((k) => k.x < p.cutX + k.rx && k.x > p.cutX - look - k.rx);
    if (k) {
      const up = p.drift < k.dy;
      want = k.dy + (up ? -1 : 1) * (k.ry + 12);
    }
    if (rnd() < 0.05) shake = (rnd() - 0.5) * 2 * (1 - skill) * 0.8;
    const lead = 18 + 30 * (1 - skill);
    const steer = Math.max(-1, Math.min(1, ((want - p.drift) / lead - p.grain * skill) / 0.38)) + shake;
    const stroke = wait > 0 ? (pump ? game.s : game.s) : side;
    if (pump) return { kind: 'controller', action: wait > 0 ? game.s < 0 : side < 0, y: steer };
    return { x: wait > 0 ? game.s : side * reach, y: steer + 0 * stroke };
  };
}

// Pushes the stick hard left and right as fast as it can, never steering.
const jiggle = (period) => (game, t) => ({ x: Math.floor(t / period) % 2 ? 1 : -1 });

// A sawyer below 1 sees knots later and is slower to notice the cut
// wandering, which costs more as the grain pulls harder and knots crowd in.
const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const BOTS = {
  idle: () => () => ({}),
  jiggle: () => jiggle(0.08),
  unsteered: () => jiggle(0.45),
  mashA: () => (game, t) => ({ kind: 'controller', action: Math.floor(t * 20) % 2 === 0 }),
  clumsy: (seed) => sawyer(-0.1, seed), // shorter strokes, longer pauses, sees knots late, a shakier hand
  medium: (seed) => sawyer(0.3, seed), // the old beginner
  holdA: (seed) => sawyer(0.3, seed, true), // the old beginner, holding A to push
  good: (seed) => sawyer(1, seed),
};
const TABLE = {};
for (const level of ['easier', 'normal', 'harder']) {
  TABLE[level] = {};
  for (const [name, b] of Object.entries(BOTS)) TABLE[level][name] = SEEDS.map((seed) => run(create, { seed, bot: b(seed), difficulty: level }).game.score);
}
const passRate = (a) => a.filter((s) => s >= pass).length / a.length;
console.log(`sawbird pass ${pass}`);
for (const [level, row] of Object.entries(TABLE)) console.log(level, Object.entries(row).map(([n, a]) => `${n} ${Math.round(mean(a))} [${Math.min(...a)}-${Math.max(...a)}] ${Math.round(passRate(a) * 100)}%`).join(' · '));

test('sawbird: at Normal a medium sawyer passes (stick or holding A), a good one more; jiggling, unsteered strokes, mashing and idling do not', () => {
  const t = TABLE.normal;
  assert.ok(passRate(t.medium) >= 0.75, `medium ${t.medium}`);
  assert.ok(passRate(t.holdA) >= 0.75, `holding A ${t.holdA}`);
  assert.ok(mean(t.good) > mean(t.medium), `good ${t.good}`);
  assert.ok(passRate(t.clumsy) <= 0.5, `clumsy ${t.clumsy}`);
  for (const n of ['idle', 'jiggle', 'unsteered', 'mashA']) assert.ok(Math.max(...t[n]) < pass, `${n} ${t[n]}`);
});

test('sawbird: Easier lets a clumsy sawyer pass; jiggling, unsteered strokes, mashing and idling still fail', () => {
  const t = TABLE.easier;
  assert.ok(passRate(t.clumsy) >= 0.75, `clumsy ${t.clumsy}`);
  assert.ok(passRate(t.clumsy) > passRate(TABLE.normal.clumsy), `clumsy at Normal ${TABLE.normal.clumsy}`);
  for (const n of ['idle', 'jiggle', 'unsteered', 'mashA']) assert.ok(Math.max(...t[n]) < pass, `${n} ${t[n]}`);
});

test('sawbird: Harder ends hard: the good sawyer scores clearly more than the medium one', () => {
  const t = TABLE.harder;
  assert.ok(mean(t.good) > mean(t.medium) + 5, `good ${mean(t.good)} vs medium ${mean(t.medium)}`);
  assert.ok(mean(t.clumsy) < mean(TABLE.normal.clumsy), `clumsy ${mean(t.clumsy)} vs Normal ${mean(TABLE.normal.clumsy)}`);
});

test('sawbird: the knobs at each level: Easier stays gentle, Harder opens near medium', () => {
  const rows = {};
  for (const level of ['easier', 'normal', 'harder']) {
    const game = create(env(1, { difficulty: level }));
    const look = () => ({ len: game.plankLen(), grain: game.grainPull(), knots: game.knotCount() });
    const row = [look()];
    for (let i = 0; i < 3; i++) {
      for (let f = 0; f < (50 / 3) * 60 - (i === 2 ? 1 : 0); f++) game.update(1 / 60, blank());
      row.push(look());
    }
    console.log('sawbird ramp', level, row.map((k) => `${k.len.toFixed(0)} px grain ${k.grain.toFixed(3)} knots ${k.knots.toFixed(1)}`).join(' | '));
    for (let i = 1; i < row.length; i++) assert.ok(row[i].len >= row[i - 1].len && row[i].grain >= row[i - 1].grain && row[i].knots >= row[i - 1].knots, `${level} gets harder`);
    rows[level] = row;
  }
  const n = rows.normal;
  assert.ok(n[1].len < (n[0].len + n[3].len) / 2, 'the first third stays gentle');
  assert.ok(rows.easier[3].knots < 1.6 && rows.easier[3].len < 760, 'Easier stays gentle');
  assert.ok(rows.harder[0].len > 760 && rows.harder[3].knots > 3.2, 'Harder opens near medium and ends hard');
});

test('sawbird: the first planks are short and plain, the last long, knotty and pulling hard', () => {
  const early = [];
  const late = [];
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    let seen = null;
    const bot = sawyer(1, seed);
    run(create, {
      seed,
      bot: (game, t) => {
        if (game.plank !== seen) {
          seen = game.plank;
          const p = game.elapsed / 50;
          if (p < 1 / 3) early.push(seen);
          else if (p > 2 / 3) late.push(seen);
        }
        return bot(game, t);
      },
    });
  }
  const mean = (a, f) => a.reduce((s, x) => s + f(x), 0) / a.length;
  const len = (P) => P.right - P.left;
  assert.ok(early.length >= 6 && late.length >= 6, `${early.length} early, ${late.length} late`);
  assert.ok(mean(late, len) > mean(early, len) * 1.2, `length early ${mean(early, len).toFixed(0)}, late ${mean(late, len).toFixed(0)}`);
  assert.ok(mean(late, (P) => Math.abs(P.grain)) > mean(early, (P) => Math.abs(P.grain)) * 1.6, 'the grain pulls harder late');
  assert.ok(Math.max(...early.map((P) => P.knots.length)) <= 2, `early knots ${early.map((P) => P.knots.length)}`);
  assert.ok(mean(late, (P) => P.knots.length) >= mean(early, (P) => P.knots.length) + 1.2, `knots early ${mean(early, (P) => P.knots.length).toFixed(2)}, late ${mean(late, (P) => P.knots.length).toFixed(2)}`);
});

test('sawbird: short strokes barely cut, long strokes do', () => {
  const short = create(env(1));
  for (let i = 0; i < 300; i++) short.update(1 / 60, blank({ x: Math.floor(i / 4) % 2 ? 0.3 : -0.3 }));
  const long = create(env(1));
  for (let i = 0; i < 300; i++) long.update(1 / 60, blank({ x: Math.floor(i / 30) % 2 ? 1 : -1 }));
  const cut = (g) => g.plank.right - g.plank.cutX;
  assert.ok(cut(short) < 15, `short ${cut(short)}`);
  assert.ok(cut(long) > 150, `long ${cut(long)}`);
});

test('sawbird: tipping the saw steers the cut', () => {
  const game = create(env(1));
  game.plank.grain = 0;
  for (let i = 0; i < 240; i++) game.update(1 / 60, blank({ x: Math.floor(i / 30) % 2 ? 1 : -1, y: 1 }));
  assert.ok(game.plank.drift > 20, `drift ${game.plank.drift}`);
});

test('sawbird: a straight cut through scores 10, a crooked one less', () => {
  const game = create(env(1));
  const p = game.plank;
  p.grain = 0;
  p.knots = [];
  p.cutX = p.left + 2;
  game.strokeLen = 1;
  game.dir = -1;
  game.update(1 / 60, blank({ x: -1 }));
  assert.equal(game.score, 10);
  assert.equal(game.planks, 1);
  const g2 = create(env(1));
  g2.plank.path = [[g2.plank.right, g2.plank.lineY + 40], [g2.plank.left + 4, g2.plank.lineY + 40]];
  g2.plank.cutX = g2.plank.left + 2;
  g2.strokeLen = 1;
  g2.dir = -1;
  g2.update(1 / 60, blank({ x: -1 }));
  assert.equal(g2.score, 1);
});

// The Saw Bird is one size whatever it does: sawing, snagged on a knot and
// standing proud after a cut, measured against how big each picture is
// painted (design/source/pose-scales.json).
test('sawbird: every painted pose shows the Saw Bird the same size', async () => {
  const { withArt, shownSizes, sizeCheck } = await import('./sprite-rig.mjs');
  await import('../src/subjects.js');
  const undo = withArt();
  try {
    const game = create(env(1));
    game.plank.slide = 0;
    const at = (o) => (gm) => Object.assign(gm, { snag: 0, proud: 0 }, o);
    const sizes = shownSizes(game, 'sawbird', {
      sawing: at({}),
      snagged: at({ snag: 0.3 }),
      proud: at({ proud: Math.PI / 6 }),
    }, ['sprites.sawbirdSawing', 'sprites.sawbirdPoses']);
    const { fails, table } = sizeCheck(sizes, 'sawing');
    console.log('sawbird pose sizes', table);
    assert.equal(Object.keys(table).length, 3, 'each pose drew one picture');
    assert.deepEqual(fails, []);
  } finally {
    undo();
  }
});

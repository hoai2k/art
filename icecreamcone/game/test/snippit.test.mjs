import test from 'node:test';
import assert from 'node:assert/strict';
import create from '../src/games/snippit.js';
import entry from '../src/more/snippit.js';
import { run, env, blank } from './harness.mjs';

const pass = entry.pass;

// A snipper: looks at the tag for a moment (longer with a bigger tangle),
// traces the string (getting it wrong now and then), walks to its knot and
// snips. `skill` 0..1 sets how quick and how sure it is. With `pace` it
// loses the string more often the bigger and curlier the tangle (a clumsy
// player).
function snipper(skill = 1, seed = 1, pace = false) {
  let r = seed * 7919;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  let want = null;
  let target = null;
  let wait = 0;
  let pressed = false;
  return (game, t) => {
    if (game.want !== want) {
      want = game.want;
      const n = game.balloons.length;
      wait = t + (1 - skill) * (0.9 + 0.35 * n) + 0.35 + 0.1 * n;
      target = null;
    }
    if (!want || t < wait) return {};
    if (!target || !game.balloons.includes(target)) {
      const sure = pace ? 1 - 0.06 * (game.balloons.length - 2) - game.curl() / 800 : 0.82 + 0.18 * skill;
      const right = rnd() < sure;
      const others = game.balloons.filter((b) => b !== want);
      target = right || !others.length ? want : others[Math.floor(rnd() * others.length)];
    }
    // Face the knot (turning around rather than walking past it), walk until
    // the tip is near it, and snip.
    const f = target.px >= game.x ? 1 : -1;
    const sp = 0.5 + 0.5 * skill;
    if (game.face !== f) return { x: f }; // a full push the other way turns it
    const d = target.px - game.cutX();
    if (Math.abs(d) < 14 || (d * f < 0 && game.under() === target)) {
      if (game.jam <= 0 && !pressed) {
        pressed = true;
        return { action: true };
      }
      pressed = false;
      return {};
    }
    pressed = false;
    // beyond the tip: walk on; between the blades but not reachable: walk past
    return { x: (d * f > 0 ? Math.max(-1, Math.min(1, d / 60)) : f * 0.5) * sp };
  };
}

// Running up and down the fence snipping all the time.
const masher = () => {
  let d = 1;
  return (game, t) => {
    if (game.x > 1300) d = -1;
    if (game.x < 300) d = 1;
    return { x: d, action: Math.floor(t * 4) % 2 === 0 };
  };
};
// Standing in one place snipping whatever is there.
const camper = () => (game, t) => ({ action: Math.floor(t * 3) % 2 === 0 });

const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const BOTS = {
  idle: () => () => ({}),
  mash: () => masher(),
  camp: () => camper(),
  clumsy: (seed) => snipper(0.15, seed, true),
  medium: (seed) => snipper(0.3, seed), // the old beginner
  good: (seed) => snipper(1, seed),
};
const TABLE = {};
for (const level of ['easier', 'normal', 'harder']) {
  TABLE[level] = {};
  for (const [name, bot] of Object.entries(BOTS)) TABLE[level][name] = SEEDS.map((seed) => run(create, { seed, bot: bot(seed), difficulty: level }).game.score);
}
const passRate = (a) => a.filter((s) => s >= pass).length / a.length;
console.log(`snippit pass ${pass}`);
for (const [level, row] of Object.entries(TABLE)) console.log(level, Object.entries(row).map(([n, a]) => `${n} ${Math.round(mean(a))} [${Math.min(...a)}-${Math.max(...a)}] ${Math.round(passRate(a) * 100)}%`).join(' · '));

test('snippit: at Normal a medium snipper passes, a good one more; mashing and idling do not', () => {
  const t = TABLE.normal;
  assert.ok(passRate(t.medium) >= 0.75, `medium ${t.medium}`);
  assert.ok(mean(t.good) > mean(t.medium) * 1.2, `good ${t.good}`);
  assert.ok(passRate(t.clumsy) < 0.5, `clumsy ${t.clumsy}`);
  for (const n of ['idle', 'mash', 'camp']) assert.ok(Math.max(...t[n]) < pass, `${n} ${t[n]}`);
  assert.equal(run(create, { seed: 1 }).game.score, 0);
});

// Snips come one at a time whatever the level, so a clumsy snipper's score
// swings with every wrong string: Easier lets it pass most of the time, and
// far more often than Normal.
test('snippit: Easier lets a clumsy snipper pass more often than Normal; mashing and idling still do not', () => {
  const t = TABLE.easier;
  assert.ok(passRate(t.clumsy) >= 0.6, `clumsy ${t.clumsy}`);
  assert.ok(passRate(t.medium) >= 0.75, `medium ${t.medium}`);
  assert.ok(passRate(t.clumsy) > passRate(TABLE.normal.clumsy), `clumsy at Normal ${TABLE.normal.clumsy}`);
  for (const n of ['idle', 'mash', 'camp']) assert.ok(Math.max(...t[n]) < pass, `${n} ${t[n]}`);
});

test('snippit: Harder ends hard: the good snipper scores clearly more than the medium one', () => {
  const t = TABLE.harder;
  assert.ok(mean(t.good) > mean(t.medium) * 1.3, `good ${mean(t.good)} vs medium ${mean(t.medium)}`);
  assert.ok(mean(t.clumsy) < mean(TABLE.normal.clumsy), `clumsy ${mean(t.clumsy)} vs Normal ${mean(TABLE.normal.clumsy)}`);
});

// The round starts gentle and ends harder, read from the bunch itself: a
// small bunch on gently curled strings and no wind at first; a bigger bunch,
// curlier strings and the wind swapping balloons more and more often late on.
test('snippit: the bunch starts gentle and ends harder', () => {
  const game = create(env(3));
  const at = {};
  const swapTimes = [];
  let swaps = 0;
  for (let i = 0; i < 45 * 60 && !game.done; i++) {
    game.update(1 / 60, blank());
    if (game.swaps > swaps) swapTimes.push(game.elapsed);
    swaps = game.swaps;
    for (const s of [5, 15, 25, 30, 44]) if (!at[s] && game.elapsed >= s) at[s] = { n: game.balloons.length + game.pending, curl: game.curl() };
  }
  console.log('snippit ramp', at, swapTimes.map((t) => +t.toFixed(1)));
  assert.equal(at[5].n, 3, 'three balloons at first');
  assert.ok(at[44].n >= at[25].n && at[25].n > at[15].n && at[15].n > at[5].n, 'the bunch grows');
  assert.ok(at[44].curl > at[30].curl && at[30].curl > at[15].curl && at[15].curl > at[5].curl, 'the strings curl more, third by third');
  assert.ok(at[15].curl - at[5].curl < (at[44].curl - at[5].curl) / 3, 'the first third stays on the gentle side');
  assert.ok(swapTimes[0] > 20, 'no wind in the first half');
  const gaps = swapTimes.slice(1).map((t, i) => t - swapTimes[i]);
  assert.ok(gaps.length >= 2 && gaps[gaps.length - 1] < gaps[0], `the wind jostles more often: ${gaps}`);
  // Easier never brings the wind; Harder brings it from the start.
  const easy = create(env(3, { difficulty: 'easier' }));
  for (let i = 0; i < 45 * 60 && !easy.done; i++) easy.update(1 / 60, blank());
  assert.equal(easy.swaps, 0);
  assert.equal(create(env(3, { difficulty: 'harder' })).swapGap(), 5);
});

test('snippit: snipping the asked-for string scores and lets it go', () => {
  const game = create(env(2));
  game.update(1 / 60, blank());
  const want = game.want;
  game.x = want.px + game.tip;
  game.update(1 / 60, blank({ action: true, actionPressed: true }));
  assert.equal(game.right, 1);
  assert.equal(game.score, 15, 'right and quick');
  assert.ok(!game.balloons.includes(want));
  assert.equal(game.loose.length, 1);
  assert.notEqual(game.want, want, 'a new balloon is asked for');
});

test('snippit: a wrong string costs points and jams the blades', () => {
  const game = create(env(3));
  game.update(1 / 60, blank());
  game.score = 30;
  const other = game.balloons.find((b) => b !== game.want);
  const want = game.want;
  game.x = other.px + game.tip;
  game.update(1 / 60, blank({ action: true, actionPressed: true }));
  assert.equal(game.wrong, 1);
  assert.equal(game.score, 25);
  assert.ok(game.jam > 0);
  assert.equal(game.want, want, 'the same one is still wanted');
  // jammed: a second snip does nothing
  game.x = want.px + game.tip;
  game.update(1 / 60, blank({ action: true, actionPressed: true }));
  assert.equal(game.right, 0);
});

test('snippit: the tangle is never straight at the start, and grows over time', () => {
  for (let seed = 1; seed < 20; seed++) {
    const game = create(env(seed));
    const byKnot = [...game.balloons].sort((a, b) => a.px - b.px);
    const bySky = [...game.balloons].sort((a, b) => a.bx - b.bx);
    assert.ok(byKnot.some((b, i) => bySky[i] !== b), `seed ${seed}: some strings cross`);
  }
  const game = create(env(1, { difficulty: 'harder' }));
  for (let i = 0; i < 60 * 42; i++) game.update(1 / 60, blank());
  assert.equal(game.balloons.length, 6);
  assert.equal(new Set(game.balloons.map((b) => b.color)).size, 6, 'every colour once');
});

test('snippit: a snip away from every knot does nothing', () => {
  const game = create(env(4));
  game.update(1 / 60, blank());
  game.x = 250; // left of every knot (the first is at 400)
  game.update(1 / 60, blank({ action: true, actionPressed: true }));
  assert.equal(game.right + game.wrong, 0);
});

test('snippit: the blades cut toward the tip, and the knot nearest the tip is the one cut', () => {
  const game = create(env(3));
  for (let i = 0; i < 60; i++) game.update(1 / 60, blank());
  const knots = [...game.balloons].sort((a, b) => a.px - b.px);
  const [a, b2] = knots;
  // the tip just past the first knot catches it, though the hinge is far off
  // (the blades run left from the hinge to the tip)
  assert.equal(game.under(a.px + game.tip + 20), a, 'just beyond the tip');
  assert.equal(game.under(a.px + game.tip - 60), a, 'further back along the blades');
  assert.equal(game.under(a.px - 10), null, 'behind the hinge');
  assert.equal(game.under(a.px + game.tip + 60), null, 'well beyond the tip');
  // with two knots between the blades, the one nearer the tip is cut
  a.px = 600;
  b2.px = 650;
  const at = (x) => game.under(x + game.tip);
  assert.equal(at(610), a, 'the left knot is nearer the tip');
  assert.equal(at(640), b2, 'the right knot is nearer the tip');
  assert.equal(at(560), a, 'only the left one is reached, beyond the tip');
});

test('snippit: facing right, the blades cut to the right of the eye', () => {
  const game = create(env(3));
  for (let i = 0; i < 60; i++) game.update(1 / 60, blank());
  assert.equal(game.face, -1, 'it starts facing left, as painted');
  const a = [...game.balloons].sort((p, q) => p.px - q.px)[0];
  // the bird stands just left of the knot: facing left it can't reach it
  game.x = a.px - 60;
  game.vx = 0;
  assert.equal(game.under(), null, 'behind its back while it faces left');
  game.update(1 / 60, blank({ x: 1 }));
  assert.equal(game.face, 1, 'pushing right turns it right');
  assert.equal(game.cutX(), game.x + game.tip, 'the tip is right of the eye');
  assert.equal(game.under(), a, 'the knot just right of it is between the blades');
  game.vx = 0;
  game.x = a.px - 60;
  game.update(1 / 60, blank({ action: true, actionPressed: true }));
  assert.equal(game.right + game.wrong, 1, 'and is cut');
  assert.ok(!game.balloons.includes(a));
});

test('snippit: facing right mirrors the reach and the nearest-the-tip rule', () => {
  const game = create(env(3));
  for (let i = 0; i < 60; i++) game.update(1 / 60, blank());
  const [a, b2] = [...game.balloons].sort((p, q) => p.px - q.px);
  const R = 1;
  assert.equal(game.under(a.px - game.tip - 20, R), a, 'just beyond the tip');
  assert.equal(game.under(a.px - game.tip + 60, R), a, 'further back along the blades');
  assert.equal(game.under(a.px + 10, R), null, 'behind the hinge');
  assert.equal(game.under(a.px - game.tip - 60, R), null, 'well beyond the tip');
  a.px = 600;
  b2.px = 650;
  const at = (x) => game.under(x - game.tip, R);
  assert.equal(at(610), a, 'the left knot is nearer the tip');
  assert.equal(at(640), b2, 'the right knot is nearer the tip');
  assert.equal(at(690), b2, 'only the right one is reached, beyond the tip');
});

test('snippit: turning keeps the hinge in place, and the flip is quick', () => {
  const game = create(env(5));
  game.update(1 / 60, blank());
  game.x = 800;
  game.vx = 0;
  game.update(1 / 60, blank({ x: 1 }));
  assert.equal(game.face, 1);
  game.update(1 / 60, blank({ x: -1 }));
  assert.equal(game.face, -1);
  // a single tap each way barely moves the eye
  assert.ok(Math.abs(game.x - 800) < 5, `hinge moved to ${game.x}`);
  // the cut point jumps across the eye; the eye itself does not move
  const x = game.x;
  assert.equal(game.cutX(x, 1) - x, x - game.cutX(x, -1));
  // the drawn flip: mirrored within a fifth of a second, never zero-width
  game.vx = 0;
  game.update(1 / 60, blank({ x: 1 }));
  for (let i = 0; i < 12; i++) {
    game.vx = 0;
    game.update(1 / 60, blank());
    assert.ok(Math.abs(game.flip()) >= 0.15);
  }
  assert.equal(game.flip(), -1, 'drawn mirrored, at full size');
  assert.equal(game.face, 1);
});

test('snippit: a gentle push walks it without turning; a full one turns it', () => {
  const game = create(env(5));
  game.update(1 / 60, blank());
  game.x = 800;
  game.vx = 0;
  for (let i = 0; i < 30; i++) game.update(1 / 60, blank({ x: 0.5 }));
  assert.equal(game.face, -1, 'still facing left');
  assert.ok(game.x > 830, `backed up to the right, at ${game.x}`);
  game.update(1 / 60, blank({ x: 0.95 }));
  assert.equal(game.face, 1, 'pushed all the way, it turns');
  for (let i = 0; i < 30; i++) game.update(1 / 60, blank({ x: -0.5 }));
  assert.equal(game.face, 1, 'and walks back left still facing right');
});

test('snippit: a pointer behind the eye turns it, and the tip follows the finger', () => {
  const game = create(env(6));
  game.update(1 / 60, blank());
  game.x = 800;
  const p = { active: true, x: 900, y: 600, down: false, pressed: false, released: false };
  for (let i = 0; i < 120; i++) game.update(1 / 60, blank({ pointer: p }));
  assert.equal(game.face, 1);
  assert.ok(Math.abs(game.cutX() - 900) < 2, `tip at ${game.cutX()}`);
});

// The Snippit is one size whatever it does: standing, snipping, jammed,
// watching a balloon go and striding, measured against how big each picture
// is painted (design/source/pose-scales.json).
test('snippit: every painted pose shows the Snippit the same size', async () => {
  const { withArt, shownSizes, sizeCheck } = await import('./sprite-rig.mjs');
  await import('../src/subjects.js');
  const undo = withArt();
  try {
    const game = create(env(1));
    const at = (o) => (gm) => Object.assign(gm, { snipT: 0, jam: 0, happyT: 0, moving: false }, o);
    const keys = ['sprites.snippitSnip', 'sprites.snippitPoses'];
    const states = {
      standing: at({}),
      snipping: at({ snipT: 0.2 }),
      jammed: at({ jam: 0.5 }),
      watching: at({ happyT: 0.5 }),
      striding: at({ moving: true }),
    };
    const sizes = shownSizes(game, 'snippit', states, keys);
    const { fails, table } = sizeCheck(sizes, 'standing');
    console.log('snippit pose sizes', table);
    assert.equal(Object.keys(table).length, 5, 'each pose drew one picture');
    assert.deepEqual(fails, []);
  } finally {
    undo();
  }
});

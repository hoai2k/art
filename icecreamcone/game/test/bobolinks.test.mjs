import test from 'node:test';
import assert from 'node:assert/strict';
import create from '../src/games/bobolinks.js';
import { BIRDS } from '../src/birds.js';
import { run, env, blank } from './harness.mjs';

const pass = BIRDS.find((b) => b.id === 'bobolinks').pass;

// A player who looks at the next stone, takes `rt` seconds (give or take a
// little) to step, and puts the wrong foot down now and then (`slip`).
// `habit`: how often it steps out of habit (the other foot from last time)
// when the stone is on the same side again, so a less regular path costs it
// more. Doubles are pressed left then right one frame apart.
function walker({ rt = 0.4, slip = 0.05, habit = 0, seed = 3 } = {}) {
  let lastStep = 0;
  let r = seed;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  let target = null;
  let wait = 0;
  let second = false;
  return (game) => {
    if (second) {
      second = false;
      return { right: true };
    }
    if (game.stumble > 0) {
      target = null;
      return {};
    }
    const s = game.stones[0];
    if (s !== target) {
      target = s;
      wait = rt * (0.7 + rnd() * 0.6);
    }
    wait -= 1 / 60;
    if (wait > 0) return {};
    target = null;
    if (s.side === 0) {
      second = true;
      return { left: true };
    }
    const expect = lastStep ? -lastStep : s.side;
    const side = rnd() < slip ? -s.side : s.side !== expect && rnd() < habit ? expect : s.side;
    lastStep = s.side;
    return side < 0 ? { left: true } : { right: true };
  };
}

const masher = (seed) => {
  let r = seed * 31;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  return () => (rnd() < 0.3 ? (rnd() < 0.5 ? { left: true } : { right: true }) : {});
};
// Left, right, left... five steps a second without looking.
const alternator = () => {
  let k = 0;
  return () => (k++ % 12 === 0 ? (k % 24 < 12 ? { left: true } : { right: true }) : {});
};
const SEEDS = Array.from({ length: 16 }, (_, i) => i + 1);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const BOTS = {
  idle: () => () => ({}),
  mash: (seed) => masher(seed),
  both: () => () => ({ left: true, right: true }),
  alternate: () => alternator(),
  clumsy: (seed) => walker({ rt: 0.75, slip: 0.06, habit: 0.3, seed: seed * 7 }),
  medium: (seed) => walker({ rt: 0.75, slip: 0.1, seed: seed * 7 }),
  good: (seed) => walker({ rt: 0.35, slip: 0.03, seed: seed * 7 }),
};
const TABLE = {};
for (const level of ['easier', 'normal', 'harder']) {
  TABLE[level] = {};
  for (const [name, bot] of Object.entries(BOTS)) TABLE[level][name] = SEEDS.map((seed) => run(create, { seed, bot: bot(seed), difficulty: level }).game.score);
}
const passRate = (a) => a.filter((s) => s >= pass).length / a.length;
console.log(`bobolinks pass ${pass}`);
for (const [level, row] of Object.entries(TABLE)) console.log(level, Object.entries(row).map(([n, a]) => `${n} ${Math.round(mean(a))} [${Math.min(...a)}-${Math.max(...a)}] ${Math.round(passRate(a) * 100)}%`).join(' · '));

test('bobolinks: at Normal a medium walker passes; idle and mashing do not, blind alternating seldom', () => {
  const t = TABLE.normal;
  assert.ok(passRate(t.medium) >= 0.75, `medium ${t.medium}`);
  assert.ok(passRate(t.clumsy) <= 0.5, `clumsy ${t.clumsy}`);
  assert.equal(Math.max(...t.idle), 0);
  for (const n of ['idle', 'mash', 'both']) assert.ok(Math.max(...t[n]) < pass, `${n} ${t[n]}`);
  // Blind alternating now and then gets a run of plain alternating stones and
  // scrapes past the mark, as it did before the curve.
  assert.ok(passRate(t.alternate) <= 0.2 && mean(t.alternate) < pass * 0.75, `alternate ${t.alternate}`);
});

// Stones crossed is limited mostly by how quickly a player steps, so the
// level changes the clumsy walker's score less than its stumbles.
test('bobolinks: Easier lets a clumsy walker pass more often; idle and mashing still fail', () => {
  const t = TABLE.easier;
  assert.ok(passRate(t.clumsy) > passRate(TABLE.normal.clumsy), `clumsy ${t.clumsy} vs ${TABLE.normal.clumsy}`);
  assert.ok(passRate(t.medium) >= 0.75, `medium ${t.medium}`);
  for (const n of ['idle', 'mash', 'both']) assert.ok(Math.max(...t[n]) < pass, `${n} ${t[n]}`);
  // the stones alternate more at Easier, so blind alternating does better there
  assert.ok(passRate(t.alternate) <= 0.3 && mean(t.alternate) < pass * 0.85, `alternate ${t.alternate}`);
});

test('bobolinks: Harder ends hard: the good walker scores clearly more; a clumsy one does worse', () => {
  const t = TABLE.harder;
  assert.ok(mean(t.good) > mean(t.medium) * 1.6, `good ${mean(t.good)} vs medium ${mean(t.medium)}`);
  assert.ok(mean(t.clumsy) < mean(TABLE.normal.clumsy), `clumsy ${mean(t.clumsy)}`);
  assert.ok(passRate(t.clumsy) < passRate(TABLE.normal.clumsy), `clumsy ${t.clumsy}`);
});

// The knobs by thirds of the round at Normal.
test('bobolinks: the knobs harden third by third at Normal', () => {
  const game = create(env(1));
  const look = () => ({ d: game.d(), sink: game.sinkTime(), alt: game.altChance(), dbl: game.doubleChance() });
  const step = (s) => { for (let i = 0; i < s * 60; i++) game.update(1 / 60, blank()); };
  const start = look();
  step(40 / 3);
  const third = look();
  step(40 / 3);
  const two = look();
  step(13.2);
  const end = look();
  console.log('bobolinks ramp', { start, third, two, end });
  for (const [a, b] of [[start, third], [third, two], [two, end]]) assert.ok(a.sink > b.sink && a.alt > b.alt && a.dbl < b.dbl);
  assert.ok(third.d < 0.3, 'the first third stays gentle');
});

test('bobolinks: the stones start slow and simple, and end quick and tricky', () => {
  const tally = { early: { n: 0, alt: 0, dbl: 0 }, late: { n: 0, alt: 0, dbl: 0 } };
  let sinkEarly = 0;
  let sinkLate = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const game = create(env(seed));
    sinkEarly = game.sinkTime();
    const seen = new Set(game.stones);
    let prev = game.stones[game.stones.length - 1];
    let lastSide = prev.side;
    // walk perfectly so new stones keep coming
    while (!game.done) {
      const s = game.stones[0];
      const inp = s.side === 0 ? { left: true, right: true } : s.side < 0 ? { left: true } : { right: true };
      game.update(1 / 60, blank(game.stumble > 0 || game.pending ? {} : inp));
      game.update(1 / 60, blank());
      for (const st of game.stones) {
        if (seen.has(st)) continue;
        seen.add(st);
        const half = game.elapsed < 13 ? 'early' : game.elapsed > 27 ? 'late' : null;
        if (half) {
          const t = tally[half];
          t.n++;
          if (st.side === 0) t.dbl++;
          else if (prev.side !== 0 && st.side === -lastSide) t.alt++;
        }
        if (st.side !== 0) lastSide = st.side;
        prev = st;
      }
      if (game.elapsed > 39) sinkLate = game.sinkTime();
    }
  }
  const { early, late } = tally;
  assert.ok(early.n > 10 && late.n > 10, `${early.n} ${late.n}`);
  assert.ok(sinkLate < sinkEarly * 0.5, `sinking ${sinkEarly} to ${sinkLate}`);
  assert.ok(late.dbl / late.n > (early.dbl / early.n) * 2, `doubles ${early.dbl}/${early.n} vs ${late.dbl}/${late.n}`);
  assert.ok(late.alt / late.n < (early.alt / early.n) * 0.75, `plain alternating ${early.alt}/${early.n} vs ${late.alt}/${late.n}`);
});

test('bobolinks: mashing both feet gets nowhere', () => {
  const { game } = run(create, { seed: 1, bot: () => ({ left: true, right: true }) });
  assert.ok(game.score < pass / 3, `mash ${game.score}`);
});

test('bobolinks: the right foot steps, the wrong foot splashes, doubles need both', () => {
  const game = create(env(4));
  const side = game.stones[0].side;
  game.update(1 / 60, blank(side < 0 ? { left: true } : { right: true }));
  assert.equal(game.score, 1);
  const s2 = game.stones[0].side || 1;
  game.update(1 / 60, blank(s2 < 0 ? { right: true } : { left: true }));
  assert.equal(game.score, 1);
  assert.ok(game.stumble > 0);
  // a double, stepped left then right within the window
  const d = create(env(4));
  d.stones[0].side = 0;
  d.update(1 / 60, blank({ left: true }));
  assert.equal(d.score, 0);
  d.update(1 / 60, blank({ right: true }));
  assert.equal(d.score, 1);
  // ...and one foot alone splashes
  const e = create(env(4));
  e.stones[0].side = 0;
  e.update(1 / 60, blank({ left: true }));
  for (let i = 0; i < 20; i++) e.update(1 / 60, blank());
  assert.equal(e.score, 0);
  assert.ok(e.stumble > 0 || e.wrong >= 0);
});

test('bobolinks: X and B step left and right like LB and RB; B held (slow) alone does nothing', () => {
  const game = create(env(4));
  const side = game.stones[0].side;
  game.update(1 / 60, blank(side < 0 ? { xPressed: true } : { bPressed: true }));
  assert.equal(game.score, 1);
  const s2 = game.stones[0].side;
  if (s2 !== 0) {
    game.update(1 / 60, blank(s2 < 0 ? { xPressed: true } : { bPressed: true }));
    assert.equal(game.score, 2);
  }
  // a double with X and B together
  const d = create(env(4));
  d.stones[0].side = 0;
  d.update(1 / 60, blank({ xPressed: true, bPressed: true, kind: 'controller' }));
  assert.equal(d.score, 1);
  // B held down (input.slow) is not a step
  const h = create(env(4));
  for (let i = 0; i < 10; i++) h.update(1 / 60, blank({ slow: true, kind: 'controller' }));
  assert.equal(h.score, 0);
  assert.equal(h.stumble, 0);
});

test('bobolinks: the controls text names LB / RB and X / B, not the D-pad or stick', async () => {
  const { controlLines } = await import('../src/controls.js');
  const bird = BIRDS.find((b) => b.id === 'bobolinks');
  const pad = controlLines(bird, 'controller').join(' | ');
  assert.match(pad, /LB/);
  assert.match(pad, /RB/);
  assert.match(pad, /\bX\b/);
  assert.match(pad, /\bB\b/);
  assert.match(pad, /both/i);
  assert.doesNotMatch(pad, /D-pad|stick|◀|▶/i);
  for (const k of ['keyboard', 'pointer']) assert.ok(controlLines(bird, k).length > 0);
});

// A stand-in 2D context that keeps the transform and records every point
// drawn (path points, arc and ellipse extents, text anchors) in the
// overlay's own units.
function fakeContext() {
  let m = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const points = [];
  const texts = [];
  const at = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const add = (x, y) => points.push(at(x, y));
  const round = (x, y, rx, ry = rx) => {
    add(x - rx, y - ry);
    add(x + rx, y + ry);
  };
  const ctx = {
    save: () => stack.push(m.slice()),
    restore: () => (m = stack.pop() || m),
    translate: (x, y) => (m = [m[0], m[1], m[2], m[3], m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]),
    scale: (sx, sy) => (m = [m[0] * sx, m[1] * sx, m[2] * sy, m[3] * sy, m[4], m[5]]),
    rotate: () => {},
    moveTo: add,
    lineTo: add,
    quadraticCurveTo: (cx, cy, x, y) => (add(cx, cy), add(x, y)),
    bezierCurveTo: (a, b, c2, d, x, y) => (add(a, b), add(c2, d), add(x, y)),
    arcTo: (x1, y1, x2, y2) => (add(x1, y1), add(x2, y2)),
    arc: (x, y, r) => round(x, y, r),
    ellipse: (x, y, rx, ry) => round(x, y, rx, ry),
    rect: (x, y, w, h) => (add(x, y), add(x + w, y + h)),
    fillText: (text, x, y) => {
      add(x, y);
      texts.push(text);
    },
    strokeText: (text, x, y) => add(x, y),
    measureText: (t) => ({ width: String(t).length * 10 }),
  };
  const noop = () => {};
  return {
    ctx: new Proxy(ctx, { get: (o, k) => (k in o ? o[k] : typeof k === 'string' && /^[a-z]/.test(k) && !/Style$|Width$|Join$|Cap$|Alpha$|font|text|Baseline|Align/.test(k) ? noop : o[k]), set: (o, k, v) => ((o[k] = v), true) }),
    points,
    texts,
  };
}

test('bobolinks: the foot pads are a fixed overlay, inside the visible area at the bottom', () => {
  const game = create(env(4));
  assert.equal(typeof game.drawOverlay, 'function');
  // wide (1280 x 720), upright phone (390 x 844: 760 units seen), phone on
  // its side (844 x 390), and narrower and smaller still
  for (const [w, h, s] of [[1600, 900, 0.8], [760, 900, 0.513], [1600, 900, 0.433], [620, 900, 0.3], [1600, 900, 2]]) {
    for (const kind of ['controller', 'keyboard', 'pointer']) {
      const { ctx, points, texts } = fakeContext();
      game.drawOverlay(ctx, { w, h, s, kind });
      assert.ok(points.length > 20, 'something drawn');
      for (const [x, y] of points) {
        assert.ok(x >= 0 && x <= w, `${kind} ${w}x${h}: x ${x.toFixed(1)} outside`);
        // in the lower part, clear of the HUD along the top
        assert.ok(y >= h * 0.5 && y <= h, `${kind} ${w}x${h}: y ${y.toFixed(1)} outside`);
      }
      const xs = points.map(([x]) => x);
      assert.ok(Math.min(...xs) < w * 0.25 && Math.max(...xs) > w * 0.75, 'a pad at each side');
      if (kind === 'controller') for (const t of ['LB', 'RB', 'X', 'B']) assert.ok(texts.includes(t), `${t} shown`);
      else assert.ok(!texts.includes('LB') && !texts.includes('RB'), `no bumpers for ${kind}`);
      if (kind === 'pointer') assert.deepEqual(texts.sort(), ['Left', 'Right']);
    }
  }
  // the world draw no longer draws the pads (they'd move with the camera)
  assert.ok(!/drawPads\(c\)/.test(create.toString()));
});

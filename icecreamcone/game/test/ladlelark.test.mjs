import test from 'node:test';
import assert from 'node:assert/strict';
import create from '../src/games/ladlelark.js';
import bird from '../src/more/ladlelark.js';
import { run, env, blank } from './harness.mjs';

const pass = bird.pass;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

// What a dip at (u, v), `ahead` seconds from now, would bring up: how many
// wanted bits, and how many unwanted (the boot counts as many).
function scoopAt(game, u, v, ahead, margin) {
  const need = { ...game.needs() };
  let got = 0;
  let bad = 0;
  for (const b of game.bits) {
    if (game.inRing(b, u, v, ahead, game.ring + margin)) {
      if (b.kind === 'boot') bad += 9;
      else if (!need[b.kind]) bad++;
      else {
        need[b.kind]--;
        got++;
      }
    }
  }
  return { got, bad };
}
const clean = (game, u, v, ahead, margin) => {
  const s = scoopAt(game, u, v, ahead, margin);
  return s.bad ? 0 : s.got;
};

// A cook: picks a wanted bit with nothing unwanted near it, follows it round
// the pot, and dips just ahead of it. `skill` slows the hand, forgets to lead,
// checks less carefully and sometimes dips in a hurry.
function cook(skill = 1, seed = 1, look = 0.6) {
  let r = seed * 7919;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  let pressed = false;
  let target = null;
  let rest = 0;
  let last = 0;
  return (game, t) => {
    if (pressed) {
      pressed = false;
      rest = t + (skill >= 1 ? 0 : look); // a beginner looks to see what came up
      return {};
    }
    if (game.dipT > 0 || t < rest) return {};
    const need = game.needs();
    const ahead = skill >= 1 ? game.scoopIn : 0;
    const margin = skill >= 1 ? 0.01 : 0;
    // where to dip: on a wanted bit, or (a good cook) between two of them
    const spots = [];
    const want = game.bits.filter((b) => need[b.kind]);
    for (const b of want) spots.push({ b, p: game.where(b, ahead) });
    if (skill >= 1) {
      for (let i = 0; i < want.length; i++) {
        for (let j = i + 1; j < want.length; j++) {
          const p = game.where(want[i], ahead);
          const q = game.where(want[j], ahead);
          if (Math.hypot(p[0] - q[0], p[1] - q[1]) < game.ring * 1.6) spots.push({ b: want[i], p: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], pair: want[j] });
        }
      }
    }
    for (const s of spots) {
      s.d = Math.hypot(s.p[0] - game.u, s.p[1] - game.v);
      s.n = clean(game, s.p[0], s.p[1], ahead, margin);
      s.value = s.n ? s.n - s.d * (skill >= 1 ? 1.2 : 0.5) : -10 - s.d;
    }
    spots.sort((a, b) => b.value - a.value);
    let o = spots[0];
    // stick to the spot already chosen unless it is spoilt or another is much better
    const keep = target && spots.find((s) => s.b === target.b && s.pair === target.pair);
    if (keep && (skill < 1 || (keep.n > 0 && keep.value > o.value - 0.6))) o = keep;
    if (o) {
      target = { b: o.b, pair: o.pair };
      o.ok = o.n > 0;
    }
    if (!o) return {};
    const du = o.p[0] - game.u;
    const dv = o.p[1] - game.v;
    const close = Math.hypot(du, dv) < (skill >= 1 ? 0.05 : 0.09);
    // a good cook that has waited long for a clean dip takes the one unwanted bit it's allowed
    const fed = skill >= 1 && t - last > 3 && !game.cust.extras;
    // (a good cook checks the ring where it actually is)
    const here = scoopAt(game, game.u, game.v, ahead, 0.005);
    const ok = skill >= 1 ? here.got > 0 && (here.bad === 0 || (fed && here.bad === 1)) : o.ok;
    if (close && (ok || rnd() < (skill >= 1 ? 0 : 0.03))) {
      pressed = true;
      last = t;
      target = null;
      return { action: true };
    }
    const sp = 0.45 + 0.55 * skill;
    // a good cook moves with the swirl as well as towards the bit
    const p0 = game.where(o.b, ahead);
    const q = game.where(o.b, ahead + 0.05);
    const fu = skill >= 1 ? ((q[0] - p0[0]) / 0.05) * (400 / 640) : 0;
    const fv = skill >= 1 ? ((q[1] - p0[1]) / 0.05) * (150 / 640) : 0;
    return { x: clamp(fu + du * 12, -1, 1) * sp, y: clamp(fv + dv * 5, -1, 1) * sp };
  };
}

// Mashing: dip as fast as possible, from the middle or wandering about.
const masher = (seed, still) => {
  let r = seed * 31;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  let d = [0, 0];
  return (game, t) => {
    if (rnd() < 0.03) d = [rnd() * 2 - 1, rnd() * 2 - 1];
    return { x: still ? 0 : d[0], y: still ? 0 : d[1], action: Math.floor(t * 6) % 2 === 0 };
  };
};

// Dips at the nearest wanted bit without looking at what's round it.
const grabber = () => {
  let pressed = false;
  return (game) => {
    if (pressed || game.dipT > 0) {
      pressed = false;
      return {};
    }
    const need = game.needs();
    const b = game.bits.filter((b) => need[b.kind]).map((b) => game.where(b)).sort((a, c) => Math.hypot(a[0] - game.u, a[1] - game.v) - Math.hypot(c[0] - game.u, c[1] - game.v))[0];
    if (!b) return {};
    const du = b[0] - game.u;
    const dv = b[1] - game.v;
    if (Math.hypot(du, dv) < 0.1) {
      pressed = true;
      return { action: true };
    }
    return { x: clamp(du * 10, -1, 1), y: clamp(dv * 4, -1, 1) };
  };
};

// A cook below 1 dips where a bit is now, not where it will be, so it
// misses more as the swirl speeds up.
const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);
const BOTS = {
  idle: () => () => ({}),
  mash: (seed) => masher(seed, false),
  still: (seed) => masher(seed, true),
  grab: () => grabber(),
  clumsy: (seed) => cook(0.3, seed, 1.8), // slower on the stick, 1.8 s to look up after a dip
  medium: (seed) => cook(0.4, seed), // the old beginner
  good: (seed) => cook(1, seed),
};
const TABLE = {};
for (const level of ['easier', 'normal', 'harder']) {
  TABLE[level] = {};
  for (const [name, b] of Object.entries(BOTS)) TABLE[level][name] = SEEDS.map((seed) => run(create, { seed, bot: b(seed), difficulty: level }).game.score);
}
const passRate = (a) => a.filter((s) => s >= pass).length / a.length;
console.log(`ladlelark pass ${pass}`);
for (const [level, row] of Object.entries(TABLE)) console.log(level, Object.entries(row).map(([n, a]) => `${n} ${Math.round(mean(a))} [${Math.min(...a)}-${Math.max(...a)}] ${Math.round(passRate(a) * 100)}%`).join(' · '));

test('ladlelark: at Normal a medium cook passes, a good one more; idle and mashing do not', () => {
  const t = TABLE.normal;
  assert.ok(passRate(t.medium) >= 0.75, `medium ${t.medium}`);
  assert.ok(mean(t.good) > mean(t.medium) + 3, `good ${t.good}`);
  assert.ok(mean(t.grab) < mean(t.good), `grabbing ${t.grab}`);
  assert.ok(passRate(t.clumsy) < passRate(t.medium) && mean(t.clumsy) < mean(t.medium) - 10, `clumsy ${t.clumsy}`);
  for (const n of ['idle', 'mash', 'still']) assert.ok(Math.max(...t[n]) < pass, `${n} ${t[n]}`);
});

test('ladlelark: Easier lets a clumsy cook pass; idle and mashing still fail', () => {
  const t = TABLE.easier;
  assert.ok(passRate(t.clumsy) >= 0.75, `clumsy ${t.clumsy}`);
  assert.ok(passRate(t.clumsy) > passRate(TABLE.normal.clumsy), `clumsy at Normal ${TABLE.normal.clumsy}`);
  for (const n of ['idle', 'mash', 'still']) assert.ok(Math.max(...t[n]) < pass, `${n} ${t[n]}`);
});

test('ladlelark: Harder ends hard: the good cook scores clearly more than the medium one', () => {
  const t = TABLE.harder;
  assert.ok(mean(t.good) > mean(t.medium) + 6, `good ${mean(t.good)} vs medium ${mean(t.medium)}`);
  assert.ok(mean(t.clumsy) < mean(TABLE.normal.clumsy), `clumsy ${mean(t.clumsy)} vs Normal ${mean(TABLE.normal.clumsy)}`);
});

test('ladlelark: the knobs at each level: Easier stays gentle, Harder opens near medium', () => {
  const rows = {};
  for (const level of ['easier', 'normal', 'harder']) {
    const game = create(env(1, { difficulty: level }));
    const look = () => ({ swirl: game.swirlNow(), step: game.orderStep(), patience: game.patienceNow(), boot: game.bootChance() });
    const row = [look()];
    for (let i = 0; i < 3; i++) {
      for (let f = 0; f < (50 / 3) * 60 - (i === 2 ? 1 : 0); f++) game.update(1 / 60, blank());
      row.push(look());
    }
    console.log('ladlelark ramp', level, row.map((k) => `swirl ${k.swirl.toFixed(2)} step ${k.step} waits ${k.patience.toFixed(1)} boot ${k.boot.toFixed(2)}`).join(' | '));
    for (let i = 1; i < row.length; i++) assert.ok(row[i].swirl >= row[i - 1].swirl && row[i].step >= row[i - 1].step && row[i].patience <= row[i - 1].patience, `${level} gets harder`);
    rows[level] = row;
  }
  const n = rows.normal;
  assert.ok(n[1].swirl < (n[0].swirl + n[3].swirl) / 2 && n[1].step === 0, 'the first third stays gentle');
  assert.ok(rows.easier[3].step === 0 && rows.easier[3].swirl < 0.65, 'Easier keeps small orders and a slow pot');
  assert.ok(rows.harder[0].step === 1 && rows.harder[3].step === 2, 'Harder opens near medium and ends hard');
});

// A pot holding just these bits (at angle a, radius r), the swirl stopped.
function pot(order, bits) {
  const game = create(env(1));
  game.update(1 / 60, blank());
  game.cust.order = order;
  game.cust.got = {};
  game.bits = bits.map(([kind, a, r]) => ({ kind, a, r, w: 0, ph: 0, drift: 0, born: 1 }));
  game.refill = [];
  return game;
}
function dipAt(game, u, v) {
  game.u = u;
  game.v = v;
  game.update(1 / 60, blank({ action: true, actionPressed: true }));
  for (let i = 0; i < 40; i++) {
    game.u = u;
    game.v = v;
    game.update(1 / 60, blank());
  }
}

test('ladlelark: the first customers ask for little from a slow pot; the last ask for more, of more kinds, from a fast one, with less patience', () => {
  const part = () => ({ sizes: [], kinds: [], patience: [], swirl: 0, boot: false });
  const early = part();
  const late = part();
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    let seen = null;
    const bot = cook(1, seed);
    run(create, {
      seed,
      bot: (game, t) => {
        const p = game.elapsed / 50;
        const q = p < 1 / 3 ? early : p > 2 / 3 ? late : null;
        if (q) {
          q.swirl = Math.max(q.swirl, game.swirl);
          if (game.bits.some((b) => b.kind === 'boot')) q.boot = true;
          if (game.cust && game.cust !== seen) {
            seen = game.cust;
            const n = Object.values(seen.order).reduce((a, b) => a + b, 0);
            q.sizes.push(n);
            q.kinds.push(Object.keys(seen.order).length);
            q.patience.push(seen.patience - n * 1.5);
          }
        }
        return bot(game, t);
      },
    });
  }
  assert.ok(Math.max(...early.sizes) <= 2, `early orders ${early.sizes}`);
  assert.ok(Math.max(...early.kinds) === 1, `early orders of one kind: ${early.kinds}`);
  assert.ok(mean(late.sizes) >= mean(early.sizes) + 0.9, `order sizes early ${mean(early.sizes).toFixed(2)}, late ${mean(late.sizes).toFixed(2)}`);
  assert.ok(Math.max(...late.kinds) >= 3, `late orders mix kinds: ${late.kinds}`);
  assert.ok(mean(late.patience) < mean(early.patience) * 0.8, `patience early ${mean(early.patience).toFixed(1)}, late ${mean(late.patience).toFixed(1)}`);
  assert.ok(late.swirl > early.swirl * 1.6, `swirl early ${early.swirl.toFixed(2)}, late ${late.swirl.toFixed(2)}`);
  assert.equal(early.boot, false, 'no old boot in the first third');
  assert.ok(late.boot, 'the old boot bobs up late');
});

test('ladlelark: a dip takes what is in the ring; just what was asked scores three, four when quick', () => {
  const game = pot({ carrot: 2 }, [['carrot', 0, 0.5], ['carrot', 0.1, 0.5], ['pea', Math.PI, 0.5]]);
  game.cust.t = game.cust.patience * 0.5;
  dipAt(game, 0.5, 0.03);
  assert.equal(game.score, 3);
  assert.equal(game.served, 1);
  assert.equal(game.bits.length, 1, 'the pea stays in the pot');
  const quick = pot({ pea: 1 }, [['pea', 0, 0.5]]);
  dipAt(quick, 0.5, 0);
  assert.equal(quick.score, 4);
});

test('ladlelark: one unwanted bit is forgiven (one point); a second is "Yuck!"', () => {
  const one = pot({ carrot: 1 }, [['carrot', 0, 0.5], ['pea', 0.08, 0.5]]);
  dipAt(one, 0.5, 0.02);
  assert.equal(one.score, 1);
  const two = pot({ carrot: 1 }, [['pea', 0, 0.5], ['pea', 0.08, 0.5], ['carrot', Math.PI, 0.5]]);
  two.score = 5;
  dipAt(two, 0.5, 0.02);
  assert.equal(two.yucks, 1);
  assert.equal(two.score, 4, 'a "Yuck!" costs one');
});

test('ladlelark: the old boot is always "Yuck!"', () => {
  const game = pot({ carrot: 2 }, [['carrot', 0, 0.5], ['boot', 0.05, 0.5]]);
  dipAt(game, 0.5, 0.02);
  assert.equal(game.yucks, 1);
  assert.equal(game.score, 0);
});

test('ladlelark: an empty dip does nothing, and a creature kept waiting leaves', () => {
  const game = pot({ pea: 1 }, [['pea', Math.PI, 0.5]]);
  dipAt(game, 0.5, 0);
  assert.equal(game.cust.bowl.length, 0);
  game.cust.patience = game.cust.t + 0.1;
  for (let i = 0; i < 20; i++) game.update(1 / 60, blank());
  assert.equal(game.walked, 1);
});

test('ladlelark: a bit on the ring\'s line comes up; one only touching it stays', () => {
  // A pea's footprint is about 0.06 of the surface across its radius (its
  // painted body, 26 px or so at the pot's scale, over the surface's 360 px).
  const near = pot({ pea: 1 }, [['pea', 0, 0.5]]);
  dipAt(near, 0.5 - near.ring - 0.015, 0); // its centre just over the line, its body across it
  assert.equal(near.score, 4, 'a bit on the line counts');
  const far = pot({ pea: 1 }, [['pea', 0, 0.5]]);
  dipAt(far, 0.5 - far.ring - 0.05, 0); // only its edge in the ring
  assert.equal(far.cust.bowl.length, 0, 'mostly outside stays in the pot');
  assert.equal(far.bits.length, 1);
});

test('ladlelark: the right stick (Q / E, the wheel) makes the ring smaller or bigger, within limits', () => {
  const game = pot({ pea: 1 }, [['pea', Math.PI, 0.5]]);
  const r0 = game.ring;
  const [lo, hi] = game.sizes;
  for (let i = 0; i < 15; i++) game.update(1 / 60, blank({ ry: -1 })); // up: smaller
  assert.ok(game.ring < r0 && game.size > lo, `shrinks smoothly: ${game.size}`);
  const held = game.ring;
  for (let i = 0; i < 30; i++) game.update(1 / 60, blank());
  assert.equal(game.ring, held, 'keeps its size when let go');
  for (let i = 0; i < 200; i++) game.update(1 / 60, blank({ ry: -1 }));
  assert.equal(game.size, lo);
  for (let i = 0; i < 400; i++) game.update(1 / 60, blank({ ry: 1 })); // down: bigger
  assert.equal(game.size, hi);
  assert.ok(lo >= 0.7 && hi <= 1.35, 'not too much either way');
  const wheel = pot({ pea: 1 }, [['pea', Math.PI, 0.5]]);
  wheel.update(1 / 60, blank({ wheel: 2 })); // two notches toward you
  assert.ok(wheel.size > 1.1, `the wheel grows it: ${wheel.size}`);
  wheel.update(1 / 60, blank({ wheel: -4 }));
  assert.ok(wheel.size < 1, `and shrinks it: ${wheel.size}`);
  // a bigger ring reaches a pea a smaller one can't
  const big = pot({ pea: 1 }, [['pea', 0, 0.5]]);
  big.setSize(hi);
  dipAt(big, 0.5 - 0.23, 0);
  assert.equal(big.score, 4);
  const small = pot({ pea: 1 }, [['pea', 0, 0.5]]);
  small.setSize(lo);
  dipAt(small, 0.5 - 0.23, 0);
  assert.equal(small.cust.bowl.length, 0);
});

test('input: state() gives the right stick (rx, ry), Q / E for its up and down, and wheel notches', async () => {
  const on = {};
  const targetOn = {};
  const saved = { add: globalThis.addEventListener, nav: Object.getOwnPropertyDescriptor(globalThis, 'navigator') };
  const pad = { index: 0, connected: true, buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] };
  globalThis.addEventListener = (t, fn) => (on[t] = fn);
  Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => [pad] }, configurable: true });
  try {
    const { createInput } = await import('../src/input.js');
    const input = createInput({ addEventListener: (t, fn) => (targetOn[t] = fn) });
    input.poll();
    assert.deepEqual([input.state().rx, input.state().ry], [0, 0]);
    pad.axes = [0, 0, 0.1, -1];
    input.poll();
    assert.equal(input.state().rx, 0, 'the same deadzone as the left stick');
    assert.equal(input.state().ry, -1, 'right stick up');
    pad.axes = [0, 0, 0, 0];
    input.poll();
    on.keydown({ code: 'KeyE', repeat: false });
    assert.equal(input.state().ry, 1, 'E is the stick down');
    on.keyup({ code: 'KeyE' });
    on.keydown({ code: 'KeyQ', repeat: false });
    assert.equal(input.state().ry, -1, 'Q is the stick up');
    on.keyup({ code: 'KeyQ' });
    input.endFrame();
    targetOn.wheel({ deltaY: 200, deltaMode: 0 });
    assert.equal(input.state().wheel, 2, 'two notches toward you');
    input.endFrame();
    assert.equal(input.state().wheel, 0, 'counted once');
  } finally {
    globalThis.addEventListener = saved.add;
    if (saved.nav) Object.defineProperty(globalThis, 'navigator', saved.nav);
  }
});

// A creature in the queue is one size whether it waits or pulls a face: both
// pictures are painted at one size, so both are drawn at one scale (fitting
// each picture's own outline would make the rabbit, its ears down, jump bigger).
test('ladlelark: a creature keeps its size when it pulls a face', async () => {
  const { withArt, recorder } = await import('./sprite-rig.mjs');
  const undo = withArt();
  try {
    const game = create(env(1));
    game.update(1 / 60, blank());
    for (let who = 0; who < 4; who++) {
      const ks = [];
      for (const mood of [0, -1]) {
        Object.assign(game.cust, { who, mood, arrive: 0, leaving: undefined });
        game.queue = []; // only the creature at the front
        const rec = recorder();
        game.draw(rec.ctx, 1);
        const d = rec.draws.find((e) => e.key === 'sprites.larkQueue' && e.cell === who + (mood < 0 ? 4 : 0));
        assert.ok(d, `creature ${who} drawn ${mood < 0 ? 'pulling a face' : 'waiting'}`);
        ks.push(d.k);
      }
      assert.ok(Math.abs(ks[1] / ks[0] - 1) < 0.01, `creature ${who}: ${ks[0].toFixed(4)} waiting, ${ks[1].toFixed(4)} pulling a face`);
    }
  } finally {
    undo();
  }
});

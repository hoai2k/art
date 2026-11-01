import test from 'node:test';
import assert from 'node:assert/strict';
import create from '../src/games/radiobird.js';
import entry from '../src/more/radiobird.js';
import { run, env, blank } from './harness.mjs';

const pass = entry.pass;

// A listener at the dial: goes to the pencil mark if the station asked for
// is marked (and it remembers), otherwise sweeps through the static; when a
// station's picture comes in it lets go of the stick, and if it is the one
// asked for, presses to play it once the needle has settled. `skill` slows
// the sweep and the reactions, makes it overshoot, sometimes press on the
// wrong station, and forget the marks.
function tuner(skill = 1, seed = 1) {
  let r = seed * 7919;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  let dir = 1;
  let asked = -1;
  let remember = true;
  let wait = 0; // reaction time before pressing
  let coast = 0; // overshoot: keeps sweeping a moment after a station comes in
  let pressed = false;
  return (game) => {
    if (game.asked !== asked) {
      asked = game.asked;
      remember = rnd() < 0.3 + 0.7 * skill;
      wait = 0;
    }
    if (pressed) {
      pressed = false;
      return {};
    }
    if (game.locked) return {};
    const tuned = game.tuned();
    if (coast > 0) {
      coast -= 1 / 60;
      return { x: dir * (0.55 + 0.45 * skill) };
    }
    if (tuned >= 0 && game.near(tuned) > 0.6) {
      if (tuned === game.want || rnd() < (1 - skill) * 0.01) {
        if (wait <= 0) wait = 0.15 + (1 - skill) * 0.6 * rnd();
        wait -= 1 / 60;
        if (wait <= 0) {
          pressed = true;
          return { action: true };
        }
        return {};
      }
    }
    const memo = game.marks[game.want];
    if (remember && memo !== undefined && Math.abs(memo - game.n) > 0.01) {
      const d = memo - game.n;
      dir = Math.sign(d);
      return { x: Math.sign(d) * Math.min(1, Math.sqrt(Math.abs(d) * 8)) };
    }
    if (game.n >= 0.995) dir = -1;
    if (game.n <= 0.005) dir = 1;
    // a beginner's hand sometimes runs on past a station
    if (tuned < 0 && game.near(game.nearest()) > 0.5 && rnd() < (1 - skill) * 0.05) coast = 0.3;
    return { x: dir * (0.55 + 0.45 * skill) };
  };
}

const sweepWith = (speed, press) => {
  let dir = 1;
  let n = 0;
  return (game) => {
    if (game.n >= 0.99) dir = -1;
    if (game.n <= 0.01) dir = 1;
    return { x: dir * speed, action: press && n++ % 2 === 0 };
  };
};

// Stops at every station it meets and presses, wanted or not.
const presser = () => {
  let dir = 1;
  let t = 0;
  return (game) => {
    if (game.locked) return {};
    if (game.n >= 0.99) dir = -1;
    if (game.n <= 0.01) dir = 1;
    if (game.tuned() >= 0 && game.near(game.tuned()) > 0.6) return { action: t++ % 2 === 0 };
    return { x: dir };
  };
};

// A random masher: the dial anywhere, the button half the time.
const masher = (seed) => {
  let rr = seed * 5;
  const rnd = () => ((rr = (rr * 16807) % 2147483647) / 2147483647);
  return () => ({ x: rnd() * 2 - 1, action: rnd() < 0.5, spin: rnd() - 0.5 });
};

// A tuner below 1 sweeps slower, overshoots and is slower to press, so it
// loses more as the stations narrow and wander.
const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const BOTS = {
  idle: () => () => ({}),
  mash: (seed) => masher(seed),
  sweep: () => sweepWith(1, false),
  sweepMash: () => sweepWith(1, true),
  creepMash: () => sweepWith(0.4, true),
  pressAll: () => presser(),
  clumsy: (seed) => tuner(-0.3, seed), // the same tuner a step below: slower, overshoots, forgets the marks
  medium: (seed) => tuner(0.3, seed), // the old beginner
  good: (seed) => tuner(1, seed),
};
const MASHES = ['idle', 'mash', 'sweep', 'sweepMash', 'creepMash'];
const TABLE = {};
for (const level of ['easier', 'normal', 'harder']) {
  TABLE[level] = {};
  for (const [name, b] of Object.entries(BOTS)) TABLE[level][name] = SEEDS.map((seed) => run(create, { seed, bot: b(seed), difficulty: level }).game.score);
}
const passRate = (a) => a.filter((s) => s >= pass).length / a.length;
console.log(`radiobird pass ${pass}`);
for (const [level, row] of Object.entries(TABLE)) console.log(level, Object.entries(row).map(([n, a]) => `${n} ${Math.round(mean(a))} [${Math.min(...a)}-${Math.max(...a)}] ${Math.round(passRate(a) * 100)}%`).join(' · '));

test('radiobird: at Normal a medium tuner passes, a good one well beyond; sweeping, mashing and idling do not', () => {
  const t = TABLE.normal;
  assert.ok(passRate(t.medium) >= 0.75, `medium ${t.medium}`);
  assert.ok(mean(t.good) > mean(t.medium) * 1.3, `good ${t.good}`);
  assert.ok(passRate(t.clumsy) <= 0.5, `clumsy ${t.clumsy}`);
  for (const n of MASHES) assert.ok(Math.max(...t[n]) < pass, `${n} ${t[n]}`);
  assert.ok(mean(t.pressAll) < mean(t.good), `press ${t.pressAll}`);
});

// A slow tuner's score is set by how fast it sweeps the dial and how often
// it forgets the pencil marks, not by how narrow the stations are, so
// Easier (wide, nearly still stations) lifts it very little.
test('radiobird: Easier is calmer: medium passes, clumsy about as often as at Normal; sweeping, mashing and idling still fail', () => {
  const t = TABLE.easier;
  assert.ok(passRate(t.medium) === 1, `medium ${t.medium}`);
  assert.ok(passRate(t.clumsy) >= passRate(TABLE.normal.clumsy) - 0.1, `clumsy ${t.clumsy} vs Normal ${TABLE.normal.clumsy}`);
  for (const n of MASHES) assert.ok(Math.max(...t[n]) < pass, `${n} ${t[n]}`);
});

test('radiobird: Harder ends hard: the good tuner scores clearly more than the medium one', () => {
  const t = TABLE.harder;
  assert.ok(mean(t.good) > mean(t.medium) * 1.3, `good ${mean(t.good)} vs medium ${mean(t.medium)}`);
  assert.ok(mean(t.medium) < mean(TABLE.normal.medium) - 15, `medium ${mean(t.medium)} vs Normal ${mean(TABLE.normal.medium)}`);
});

test('radiobird: the knobs at each level: Easier stays gentle, Harder opens near medium', () => {
  const rows = {};
  for (const level of ['easier', 'normal', 'harder']) {
    const game = create(env(1, { difficulty: level }));
    const look = () => ({ width: game.width(), drift: game.drift(), wander: game.wander() });
    const row = [look()];
    for (let i = 0; i < 3; i++) {
      for (let f = 0; f < (50 / 3) * 60 - (i === 2 ? 1 : 0); f++) game.update(1 / 60, blank());
      row.push(look());
    }
    console.log('radiobird ramp', level, row.map((k) => `width ${k.width.toFixed(3)} drift ${k.drift.toFixed(3)} wander ${k.wander.toFixed(2)}`).join(' | '));
    for (let i = 1; i < row.length; i++) assert.ok(row[i].width <= row[i - 1].width && row[i].drift >= row[i - 1].drift, `${level} gets harder`);
    rows[level] = row;
  }
  const n = rows.normal;
  assert.ok(n[1].width > (n[0].width + n[3].width) / 2, 'the first third stays gentle');
  assert.ok(rows.easier[3].width > 0.04, 'Easier keeps wide stations');
  assert.ok(rows.harder[0].width < 0.042 && rows.harder[3].width < 0.026, 'Harder opens near medium and ends hard');
});

test('radiobird: stations start wide and nearly still, and end narrow and wandering', () => {
  const part = () => ({ width: [], move: [], finds: [] });
  const early = part();
  const late = part();
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const bot = tuner(1, seed);
    let prev = null;
    let asked = 0;
    run(create, {
      seed,
      bot: (game, t) => {
        const p = game.elapsed / 50;
        const q = p < 1 / 3 ? early : p > 2 / 3 ? late : null;
        const f = game.stations.map((_, i) => game.freq(i));
        if (q) {
          q.width.push(game.width());
          // how far a station strays from its place on the dial
          game.stations.forEach((st, i) => q.move.push(Math.abs(f[i] - st.base)));
          if (game.asked !== asked && prev !== null) q.finds.push(prev);
        }
        asked = game.asked;
        prev = game.findT;
        return bot(game, t);
      },
    });
  }
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  assert.ok(mean(late.width) < mean(early.width) * 0.8, `station width early ${mean(early.width).toFixed(3)}, late ${mean(late.width).toFixed(3)}`);
  assert.ok(mean(late.move) > mean(early.move) * 2, `stations stray early ${mean(early.move).toFixed(4)}, late ${mean(late.move).toFixed(4)}`);
  assert.ok(mean(late.finds) > mean(early.finds), `a good tuner takes longer late: early ${mean(early.finds).toFixed(2)} s, late ${mean(late.finds).toFixed(2)} s`);
});

test('radiobird: pressing on the asked-for station plays its song; a quick find scores more', () => {
  const game = create(env(1));
  const want = game.want;
  game.n = game.freq(want);
  game.update(1 / 60, blank({ action: true, actionPressed: true }));
  assert.ok(game.locked);
  for (let i = 0; i < 60 * 2.2; i++) game.update(1 / 60, blank());
  assert.ok(game.score >= 19, `quick find ${game.score}`);
  assert.notEqual(game.want, want, 'they ask for another');
  assert.ok(game.marks[want] !== undefined, 'the station is pencilled on the dial');
  const slow = create(env(1));
  for (let i = 0; i < 60 * 8; i++) slow.update(1 / 60, blank());
  slow.n = slow.freq(slow.want);
  slow.update(1 / 60, blank({ action: true, actionPressed: true }));
  for (let i = 0; i < 60 * 2.2; i++) slow.update(1 / 60, blank());
  assert.ok(slow.score >= 10 && slow.score < game.score, `slow find ${slow.score}`);
});

test('radiobird: just tuning in plays nothing; a wrong station grumbles; turning away loses the song', () => {
  const game = create(env(2));
  for (let i = 0; i < 60 * 4; i++) {
    game.n = game.freq(game.want);
    game.update(1 / 60, blank());
  }
  assert.equal(game.score, 0, 'no press, no song');
  const wrong = (game.want + 1) % 6;
  game.n = game.freq(wrong);
  game.update(1 / 60, blank({ action: true, actionPressed: true }));
  assert.ok(!game.locked && game.grumble > 0);
  const g2 = create(env(2));
  g2.n = g2.freq(g2.want);
  g2.update(1 / 60, blank({ action: true, actionPressed: true }));
  for (let i = 0; i < 60; i++) g2.update(1 / 60, blank({ x: 1 }));
  assert.ok(!g2.locked && g2.score === 0, 'lost it');
});

test('radiobird: left alone near a station, the needle settles on it', () => {
  const game = create(env(1));
  const f = game.freq(0);
  game.n = f + 0.02;
  for (let i = 0; i < 60; i++) game.update(1 / 60, blank());
  assert.ok(Math.abs(game.n - game.freq(0)) < 0.006, `${game.n} vs ${game.freq(0)}`);
});

test('radiobird: with a pointer, letting go of the needle on the station plays it', () => {
  const game = create(env(3));
  const x = 590 + game.freq(game.want) * 880;
  const ptr = (down, extra = {}) => blank({ kind: 'pointer', action: down, pointer: { active: true, x, y: 200, down, pressed: false, released: !down }, ...extra });
  for (let i = 0; i < 40; i++) game.update(1 / 60, ptr(true));
  game.update(1 / 60, ptr(false, { actionReleased: true }));
  for (let i = 0; i < 20; i++) game.update(1 / 60, ptr(false));
  assert.ok(game.locked || game.score > 0);
});

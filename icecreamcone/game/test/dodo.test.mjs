import test from 'node:test';
import assert from 'node:assert/strict';
import create from '../src/games/dodo.js';
import { BIRDS } from '../src/birds.js';
import { run, env, blank } from './harness.mjs';

const pass = BIRDS.find((b) => b.id === 'dodo').pass;

// A sharp-eyed player: knows where the Dodo went, takes `react` seconds to
// decide, then steps the marker over with the stick (one step per press).
function tracker(react = 0.6, missFrom = 99) {
  return (game, t) => {
    if (game.phase !== 'pick' || game.pt < react) return {};
    // from round `missFrom` on, it loses track and guesses the first hat
    const target = game.round + 1 >= missFrom ? 0 : game.dodoSlot();
    if (game.sel === target) return { action: true };
    const flip = Math.floor(t * 60) % 2 === 0;
    return { x: flip ? Math.sign(target - game.sel) : 0 };
  };
}

// Guesses at once, pressing the action as soon as it can.
const guesser = (game) => ({ action: game.phase === 'pick' && game.pt > 0.15 });

// A beginner: follows the Dodo's hat by eye, and may lose it whenever that
// hat moves, more likely the quicker the move (and more in a feint, a double
// swap or a ring). Once lost, it guesses. Measured from each move as it plays.
// A clumsier eye (`k`, `slow`, `extra` larger) loses it more, and on slower
// moves too.
function beginner(seed, k = 1.3, slow = 0.6, extra = 0.12) {
  let r = seed * 7919;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  let seen = null;
  let lost = false;
  let round = -1;
  let guess = 0;
  return (game, t) => {
    if (game.round !== round) {
      round = game.round;
      lost = false;
    }
    const m = game.move;
    if (m && m !== seen) {
      seen = m;
      const dodo = game.hats.find((h) => h.dodo);
      if (m.hats.includes(dodo)) {
        const p = Math.max(0, (slow - m.dur) * k) + (m.legs.length > 2 ? extra : 0) + (m.fake ? extra : 0);
        if (rnd() < p) lost = true;
      }
      guess = Math.floor(rnd() * game.hats.length);
    }
    if (game.phase !== 'pick' || game.pt < 1) return {};
    const target = lost ? Math.min(guess, game.hats.length - 1) : game.dodoSlot();
    if (game.sel === target) return { action: true };
    const flip = Math.floor(t * 60) % 2 === 0;
    return { x: flip ? Math.sign(target - game.sel) : 0 };
  };
}

const SEEDS = Array.from({ length: 24 }, (_, i) => i + 1);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const BOTS = {
  idle: () => () => ({}),
  guess: () => guesser,
  clumsy: (seed) => beginner(seed, 1.8, 0.7, 0.18),
  medium: (seed) => beginner(seed),
  good: () => tracker(),
};
const TABLE = {};
for (const level of ['easier', 'normal', 'harder']) {
  TABLE[level] = {};
  for (const [name, bot] of Object.entries(BOTS)) TABLE[level][name] = SEEDS.map((seed) => run(create, { seed, bot: bot(seed), difficulty: level }).game.score);
}
const passRate = (a) => a.filter((s) => s >= pass).length / a.length;
console.log(`dodo pass ${pass}`);
for (const [level, row] of Object.entries(TABLE)) console.log(level, Object.entries(row).map(([n, a]) => `${n} ${Math.round(mean(a))} [${Math.min(...a)}-${Math.max(...a)}] ${Math.round(passRate(a) * 100)}%`).join(' · '));

// A shell game can be guessed by luck now and then (about one game in ten
// over 60 seeds); guessing must not pass as a rule.
const guessFails = (a) => {
  assert.ok(passRate(a) <= 0.1, `guessing ${a}`);
  assert.ok(mean(a) < pass * 0.7, `guessing ${a}`);
};

test('dodo: at Normal a medium player passes, a sharp-eyed one always; idle and guessing do not', () => {
  const t = TABLE.normal;
  assert.ok(passRate(t.medium) >= 0.75, `medium ${t.medium}`);
  assert.ok(Math.min(...t.good) >= pass, `good ${t.good}`);
  assert.ok(passRate(t.clumsy) <= 0.5, `clumsy ${t.clumsy}`);
  assert.equal(Math.max(...t.idle), 0);
  guessFails(t.guess);
  const tired = [1, 2, 3, 4].map((seed) => run(create, { seed, bot: tracker(1.2, 6) }).game.score);
  assert.ok(Math.min(...tired) >= pass, `loses track from round 6 ${tired}`);
  const idle = run(create, { seed: 1 }).game;
  assert.ok(idle.done);
});

test('dodo: Easier lets a clumsy player pass; idle and guessing still fail', () => {
  const t = TABLE.easier;
  assert.ok(passRate(t.clumsy) >= 0.75, `clumsy ${t.clumsy}`);
  assert.equal(Math.max(...t.idle), 0);
  guessFails(t.guess);
});

test('dodo: Harder ends hard: the sharp-eyed player scores clearly more; a clumsy one does worse', () => {
  const t = TABLE.harder;
  assert.ok(mean(t.good) > mean(t.medium) + 300, `good ${mean(t.good)} vs medium ${mean(t.medium)}`);
  assert.ok(mean(t.clumsy) < mean(TABLE.normal.clumsy), `clumsy ${mean(t.clumsy)}`);
  guessFails(t.guess);
});

// The rounds' plans at each level: Normal is gentle for the first third,
// medium by round 5 or 6 and nearer hard at the end; Easier never gets past
// round 5's Normal pace; Harder starts near medium.
test('dodo: the rounds harden along the curve at every level', () => {
  const plans = (difficulty) => {
    const game = create(env(1, { difficulty }));
    return [0, 1, 2, 3, 4, 5, 6, 7].map((i) => game.plan(i));
  };
  const normal = plans('normal');
  const easier = plans('easier');
  const harder = plans('harder');
  console.log('dodo rounds (moves @ seconds)', Object.fromEntries(Object.entries({ easier, normal, harder }).map(([k, v]) => [k, v.map((r) => `${r.n}:${r.moves}@${r.dur.toFixed(2)}`).join(' ')])));
  for (const list of [normal, easier, harder]) {
    for (let i = 1; i < 8; i++) assert.ok(list[i].moves >= list[i - 1].moves && list[i].dur <= list[i - 1].dur && list[i].show <= list[i - 1].show, `round ${i + 1}`);
  }
  assert.deepEqual(normal.map((r) => r.n), [3, 3, 4, 4, 4, 5, 5, 5]);
  assert.deepEqual(easier.map((r) => r.n), normal.map((r) => r.n), 'the same hats at every level');
  assert.ok(normal[0].moves === 2 && normal[2].moves <= 5, 'the first third stays gentle');
  assert.ok(easier[7].moves <= 7 && easier[7].dur > 0.5 && !easier[7].ring, 'Easier stays slow');
  assert.ok(harder[7].moves === 16 && harder[7].dur === 0.26, 'Harder ends at full hard');
  assert.ok(normal[7].moves < 16 && normal[7].dur > 0.26, 'Normal ends short of it');
});

test('dodo: the first rounds are few, slow swaps; the last are many quick ones', () => {
  const game = create(env(3));
  const rounds = [];
  let move = null;
  for (let i = 0; i < 60 * 200 && !game.done; i++) {
    game.update(1 / 60, blank({ action: game.phase === 'pick' }));
    if (game.move && game.move !== move) {
      move = game.move;
      const r = (rounds[game.round] ||= { n: game.hats.length, moves: 0, dur: 0 });
      r.moves++;
      r.dur += move.dur;
    }
  }
  const first = rounds[0];
  const last = rounds[rounds.length - 1];
  assert.equal(rounds.length, 8);
  assert.ok(first.n === 3 && last.n === 5);
  assert.ok(last.moves >= first.moves * 5, `moves ${first.moves} to ${last.moves}`);
  assert.ok(last.dur / last.moves < (first.dur / first.moves) * 0.4, 'and much quicker');
  // each round is at least as hard as the one before
  for (let i = 1; i < rounds.length; i++) assert.ok(rounds[i].moves >= rounds[i - 1].moves && rounds[i].n >= rounds[i - 1].n, `round ${i + 1}`);
});

test('dodo: the shuffle keeps exactly one Dodo and every hat in its own place', () => {
  const game = create(env(5));
  let rounds = 0;
  let was = game.phase;
  for (let i = 0; i < 60 * 200 && !game.done; i++) {
    game.update(1 / 60, blank());
    const now = game.phase;
    if (now === 'pick' && was !== 'pick') {
      rounds++;
      assert.equal(game.hats.filter((h) => h.dodo).length, 1);
      const slots = game.hats.map((h) => h.slot).sort();
      assert.deepEqual(slots, [...Array(game.hats.length).keys()]);
    }
    was = now;
  }
  assert.ok(game.done);
  assert.equal(rounds, 8);
  assert.equal(game.hats.length, 5);
});

test('dodo: the pointer hovers over a hat and a click picks it', () => {
  const game = create(env(2));
  for (let i = 0; i < 60 * 30 && game.phase !== 'pick'; i++) game.update(1 / 60, blank());
  const slot = game.dodoSlot();
  const x = game.hats.find((h) => h.dodo).x;
  for (let i = 0; i < 12; i++) game.update(1 / 60, blank({ pointer: { active: true, x, y: 600 } }));
  assert.equal(game.sel, slot);
  game.update(1 / 60, blank({ action: true, actionPressed: true, pointer: { active: true, x, y: 600 } }));
  assert.ok(game.right);
  assert.ok(game.score >= 100, `score ${game.score}`);
});

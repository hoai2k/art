import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { BIRDS, passes } from '../src/birds.js';
import { run } from './harness.mjs';
import { MORE_IDS } from '../src/more/index.js';

test('every bird has its page data and a score to pass', () => {
  const ids = new Set();
  for (const b of BIRDS) {
    assert.ok(!ids.has(b.id), `duplicate id ${b.id}`);
    ids.add(b.id);
    for (const k of ['name', 'object', 'game', 'goal', 'score', 'color']) assert.ok(b[k], `${b.id}.${k}`);
    assert.equal(b.rhyme.length, 4, `${b.id} rhyme has four lines`);
    assert.ok(Array.isArray(b.tips) && b.tips.length, `${b.id} has tips`);
    assert.ok(Number.isInteger(b.pass) && b.pass > 0, `${b.id} has a score to pass`);
  }
  // the ten, then the book's other 18 in their order, each with its controls
  assert.equal(BIRDS.length, 28);
  assert.deepEqual(BIRDS.slice(10).map((b) => b.id), MORE_IDS);
  for (const b of BIRDS.slice(10)) assert.ok(Array.isArray(b.controls) && b.controls.length, `${b.id} lists its controls`);
});

test('passes compares with the score to pass', () => {
  const b = { pass: 10 };
  assert.equal(passes(b, 9), false);
  assert.equal(passes(b, 10), true);
});

// Every minigame that exists must run to its end with no input and with
// random mashing, and keep a sane score.
for (const b of BIRDS) {
  const file = new URL(`../src/games/${b.id}.js`, import.meta.url);
  test(`${b.id}: runs to the end idle and mashing`, async () => {
    assert.ok(existsSync(file), `${b.id} has its game`);
    const create = (await import(file)).default;
    for (const seed of [1, 2]) {
      const idle = run(create, { seed });
      assert.ok(idle.game.done, 'idle game ends');
      assert.ok(Number.isFinite(idle.game.score) && idle.game.score >= 0, 'idle score is a number');
      let r = seed;
      const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
      const mash = run(create, {
        seed,
        bot: () => ({ x: rnd() * 2 - 1, y: rnd() * 2 - 1, action: rnd() < 0.5, left: rnd() < 0.1, right: rnd() < 0.1, spin: rnd() - 0.5 }),
      });
      assert.ok(mash.game.done, 'mashed game ends');
      assert.ok(Number.isFinite(mash.game.score) && mash.game.score >= 0, 'mashed score is a number');
      assert.ok(idle.game.score < b.pass, 'doing nothing does not pass');
      // Spot the Dodo is a shell game: a random pick is right now and then,
      // so mashing passes about one game in twenty (checked as a rate in
      // dodo.test.mjs); here it only has to stay well short on average.
      if (b.id === 'dodo') assert.ok(mash.game.score < b.pass * 1.2, `mashing does not pass by much (${mash.game.score} of ${b.pass})`);
      else assert.ok(mash.game.score < b.pass, `mashing does not pass (${mash.game.score} of ${b.pass})`);
      if (typeof mash.game.hud === 'function') assert.equal(typeof mash.game.hud(), 'string');
      if (typeof mash.game.summary === 'function') assert.ok(Array.isArray(mash.game.summary()));
    }
  });
}

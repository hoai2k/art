// The one difficulty curve every minigame follows (src/games/difficulty.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { difficulty, knob, curve, levelOf, LEVELS } from '../src/games/difficulty.js';

const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

test('difficulty: Normal starts easy, is medium by 65%, and ends short of hard', () => {
  assert.equal(difficulty(0), 0);
  assert.ok(near(difficulty(0.65), 0.5));
  assert.ok(near(difficulty(1), 0.85));
  assert.ok(difficulty(0.3) < 0.25, `a gentle first third: ${difficulty(0.3)}`);
  assert.ok(difficulty(0.8) < 0.6, `hard only in the last stretch: ${difficulty(0.8)}`);
});

test('difficulty: Easier tops out at medium-low; Harder opens near medium and ends hard', () => {
  assert.equal(difficulty(0, 'easier'), 0);
  assert.ok(near(difficulty(1, 'easier'), 0.35));
  assert.ok(near(difficulty(0, 'harder'), 0.45));
  assert.ok(near(difficulty(1, 'harder'), 1));
  for (let p = 0.05; p <= 1; p += 0.05) {
    assert.ok(difficulty(p, 'easier') < difficulty(p, 'normal') && difficulty(p, 'normal') < difficulty(p, 'harder'), `ordered at ${p}`);
  }
});

test('difficulty: every curve only rises, and stays within 0..1 whatever it is given', () => {
  for (const l of LEVELS) {
    let last = -1;
    for (let p = -0.2; p <= 1.2; p += 0.01) {
      const d = difficulty(p, l);
      assert.ok(d >= last - 1e-12 && d >= 0 && d <= 1, `${l} at ${p}: ${d}`);
      last = d;
    }
  }
});

test('difficulty: knob passes through easy, medium and hard, in straight lines between', () => {
  assert.equal(knob(0, 10, 6, 1), 10);
  assert.equal(knob(0.5, 10, 6, 1), 6);
  assert.equal(knob(1, 10, 6, 1), 1);
  assert.equal(knob(0.25, 10, 6, 1), 8);
  assert.equal(knob(0.75, 10, 6, 1), 3.5);
  assert.equal(knob(-1, 10, 6, 1), 10, 'clamped');
  assert.equal(knob(2, 10, 6, 1), 1, 'clamped');
});

test('difficulty: a game without a setting in env plays Normal', () => {
  assert.equal(levelOf(undefined), 'normal');
  assert.equal(levelOf('nightmare'), 'normal');
  assert.equal(curve({})(0.65), difficulty(0.65, 'normal'));
  assert.equal(curve({ difficulty: 'harder' })(0), 0.45);
});

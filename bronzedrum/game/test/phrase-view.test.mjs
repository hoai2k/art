import test from 'node:test';
import assert from 'node:assert/strict';
import { DrumReader, commandById, setDifficulty, setBeatCount } from '../src/rhythm.js';
import { callPattern } from '../src/modes.js';
import { guidedPhrase } from '../src/phrase-view.js';

const preview = (reader) => {
  const best = reader.progress();
  return best && { pattern: best.pattern, filled: reader.phrase.length, done: false };
};

test('tutorial ghosts follow the instructed tier through ambiguous opening strokes', () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    setDifficulty(difficulty);
    for (const beats of [3, 4, 8]) {
      setBeatCount(beats);
      for (const id of ['march', 'strike']) {
        for (const text of commandById(id).tiers) {
          const reader = new DrumReader();
          const expected = callPattern(text);
          assert.equal(guidedPhrase(reader, null, [expected]).pattern.text, text);
          // Both families share their opening strokes across multiple tiers.
          reader.hit(expected.strokes[0].drum, 1);
          const view = guidedPhrase(reader, preview(reader), [expected]);
          assert.equal(view.pattern.text, text);
          assert.equal(view.filled, 1);
          assert.deepEqual(view.pattern.strokes, expected.strokes);
        }
      }
    }
  }
  setDifficulty('medium');
  setBeatCount(4);
});

test('changing instruction immediately changes ghosts; incompatible strokes get no misleading continuation', () => {
  const reader = new DrumReader();
  reader.hit('L', 1);
  const tiers = commandById('march').tiers.map((text) => callPattern(text));
  assert.equal(guidedPhrase(reader, preview(reader), [tiers[0]]).pattern.text, tiers[0].text);
  assert.equal(guidedPhrase(reader, preview(reader), [tiers[1]]).pattern.text, tiers[1].text);
  const strike = callPattern(commandById('strike').tiers[0]);
  const view = guidedPhrase(reader, preview(reader), [strike]);
  assert.equal(view.pattern.strokes.length, view.filled);
  assert.equal(view.pattern.strokes[0].drum, 'L');
  assert.equal(guidedPhrase(reader, preview(reader), []).pattern.strokes.length, 1, 'blocking instruction has no rhythm ghosts');
});

test('completed rhythms stay visible and either explicitly offered rhythm can guide input', () => {
  const reader = new DrumReader();
  const expected = ['march', 'strike'].map((id) => callPattern(commandById(id).tiers[0]));
  reader.hit('R', 1);
  assert.equal(guidedPhrase(reader, preview(reader), expected).pattern.text, expected[1].text);
  const completed = { pattern: expected[0], filled: Infinity, done: true };
  assert.equal(guidedPhrase(reader, completed, [expected[1]]), completed);
});

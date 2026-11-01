import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogue, levelOf, levelRhythms, usesText, firstChapter, LEVELS } from '../src/training.js';
import { STAGES } from '../src/stages.js';
import { setDifficulty, setBeatCount, designedTiers } from '../src/rhythm.js';

test('levels: plain beats, a pair, pair runs, a triplet, triplet runs', () => {
  assert.equal(levelOf('L R L R'), 1, 'all quarter notes');
  assert.equal(levelOf('R RR R R'), 2, 'one pair, all one drum');
  assert.equal(levelOf('L RR L R'), 3, 'one pair on one drum, switches between beats');
  assert.equal(levelOf('RR L R L'), 3);
  assert.equal(levelOf('L L LR R'), 4, 'a pair switching inside, no switch beside it');
  assert.equal(levelOf('R RRR R L'), 4, 'a triplet on one drum, no switch beside it');
  assert.equal(levelOf('L R LR R'), 5, 'a switching pair with a switch just before it');
  assert.equal(levelOf('L LR L R'), 5, 'and just after it (L LR L, not L LR R)');
  assert.equal(levelOf('L RRR L R'), 5, 'a triplet among switching beats');
  assert.equal(levelOf('L RR L RR'), 5, 'two pairs');
  assert.equal(levelOf('L RRR L RRR'), 6, 'two triplets');
  assert.equal(levelOf('L RR RR L'), 6, 'pairs back to back');
  assert.equal(levelOf('L LRR L R'), 7, 'a triplet switching inside');
  assert.equal(levelOf('RRR L RR L'), 8, 'pairs and triplets, each on one drum');
  assert.equal(levelOf('L LR RRR L'), 9, 'pairs and triplets, one switching inside');
});

test('the catalogue holds every rhythm the chapters ask for, once, numbered in order of first use', () => {
  const all = catalogue();
  assert.deepEqual(all.map((e) => e.n), all.map((_, i) => i + 1));
  assert.equal(new Set(all.map((e) => e.text)).size, all.length, 'no rhythm twice');
  const texts = new Set(all.map((e) => e.text));
  STAGES.forEach((st) => {
    for (const c of st.calls || []) assert.ok(texts.has(c.text), c.text);
    if (st.rhythm) assert.ok(texts.has(st.rhythm));
    if ((st.mode || 'battle') === 'battle') {
      for (const id of st.unlocked) for (const t of designedTiers(id).slice(0, st.maxTier)) assert.ok(texts.has(t), t);
    }
  });
  // First uses come in chapter order (Training's own rhythms after them all).
  const firsts = all.map(firstChapter);
  assert.deepEqual(firsts, [...firsts].sort((a, b) => a - b));
  assert.equal(all[0].text, 'L L L R');
  assert.equal(all[0].uses[0].what, 'March I');
  assert.ok(all.every((e) => e.level >= 1 && e.level <= LEVELS.length && e.bpm > 0));
  // Every level has something to practise.
  for (let l = 1; l <= LEVELS.length; l++) assert.ok(levelRhythms(l, all).length > 0, `level ${l}`);
});

test('numbers do not move with the Difficulty and Number of beats settings', () => {
  const base = catalogue().map((e) => `${e.n} ${e.text}`);
  setDifficulty('hard');
  setBeatCount(6);
  assert.deepEqual(catalogue().map((e) => `${e.n} ${e.text}`), base);
  setDifficulty('medium');
  setBeatCount(4);
});

test('a rhythm used in several places lists each use with its chapters', () => {
  const e = catalogue().find((x) => x.text === 'L RRR L R');
  assert.equal(usesText(e), 'Call · ch 2 — March III · ch 5, 6, 8');
});

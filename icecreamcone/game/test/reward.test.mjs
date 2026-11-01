import test from 'node:test';
import assert from 'node:assert/strict';
import { roundOutcome, turnsOver, spottedLine, stepAt, skipFrom, STEPS, END, bookLayout, spreadCount, spreadOf, PER_SPREAD, pop, UNLOCK_TIME, resultKind, resultTiming, RESULT_TITLES, RESULT_TIME, RESULT_GUARD } from '../src/reward.js';

test('the first pass celebrates; every other round shows the result briefly', () => {
  assert.equal(roundOutcome({ wasPassed: false, isPassed: true, reached: true }), 'celebrate');
  assert.equal(roundOutcome({ wasPassed: true, isPassed: true, reached: true }), 'brief', 'passing again');
  assert.equal(roundOutcome({ wasPassed: true, isPassed: true, reached: false }), 'brief', 'falling short after passing');
  assert.equal(roundOutcome({ wasPassed: false, isPassed: false, reached: false }), 'brief', 'not yet');
});

test('any bird can be the first spotted: a pass celebrates whatever was passed before it', () => {
  // the outcome depends only on this bird (no page has to be opened first)
  for (const debug of [false, true]) assert.equal(roundOutcome({ wasPassed: false, isPassed: true, reached: true, debug }), 'celebrate');
});

test('the result card: a World Record, a pass, a personal best, or plain', () => {
  assert.equal(resultKind({ record: true, reached: true }), 'record');
  assert.equal(resultKind({ record: false, reached: true }), 'passed');
  assert.equal(resultKind({ record: true, reached: false }), 'best');
  assert.equal(resultKind({ record: false, reached: false }), 'plain');
  assert.equal(RESULT_TITLES.record, 'New World Record!');
  assert.equal(RESULT_TITLES.best, 'Personal Best!');
  assert.equal(RESULT_TITLES.plain, 'Time!', 'below the mark stays plain');
});

test('a World Record card stays longer than a pass, and a pass at least as long as the rest', () => {
  const r = resultTiming('record');
  const p = resultTiming('passed');
  const n = resultTiming('plain');
  assert.equal(n.time, RESULT_TIME);
  assert.equal(n.guard, RESULT_GUARD);
  assert.deepEqual(resultTiming('nonsense'), n);
  assert.ok(r.time > p.time && p.time >= n.time);
  for (const t of [r, p, n]) assert.ok(t.guard > 0 && t.guard < 1 && t.guard < t.time, 'a press still leaves soon');
});

test('in debug every round that reaches the score celebrates', () => {
  assert.equal(roundOutcome({ wasPassed: true, isPassed: true, reached: true, debug: true }), 'celebrate');
  assert.equal(roundOutcome({ wasPassed: false, isPassed: true, reached: true, debug: true }), 'celebrate');
  assert.equal(roundOutcome({ wasPassed: true, isPassed: true, reached: false, debug: true }), 'brief');
});

test("afterwards the bird's own card turns over: after a first pass, not after a skip or a brief round", () => {
  assert.equal(turnsOver({ outcome: 'celebrate' }), true);
  assert.equal(turnsOver({ outcome: 'celebrate', skipped: true }), false, 'B or a long press goes straight back');
  assert.equal(turnsOver({ outcome: 'brief' }), false);
  // Exit to Field Guide counts the round so far: a first pass turns it over too
  assert.equal(turnsOver({ quit: true, wasPassed: false, isPassed: true }), true);
  assert.equal(turnsOver({ quit: true, wasPassed: true, isPassed: true }), false, 'spotted before');
  assert.equal(turnsOver({ quit: true, wasPassed: false, isPassed: false }), false, 'short of the score');
});

test('the line under the stuck sticker counts the birds spotted', () => {
  assert.equal(spottedLine(1, 28), '1 of 28 birds spotted!');
  assert.equal(spottedLine(10, 28), '10 of 28 birds spotted!');
  assert.equal(spottedLine(28, 28), 'Every one of the 28 rare birds, spotted!');
});

test('the celebration steps, and a press jumps to the next', () => {
  assert.deepEqual(STEPS.map((s) => s.name), ['sticker', 'book', 'fly', 'stuck', 'done']);
  for (let i = 1; i < STEPS.length; i++) assert.ok(STEPS[i].at > STEPS[i - 1].at);
  assert.equal(stepAt(0), 'sticker');
  assert.equal(stepAt(STEPS[1].at), 'book');
  assert.equal(stepAt(STEPS[2].at + 0.1), 'fly');
  assert.equal(skipFrom(0), STEPS[1].at);
  assert.equal(skipFrom(STEPS[1].at), STEPS[2].at);
  assert.equal(skipFrom(STEPS[3].at + 0.2), END);
  assert.equal(skipFrom(END + 1), END);
  const total = END + UNLOCK_TIME;
  assert.ok(total >= 5 && total <= 7, `the whole sequence takes ${total} s`);
});

test('the pop overshoots and settles at full size', () => {
  assert.equal(pop(0), 0);
  assert.equal(pop(1), 1);
  assert.ok(Math.max(...Array.from({ length: 50 }, (_, i) => pop(i / 50))) > 1.05);
});

test('the sticker book has a slot for every bird, inside its pages, not overlapping', () => {
  for (const n of [1, 2, 5, 10, 13, 28]) {
    for (const wide of [true, false]) {
      const rect = wide ? { x: 150, y: 285, w: 1300, h: 565 } : { x: 80, y: 520, w: 740, h: 1010 };
      const seen = [];
      for (let sp = 0; sp < spreadCount(n); sp++) {
        const L = bookLayout(n, rect, wide, sp);
        assert.equal(L.pages.length, 2);
        assert.ok(L.to - L.from <= PER_SPREAD);
        assert.equal(L.slots.length, L.to - L.from);
        L.slots.forEach((s, j) => {
          seen.push(s.i);
          assert.equal(spreadOf(s.i, n), sp, `bird ${s.i} is on its spread`);
          const p = L.pages[s.page];
          assert.ok(s.s > 0);
          assert.ok(s.x - s.s / 2 >= p.x - 0.01 && s.x + s.s / 2 <= p.x + p.w + 0.01, `slot ${s.i} of ${n} across`);
          assert.ok(s.y - s.s / 2 >= p.y - 0.01 && s.y + s.s / 2 <= p.y + p.h + 0.01, `slot ${s.i} of ${n} down`);
          for (const o of L.slots.slice(j + 1)) {
            const apart = Math.abs(o.x - s.x) >= (o.s + s.s) / 2 - 0.01 || Math.abs(o.y - s.y) >= (o.s + s.s) / 2 - 0.01;
            assert.ok(apart, `slots overlap (${n}, ${wide})`);
          }
        });
        // the first half of the spread on its first page, in order
        assert.equal(L.slots.filter((s) => s.page === 0).length, Math.ceil((L.to - L.from) / 2));
      }
      assert.deepEqual(seen, [...Array(n).keys()], 'every bird once, in order');
    }
  }
  // the 28 birds: two spreads of 14, the stickers a good size on a wide screen
  assert.equal(spreadCount(28), 2);
  assert.equal(spreadOf(13, 28), 0);
  assert.equal(spreadOf(14, 28), 1);
  assert.equal(spreadCount(10), 1);
  assert.ok(bookLayout(28, { x: 150, y: 285, w: 1300, h: 565 }, true, 1).slots[0].s > 130);
});

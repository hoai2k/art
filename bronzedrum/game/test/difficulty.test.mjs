import test from 'node:test';
import assert from 'node:assert/strict';
import { DrumReader, COMMANDS, DIFFICULTIES, BEAT_RANGE, setDifficulty, setBeatCount, rhythmFor, fitBeats, parsePattern } from '../src/rhythm.js';
import { STAGES } from '../src/stages.js';

/** Play strokes ([drum, t]) in real time, letting the clock run between them and after. */
function playLive(reader, strokes, tail = 3) {
  const events = [];
  let clock = strokes[0][1];
  for (const [drum, t] of strokes) {
    for (; clock < t; clock += 0.01) events.push(...reader.update(clock));
    events.push(...reader.hit(drum, t));
  }
  const end = clock + tail;
  for (; clock < end; clock += 0.01) events.push(...reader.update(clock));
  return events;
}
const even = (text, u = 0.5, t0 = 10) => parsePattern(text).map((s) => [s.drum, t0 + s.pos * u]);
const command = (events) => events.find((e) => e.type === 'command');

test('rests parse as silent slots: a beat keeps its division', () => {
  const s = parsePattern('L R.R .R .');
  assert.deepEqual(s.map((x) => x.drum).join(''), 'LRRR');
  assert.deepEqual(s.map((x) => +x.pos.toFixed(3)), [0, 1, 1.667, 2.5]);
  assert.deepEqual(s.map((x) => x.div), [1, 3, 3, 2]);
});

for (const d of DIFFICULTIES) {
  test(`${d}: every command's rhythm, played evenly, is read as that command and no other`, () => {
    setDifficulty(d);
    for (const c of COMMANDS) {
      c.tiers.forEach((text, i) => {
        // Commands open on one stroke: the reader must tell them apart.
        assert.equal(text.split(' ')[0].length, 1, `${d} ${c.id} ${text}`);
        for (const u of [0.42, 0.6, 0.9]) {
          const ev = playLive(new DrumReader(), even(text, u));
          const cmd = command(ev);
          assert.ok(cmd, `${d} ${c.id} ${text} at ${u}s a beat is accepted`);
          assert.equal(cmd.command, c.id, `${d} ${text}`);
          assert.equal(cmd.tier, i + 1, `${d} ${text} read as tier ${cmd.tier}`);
          assert.ok(!ev.some((e) => e.type === 'reset'), `${d} ${text} at ${u}: nothing breaks`);
        }
      });
    }
    setDifficulty('medium');
  });
}

test('easy never reaches triplets; hard has rests, inside pairs and triplets too', () => {
  setDifficulty('easy');
  for (const c of COMMANDS) for (const t of c.tiers) assert.ok(t.split(' ').every((b) => b.length < 3), t);
  setDifficulty('hard');
  const hard = COMMANDS.flatMap((c) => c.tiers);
  assert.ok(hard.some((t) => t.split(' ').includes('.')), 'a silent beat');
  assert.ok(hard.some((t) => /[LR]\.[LR]/.test(t)), 'a silence inside a triplet');
  assert.ok(hard.some((t) => / \.[LR]( |$)/.test(t)), 'an off-beat stroke');
  setDifficulty('medium');
});

test('calls and the casting rhythm at every difficulty still start and end clearly, and are accepted', () => {
  const rhythms = STAGES.flatMap((s) => [...(s.calls || []).map((c) => c.text), ...(s.rhythm ? [s.rhythm] : [])]);
  for (const d of DIFFICULTIES) {
    for (const text of rhythms) {
      const r = rhythmFor(text, d);
      const beats = r.split(' ');
      const first = text.split(' ')[0];
      assert.equal(beats[0], d === 'easy' ? first.slice(0, 2) : first, `${d}: ${text} -> ${r} keeps its first beat`);
      assert.notEqual(beats[beats.length - 1], '.', `${d}: ${r} ends on a stroke`);
      assert.ok(parsePattern(r).length >= 3, `${d}: ${r} has enough strokes`);
      if (d === 'easy') assert.ok(beats.every((b) => b.length < 3), r);
      if (d === 'medium') assert.equal(r, text);
      const reader = new DrumReader();
      reader.patterns = [{ command: 'call', tier: 1, text: r, strokes: parsePattern(r), drums: '' }];
      for (const u of [0.5, 0.75]) {
        const ev = playLive(reader, even(r, u, 20 + u));
        assert.ok(command(ev), `${d}: ${r} at ${u}s a beat is accepted`);
      }
    }
  }
});

test('number of beats: at every length and difficulty, every command keeps its first beat, its length, and is read as itself', () => {
  for (const d of DIFFICULTIES) {
    setDifficulty(d);
    for (let n = BEAT_RANGE.min; n <= BEAT_RANGE.max; n++) {
      setBeatCount(n);
      const all = COMMANDS.flatMap((c) => c.tiers);
      assert.equal(new Set(all).size, all.length, `${d} ${n}: all distinct`);
      for (const c of COMMANDS) {
        c.tiers.forEach((text, i) => {
          assert.equal(text.split(' ').length, n, `${d} ${n} ${text}`);
          assert.equal(text.split(' ')[0].length, 1);
          for (const u of [0.45, 0.8]) {
            const cmd = command(playLive(new DrumReader(), even(text, u)));
            assert.ok(cmd && cmd.command === c.id && cmd.tier === i + 1, `${d} ${n}: ${text} at ${u} read as ${cmd && cmd.command} ${cmd && cmd.tier}`);
          }
        });
      }
    }
  }
  setDifficulty('medium');
  setBeatCount(4);
});

test('number of beats: calls fit to every length and are still accepted', () => {
  const calls = STAGES.flatMap((s) => (s.calls || []).map((c) => c.text));
  for (let n = BEAT_RANGE.min; n <= BEAT_RANGE.max; n++) {
    for (const text of calls) {
      const r = fitBeats(text, n);
      assert.equal(r.split(' ').length, n);
      assert.equal(r.split(' ')[0], text.split(' ')[0]);
      const reader = new DrumReader();
      reader.patterns = [{ command: 'call', tier: 1, text: r, strokes: parsePattern(r), drums: '' }];
      assert.ok(command(playLive(reader, even(r, 0.6, 30))), `${n}: ${r}`);
    }
  }
});

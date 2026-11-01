import test from 'node:test';
import assert from 'node:assert/strict';
import { transcribe, makeCall, practicePattern, PracticeSession, CallSession, riffOn, loopPosition, KITS, SECONDS, BEATS } from '../src/practice.js';

const play = (times, drums = 'LRLRLRLRLRLR') => times.map((t, i) => ({ drum: drums[i % drums.length], t }));

test('even strokes read as plain beats at the player’s tempo', () => {
  const r = transcribe(play([0, 0.5, 1, 1.5]));
  assert.equal(r.text, 'L R L R');
  assert.ok(Math.abs(r.u - 0.5) < 0.01);
  assert.equal(r.beats, 4);
});

test('after a loop is cleared, a rhythm opening with a pair or a triplet reads at the loop’s tempo', () => {
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let exact = 0;
  for (let k = 0; k < 120; k++) {
    const beats = 2 + Math.floor(rnd() * 7);
    const c = makeCall(beats, rnd);
    const u = [0.45, 0.6, 0.8][k % 3];
    const s = new PracticeSession({ mode: 'free', beats });
    s.lastU = u; // the tempo of the loop just cleared
    // Each stroke off by up to 3% of a beat.
    const ev = drum(s, c.strokes.map((x) => [x.drum, 10 + x.pos * u + (rnd() - 0.5) * 0.06 * u]), 3);
    const loops = ev.filter((e) => e.type === 'loop');
    if (loops.length === 1 && loops[0].loop.text === c.text) exact += 1;
  }
  assert.equal(exact, 120);
});

test('quick strokes share a beat as pairs; triplets only where nothing else fits', () => {
  assert.equal(transcribe(play([0, 0.6, 1.2, 1.5], 'LRRR')).text, 'L R RR');
  // Too quick for plain beats (over 200 BPM): read as pairs.
  assert.equal(transcribe(play([0, 0.2, 0.4, 0.6], 'LRLR')).text, 'LR LR');
  // An even stream reads as pairs, not triplets…
  assert.equal(transcribe(play([0, 0.25, 0.5, 0.75, 1.0, 1.25], 'LRRLRR')).text, 'LR RL RR');
  // …but three strokes in a beat the quarters have already set are a triplet.
  assert.equal(transcribe(play([0, 0.6, 1.2, 1.8, 2.0, 2.2, 2.4], 'LRLRRRL')).text, 'L R L RRR L');
});

test('rests, when the rhythm copied has them: a silent beat, and a silent slot inside a beat; a little unevenness is forgiven', () => {
  assert.equal(transcribe(play([0, 0.5, 1.5, 2.0]), { rests: true }).text, 'L R - L R');
  // An off-beat stroke: a rest, then an eighth.
  assert.equal(transcribe(play([0, 0.5, 1.25, 1.5], 'LRRL'), { rests: true }).text, 'L R .R L');
  const r = transcribe(play([0, 0.52, 0.97, 1.27, 1.5, 2.03], 'LRRRLR'));
  assert.equal(r.text, 'L R RR L R');
});

test('otherwise no rests: the same strokes read as plain beats and pairs', () => {
  for (const [times, drums] of [[[0, 0.5, 1.5, 2.0], 'LRLR'], [[0, 0.5, 1.25, 1.5], 'LRRL'], [[0, 0.45, 1.1, 1.62, 2.0], 'LLLRL']]) {
    const r = transcribe(play(times, drums));
    assert.ok(!/[-.]/.test(r.text), `${r.text} has a rest`);
    assert.equal(r.strokes.length, times.length);
  }
});

test('an answer may have rests only when its call does', () => {
  const s = new CallSession({ beats: 4 });
  s.phase = 'answer';
  s.call = { u: 0.5, text: 'L L L R' };
  assert.equal(s.readOptions().rests, false);
  s.call = { u: 0.5, text: 'L - L R' };
  assert.equal(s.readOptions().rests, true);
});

test('every stroke keeps its drum and order', () => {
  const strokes = play([0, 0.4, 0.55, 0.8, 1.2, 1.33, 1.46, 1.6], 'LRRLRRRL');
  const r = transcribe(strokes);
  assert.equal(r.strokes.length, strokes.length);
  assert.deepEqual(r.strokes.map((s) => s.drum).join(''), 'LRRLRRRL');
  for (let i = 1; i < r.strokes.length; i++) assert.ok(r.strokes[i].pos > r.strokes[i - 1].pos);
});

/** Drum strokes into a session at their times, running its clock in between and for `tail` seconds after. */
function drum(s, strokes, tail = 0) {
  const ev = [];
  let clock = strokes.length ? strokes[0][1] : 0;
  for (const [d, t] of strokes) {
    for (; clock < t; clock += 0.01) ev.push(...s.update(clock));
    ev.push(...s.stroke(d, t));
  }
  const end = clock + tail;
  for (; clock < end; clock += 0.01) ev.push(...s.update(clock));
  return ev;
}

test('free play: a rhythm of four beats loops from the beat after it, triplets included', () => {
  const s = new PracticeSession({ mode: 'free', beats: 4 });
  let ev = drum(s, [['L', 10], ['R', 10.5], ['L', 11], ['R', 11.5]], 0.5);
  const loop = ev.find((e) => e.type === 'loop').loop;
  assert.equal(loop.text, 'L R L R');
  assert.ok(Math.abs(loop.start - 12) < 0.02, 'starts on the beat after the fourth');
  assert.ok(Math.abs(loop.period - 2) < 0.02);
  assert.equal(loopPosition(loop, 12.6).played, 2);
  // Plain beats, then a triplet in the last beat.
  s.clear(19);
  ev = drum(s, [['L', 20], ['R', 20.6], ['L', 21.2], ['R', 21.8], ['R', 22.0], ['R', 22.2]], 1);
  assert.equal(ev.find((e) => e.type === 'loop').loop.text, 'L R L RRR');
});

test('free play: a closing pair is waited for; the loop plays on under any strokes until A clears it', () => {
  const s = new PracticeSession({ mode: 'free', beats: 4 });
  // The last beat is a pair: the second stroke comes half a beat after the fourth beat.
  let ev = drum(s, [['L', 0], ['R', 0.5], ['L', 1], ['R', 1.5], ['R', 1.75]], 0.6);
  assert.equal(ev.find((e) => e.type === 'loop').loop.text, 'L R L RR');
  const loop = s.loop;
  // A whole other rhythm drummed over it is playing along: the loop stays.
  ev = drum(s, [['R', 5], ['R', 5.6], ['L', 6.2], ['R', 6.8]], 3);
  assert.ok(ev.every((e) => e.type === 'playAlong'), JSON.stringify(ev));
  assert.equal(s.loop, loop);
  assert.equal(s.phrase.length, 0);
  // A clears it; the next rhythm becomes the new loop.
  assert.equal(s.clear(12)[0].stopped, true);
  ev = drum(s, [['R', 13], ['R', 13.6], ['L', 14.2], ['R', 14.8]], 0.6);
  assert.equal(ev.find((e) => e.type === 'loop').loop.text, 'R R L R');
});

test('free play: beats left silent at the end are rests; a lone stroke is let go; clear stops the loop', () => {
  const s = new PracticeSession({ mode: 'free', beats: 4 });
  const ev = drum(s, [['L', 0], ['R', 0.5]], 2);
  assert.equal(ev.find((e) => e.type === 'loop').loop.text, 'L R - -');
  assert.equal(s.clear(5)[0].stopped, true);
  assert.equal(s.loop, null);
  const lone = drum(s, [['L', 10]], 3);
  assert.ok(lone.some((e) => e.type === 'abandon'));
});

test('LB and RB: 2 to 12 beats, and the rhythm being drummed starts over', () => {
  const s = new PracticeSession({ mode: 'free', beats: 2 });
  assert.deepEqual(s.setBeats(1, 0), []);
  assert.equal(s.beats, BEATS.min);
  s.stroke('L', 1);
  assert.equal(s.setBeats(5, 1.2)[0].beats, 5);
  assert.equal(s.phrase.length, 0);
  s.setBeats(40, 2);
  assert.equal(s.beats, BEATS.max);
});

test('a partner’s call has the same number of beats, each of one to three strokes', () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let n = BEATS.min; n <= BEATS.max; n++) {
    for (let k = 0; k < 20; k++) {
      const c = makeCall(n, rnd);
      const beats = c.text.split(' ');
      assert.equal(beats.length, n);
      for (const beat of beats) {
        assert.ok(beat.length >= 1 && beat.length <= 3, c.text);
        assert.ok(!beat.slice(1).includes('L'), c.text); // deep strokes only open a beat
      }
      assert.deepEqual(practicePattern(c.text).strokes, c.strokes);
    }
  }
});

test('call and answer: any answer of the right length, then the next call on the next beat', () => {
  const s = new PracticeSession({ mode: 'call', beats: 4 });
  const first = s.update(2).find((e) => e.type === 'call').call;
  assert.equal(first.beats, 4);
  // Answer with something else entirely, after the call, at 0.6 s a beat.
  const t0 = first.end + 1;
  const ev = drum(s, [['R', t0], ['R', t0 + 0.6], ['L', t0 + 0.9], ['R', t0 + 1.2], ['L', t0 + 1.8]], 0.6);
  const answered = ev.find((e) => e.type === 'answered').answer;
  assert.equal(answered.text, 'R RL R L');
  const next = ev.find((e) => e.type === 'call').call;
  assert.ok(Math.abs(next.start - (t0 + 2.4)) < 0.05, 'the partner comes back on the beat after the fourth');
  assert.ok(Math.abs(next.u - 0.6) < 0.02, 'at the player’s tempo');
  // Answering during a call cuts it short.
  const cut = s.stroke('L', next.start + 0.1);
  assert.ok(cut.some((e) => e.type === 'cutCall'));
});

test('call and answer: an unanswered call is played again', () => {
  const s = new PracticeSession({ mode: 'call', beats: 3 });
  const c = s.update(2).find((e) => e.type === 'call').call;
  const again = s.update(c.end + 30).find((e) => e.type === 'call');
  assert.equal(again.again, true);
  assert.equal(again.call.text, c.text);
});

test('every kit has a low and a high voice', () => {
  assert.equal(new Set(KITS.map((k) => k.id)).size, KITS.length);
  for (const k of KITS) assert.ok(k.L && k.R && k.L !== k.R && k.name && k.vn);
});

/** Drum a rhythm text at tempo u from t0 (each beat's strokes share it). */
const rhythmAt = (text, t0, u) => practicePattern(text).strokes.map((x) => [x.drum, t0 + x.pos * u]);

test('a riff keeps the length and the first beat, changes something, and keeps deep strokes at the start of beats', () => {
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const text of ['L R L R', 'L RR L RRR', 'R - R L', 'L L LR R RR L']) {
    for (let k = 0; k < 10; k++) {
      const r = riffOn(text, rnd);
      const a = text.split(' ');
      const b = r.text.split(' ');
      assert.equal(b.length, a.length);
      assert.equal(b[0], a[0]);
      assert.notEqual(r.text, text);
      for (const beat of b) assert.ok(!beat.slice(1).includes('L'), r.text);
    }
  }
});

test('call and answer: the partner calls, the answer completes an exchange that loops under any strokes until A', () => {
  const s = new CallSession({ beats: 4 });
  const call = s.update(2).find((e) => e.type === 'call').call;
  const u = call.u;
  // Answer right on the beat after the call, at its tempo.
  let ev = drum(s, rhythmAt('L RR L R', call.end, u), 1.2);
  assert.equal(ev.find((e) => e.type === 'answered').answer.text, 'L RR L R');
  const ex = ev.find((e) => e.type === 'exchange');
  assert.ok(ex, 'the exchange starts');
  assert.equal(s.phase, 'loop');
  const L = s.loop;
  assert.equal(L.beats, 8);
  assert.ok(Math.abs(L.period - 8 * u) < 1e-9);
  // The answer sets the beat: the call comes round again right after it.
  assert.ok(Math.abs(L.start + L.period - (call.end + 4 * u)) < 0.02);
  assert.deepEqual([...new Set(L.strokes.filter((x) => x.pos < 4).map((x) => x.who))], ['partner']);
  assert.deepEqual([...new Set(L.strokes.filter((x) => x.pos >= 4).map((x) => x.who))], ['you']);
  // Drumming over it plays along: no new rhythm, no new call, the loop stays.
  const t1 = L.start + 3 * L.period;
  ev = drum(s, rhythmAt('R R R R', t1, u), 10);
  assert.ok(ev.every((e) => e.type === 'playAlong'), JSON.stringify(ev));
  assert.equal(s.loop, L);
  // A clears it and hands the call to the player.
  ev = s.clear(t1 + 12);
  assert.equal(ev[0].stopped, true);
  assert.equal(ev.find((e) => e.type === 'turn').starter, 'you');
  assert.equal(s.loop, null);
  assert.equal(s.phase, 'lead');
});

test('call and answer: the player calls, the partner riffs on it, and that loops; the next clear hands the call back', () => {
  const s = new CallSession({ beats: 4 });
  s.update(2);
  s.clear(3); // the player's turn
  const u = 0.55;
  // No call comes while the player is to call, however long they wait.
  assert.ok(!drum(s, [], 0).length);
  for (let t = 3; t < 20; t += 0.05) assert.ok(!s.update(t).some((e) => e.type === 'call'));
  let ev = drum(s, rhythmAt('L R L RR', 20, u), 1.2);
  assert.equal(ev.find((e) => e.type === 'led').lead.text, 'L R L RR');
  const riff = ev.find((e) => e.type === 'riff').riff;
  assert.notEqual(riff.text, 'L R L RR');
  assert.ok(Math.abs(riff.start - (20 + 4 * u)) < 0.02, 'the riff comes in on the next beat');
  const L = s.loop;
  assert.equal(L.start, 20);
  assert.deepEqual([...new Set(L.strokes.filter((x) => x.pos < 4).map((x) => x.who))], ['you']);
  assert.deepEqual([...new Set(L.strokes.filter((x) => x.pos >= 4).map((x) => x.who))], ['partner']);
  assert.equal(L.strokes.filter((x) => x.pos >= 4)[0].drum, 'L', 'the riff keeps the first beat');
  // Strokes over it play along.
  ev = drum(s, rhythmAt('R L', 30, u), 5);
  assert.ok(ev.every((e) => e.type === 'playAlong'));
  // The next clear: the partner calls again.
  ev = s.clear(40);
  assert.equal(ev.find((e) => e.type === 'turn').starter, 'partner');
  ev = [];
  for (let t = 40; t < 42; t += 0.05) ev.push(...s.update(t));
  assert.ok(ev.some((e) => e.type === 'call'));
  assert.equal(s.phase, 'call');
});

test('call and answer: clearing before an answer still hands over the call; a late answer still makes the exchange', () => {
  const s = new CallSession({ beats: 3 });
  const call = s.update(2).find((e) => e.type === 'call').call;
  const ev = drum(s, rhythmAt('R R L', call.end + 1.5, call.u), 1.2);
  assert.ok(ev.some((e) => e.type === 'exchange'));
  assert.ok(Math.abs(s.loop.start + s.loop.period - (call.end + 1.5 + 3 * call.u)) < 0.02, 'the answer, late, sets the beat');
  const s2 = new CallSession({ beats: 3 });
  s2.update(2);
  const cleared = s2.clear(2.5);
  assert.ok(cleared.some((e) => e.type === 'cutCall'), 'the call being played stops');
  assert.equal(cleared.find((e) => e.type === 'turn').starter, 'you');
});

test('a few extra hits after a rhythm, in enthusiasm, do not replace the loop', () => {
  const s = new PracticeSession({ mode: 'free', beats: 4 });
  drum(s, rhythmAt('L R L R', 0, 0.5), 0.5);
  const loop = s.loop;
  assert.equal(loop.text, 'L R L R');
  // Two more hits just after the rhythm, then nothing: they play along.
  const ev = drum(s, [['R', 2.05], ['L', 2.3]], 3);
  assert.ok(ev.every((e) => e.type === 'playAlong'), JSON.stringify(ev));
  assert.equal(s.loop, loop, 'the loop plays on');
});

test('a stray hit well before the rhythm is left out', () => {
  const s = new PracticeSession({ mode: 'free', beats: 4 });
  const ev = drum(s, [['R', 0], ...rhythmAt('L R L RR', 2.5, 0.5)], 0.8);
  assert.equal(ev.find((e) => e.type === 'loop').loop.text, 'L R L RR');
});

test('an answer is read at about its call’s speed', () => {
  const s = new CallSession({ beats: 4 });
  const call = s.update(2).find((e) => e.type === 'call').call;
  // Even strokes a beat apart at the call's tempo: plain beats, not eighths of a slower beat.
  const ev = drum(s, rhythmAt('L R L R', call.end, call.u), 1);
  const a = ev.find((e) => e.type === 'answered').answer;
  assert.equal(a.text, 'L R L R');
  assert.ok(Math.abs(a.u - call.u) / call.u < 0.05);
});

test('the secondary drum (S) is part of the rhythm: read, looped and riffed on like the others', () => {
  const st = [['L', 0], ['S', 0.5], ['R', 1], ['R', 1.25], ['S', 1.5]].map(([drum, t]) => ({ drum, t: t + 10 }));
  assert.equal(transcribe(st).text, 'L S RR S');
  const s = new PracticeSession({ mode: 'free', beats: 4 });
  for (const x of st) s.stroke(x.drum, x.t);
  for (let t = 10; t < 16; t += 0.05) s.update(t);
  assert.equal(s.loop.text, 'L S RR S');
  for (let i = 0; i < 20; i++) {
    const r = riffOn('L S RR S', ((seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647))(i + 1));
    assert.equal(r.text.split(' ').length, 4, r.text);
  }
});

test('secondary drums: unique ids, the trống chầu first as the default, each with a sample and a face', () => {
  assert.equal(SECONDS[0].id, 'chau');
  assert.equal(new Set(SECONDS.map((d) => d.id)).size, SECONDS.length);
  for (const d of SECONDS) assert.ok(d.sample && d.face && d.vn, d.id);
});

test('free play: a stroke after the last beat completes the rhythm and plays along with its loop', () => {
  const s = new PracticeSession({ mode: 'free', beats: 4 });
  for (const st of rhythmAt('L R L R', 0, 0.5)) s.stroke(st.drum ?? st[0], st.t ?? st[1]);
  // No clock tick in between: the next stroke itself is past the rhythm's end.
  const ev = s.stroke('L', 2.02);
  assert.equal(ev.find((e) => e.type === 'loop').loop.text, 'L R L R');
  assert.equal(ev.at(-1).type, 'playAlong');
  assert.equal(s.phrase.length, 0);
});
